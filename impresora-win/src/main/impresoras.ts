// Impresoras de Windows: listarlas, ver los puertos USB, crear la impresora
// genérica ("Preparar impresora") y mandar los comandos TAL CUAL (RAW).
import { app, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { DiagnosticoPuerto, ImpresoraWindows, PuertoUsb, ResultadoImpresion } from "../compartido/api";
import {
  DRIVER_GENERICO,
  NOMBRE_IMPRESORA_GENERICA,
  RAW_NO_RESPONDE,
  RE_PUERTO_USB,
  SCRIPT_PUERTOS,
  conDiagnostico,
  diagnosticarPuerto,
  limpiarNombreArchivo,
  mensajeErrorRaw,
  parsearPuertos,
  psq,
  resultadoRaw,
} from "./puertos";

const ejecutar = promisify(execFile);

/**
 * Pruebas (solo con `--a-archivo`): los puertos USB y las impresoras de
 * Windows salen de este archivo JSON (la misma forma que da el script de
 * PowerShell), "Preparar" lo cambia y una impresora fuera de su puerto "no
 * responde". Así se prueba el cambio de puerto sin tocar Windows.
 */
let puertosDePrueba: string | null = null;
export function usarPuertosDePrueba(archivo: string | null): void {
  puertosDePrueba = archivo;
}

async function powershell(script: string, timeoutMs = 30_000): Promise<string> {
  const { stdout } = await ejecutar(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );
  return stdout;
}

export async function listarImpresoras(win: BrowserWindow): Promise<ImpresoraWindows[]> {
  const lista = await win.webContents.getPrintersAsync();
  return lista
    .map((p) => {
      const desc = (p.description || p.displayName || "").trim();
      return {
        nombre: p.name,
        predeterminada: (p as { isDefault?: boolean }).isDefault === true,
        ...(desc && desc !== p.name ? { descripcion: desc } : {}),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function puertosUsb(): Promise<PuertoUsb[]> {
  if (puertosDePrueba) return parsearPuertos(readFileSync(puertosDePrueba, "utf8"));
  return parsearPuertos(await powershell(SCRIPT_PUERTOS));
}

/** ¿La impresora de Windows sigue en el puerto USB donde está conectada? */
export async function revisarPuerto(impresora: string): Promise<DiagnosticoPuerto> {
  if (!impresora) return { tipo: "bien" };
  return diagnosticarPuerto(impresora, await puertosUsb());
}

/** "Preparar" en modo de prueba: mueve "Etiquetas AMISE" en el JSON, sin Windows. */
export function prepararDePrueba(puerto: string): ResultadoImpresion {
  if (!puertosDePrueba) return { ok: false, error: "Modo de prueba: no se cambia nada en Windows." };
  if (!RE_PUERTO_USB.test(puerto)) return { ok: false, error: "Ese puerto no es un puerto USB de impresora." };
  const d = JSON.parse(readFileSync(puertosDePrueba, "utf8").replace(/^﻿/, "")) as {
    impresoras?: Array<{ nombre?: string; puerto?: string }>;
  };
  const otras = (Array.isArray(d.impresoras) ? d.impresoras : []).filter((i) => i?.nombre !== NOMBRE_IMPRESORA_GENERICA);
  d.impresoras = [...otras, { nombre: NOMBRE_IMPRESORA_GENERICA, puerto }];
  writeFileSync(puertosDePrueba, JSON.stringify(d, null, 2), "utf8");
  return { ok: true };
}

/**
 * Crea (o mueve de puerto) la impresora "Etiquetas AMISE" con el driver
 * genérico de Windows en el puerto USB elegido. Pide permiso de
 * administrador (UAC) una vez. No toca ninguna otra impresora.
 */
export async function prepararImpresora(puerto: string): Promise<ResultadoImpresion> {
  if (!RE_PUERTO_USB.test(puerto)) return { ok: false, error: "Ese puerto no es un puerto USB de impresora." };
  const dir = mkdtempSync(path.join(os.tmpdir(), "amise-impresora-"));
  const resultado = path.join(dir, "resultado.txt");
  const script = path.join(dir, "preparar.ps1");
  writeFileSync(
    script,
    [
      "$ErrorActionPreference = 'Stop'",
      "try {",
      `  if (-not (Get-PrinterDriver -Name ${psq(DRIVER_GENERICO)} -ErrorAction SilentlyContinue)) { Add-PrinterDriver -Name ${psq(DRIVER_GENERICO)} }`,
      `  if (Get-Printer -Name ${psq(NOMBRE_IMPRESORA_GENERICA)} -ErrorAction SilentlyContinue) {`,
      `    Set-Printer -Name ${psq(NOMBRE_IMPRESORA_GENERICA)} -PortName ${psq(puerto)}`,
      "  } else {",
      `    Add-Printer -Name ${psq(NOMBRE_IMPRESORA_GENERICA)} -DriverName ${psq(DRIVER_GENERICO)} -PortName ${psq(puerto)}`,
      "  }",
      `  Set-Content -LiteralPath ${psq(resultado)} -Value 'OK' -Encoding UTF8`,
      "} catch {",
      `  Set-Content -LiteralPath ${psq(resultado)} -Value ('ERROR ' + $_.Exception.Message) -Encoding UTF8`,
      "}",
    ].join("\r\n"),
    "utf8",
  );
  try {
    await powershell(
      `Start-Process -FilePath powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',${psq(`"${script}"`)}`,
      180_000,
    );
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    const msg = String((e as { stderr?: string; message?: string })?.stderr || (e as Error)?.message || e);
    if (/cancel/i.test(msg)) {
      return { ok: false, error: "Se canceló el permiso de administrador. Sin él no se puede crear la impresora." };
    }
    return { ok: false, error: `No se pudo pedir el permiso de administrador: ${msg.slice(0, 200)}` };
  }
  const r = existsSync(resultado) ? readFileSync(resultado, "utf8").replace(/^﻿/, "").trim() : "";
  rmSync(dir, { recursive: true, force: true });
  if (r === "OK") return { ok: true };
  return { ok: false, error: r ? r.replace(/^ERROR\s*/, "") : "Windows no creó la impresora." };
}

function rutaAyudante(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "raw-print.exe")
    : path.join(app.getAppPath(), "dist", "raw-print.exe");
}

/**
 * Manda los comandos a la impresora de Windows, tal cual. En modo de prueba
 * (`aArchivo`) solo los guarda en esa carpeta. Si la impresora no respondió,
 * revisa su puerto USB: el error dice si se conectó en otro puerto o si la PC
 * ya no la ve.
 */
export async function imprimirRaw(
  p: { impresora: string; datos: string; nombre: string },
  aArchivo: string | null,
): Promise<ResultadoImpresion> {
  const r = await mandarAWindows(p, aArchivo);
  if (r.ok || !r.noResponde) return r;
  const d = await revisarPuerto(p.impresora).catch(() => null);
  return conDiagnostico(r, d);
}

async function mandarAWindows(
  p: { impresora: string; datos: string; nombre: string },
  aArchivo: string | null,
): Promise<ResultadoImpresion> {
  if (aArchivo) {
    // Con los puertos de prueba, una impresora fuera de su puerto no imprime
    // (como el ayudante cuando Windows no la encuentra en 12 s).
    if (puertosDePrueba && (await revisarPuerto(p.impresora)).tipo !== "bien") {
      return resultadoRaw(`ERROR ${RAW_NO_RESPONDE} (prueba) la impresora no está en su puerto; se quitó de la cola de Windows`, p.impresora);
    }
    try {
      mkdirSync(aArchivo, { recursive: true });
      const archivo = path.join(aArchivo, `${Date.now()}-${limpiarNombreArchivo(p.nombre)}.prn`);
      writeFileSync(archivo, p.datos, "latin1");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `No se pudo guardar el archivo de prueba: ${(e as Error)?.message ?? e}` };
    }
  }
  if (!p.impresora) return { ok: false, error: "No hay impresora elegida en el programa." };
  let dir: string;
  let archivo: string;
  try {
    dir = mkdtempSync(path.join(os.tmpdir(), "amise-etiquetas-"));
    archivo = path.join(dir, "etiquetas.prn");
    writeFileSync(archivo, p.datos, "latin1");
  } catch (e) {
    return { ok: false, error: `No se pudo preparar la impresión (¿disco lleno o antivirus?): ${(e as Error)?.message ?? e}` };
  }
  try {
    // El ayudante espera a que el trabajo salga de la cola de Windows (hasta
    // 4 min si sí está imprimiendo; 12 s si la impresora no avanza).
    const { stdout } = await ejecutar(rutaAyudante(), [p.impresora, archivo, p.nombre.slice(0, 60)], {
      timeout: 260_000,
      windowsHide: true,
    });
    return resultadoRaw(stdout, p.impresora);
  } catch (e) {
    // Sale con 1 cuando no se imprimió: su salida trae el "ERROR …".
    const salida = String((e as { stdout?: string })?.stdout || (e as Error)?.message || e);
    const r = resultadoRaw(salida, p.impresora);
    return r.ok ? { ok: false, error: mensajeErrorRaw(salida, p.impresora), detalle: salida.slice(0, 300) } : r;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Partes puras del manejo de impresoras de Windows (sin Electron): se prueban
// con vitest.
import {
  NOMBRE_IMPRESORA_GENERICA,
  type DiagnosticoPuerto,
  type PuertoUsb,
  type ResultadoImpresion,
} from "../compartido/api";

export { NOMBRE_IMPRESORA_GENERICA };
/** Driver que trae Windows y deja pasar los bytes tal cual. */
export const DRIVER_GENERICO = "Generic / Text Only";

// Puertos USB de impresora, qué impresora de Windows los usa y qué aparato
// está detrás (Windows lo guarda en el registro al conectar una impresora USB).
// Las claves del registro se llaman "##?#USB#VID_…": con -Path el "?" es
// comodín y PowerShell no entra a la subclave, por eso todo va con
// -LiteralPath. "conectada": el aparato está enchufado ahora (Windows guarda
// puertos viejos): lo dice cfgmgr32 al momento (CM_Locate_DevNode sin
// "fantasmas" solo encuentra lo conectado); Get-PnpDevice tarda ~5 s por
// aparato y queda solo de respaldo. "instancia" (USB\VID_1FC9&PID_2016\…)
// dice el modelo. Solo lee: no cambia nada.
export const SCRIPT_PUERTOS = [
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "$puertos = @(Get-PrinterPort -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'USB*' } | ForEach-Object { $_.Name })",
  "$impresoras = @(Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ nombre = $_.Name; puerto = $_.PortName } })",
  "$rapido = $false",
  `try { Add-Type -Namespace AmiseImpresora -Name CfgMgr -MemberDefinition '[DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)] public static extern int CM_Locate_DevNodeW(out int devInst, string id, int flags);' -ErrorAction Stop; $rapido = $true } catch { }`,
  "$clase = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceClasses\\{28d78fad-5a12-11d1-ae5b-0000f803a8c2}'",
  "$dispositivos = @(Get-ChildItem -LiteralPath $clase -ErrorAction SilentlyContinue | ForEach-Object {",
  "  $instancia = [string](Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue).DeviceInstance",
  "  $conectada = $false",
  "  if ($instancia) {",
  "    if ($rapido) { $nodo = 0; $conectada = [AmiseImpresora.CfgMgr]::CM_Locate_DevNodeW([ref]$nodo, $instancia, 0) -eq 0 }",
  "    else { try { $conectada = [bool](Get-PnpDevice -InstanceId $instancia -ErrorAction Stop).Present } catch { } }",
  "  }",
  "  Get-ChildItem -LiteralPath $_.PSPath -ErrorAction SilentlyContinue | ForEach-Object {",
  "    $p = Get-ItemProperty -LiteralPath (Join-Path $_.PSPath 'Device Parameters') -ErrorAction SilentlyContinue",
  "    if ($p -and $null -ne $p.'Port Number') { [pscustomobject]@{ puerto = ('{0}{1:000}' -f $p.'Base Name', [int]$p.'Port Number'); descripcion = [string]$p.'Port Description'; conectada = $conectada; instancia = $instancia } }",
  "  }",
  "})",
  "[pscustomobject]@{ puertos = $puertos; impresoras = $impresoras; dispositivos = $dispositivos } | ConvertTo-Json -Depth 4 -Compress",
].join("\n");

export const RE_PUERTO_USB = /^USB\d{3}$/;

/** Texto entre comillas simples de PowerShell. */
export function psq(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function lista<T>(x: T | T[] | null | undefined): T[] {
  if (x === null || x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

type DispositivoCrudo = { puerto?: string; descripcion?: string; conectada?: boolean; instancia?: string };

/** El puerto de una impresora de Windows; en grupo vienen varios: "USB003,USB004". */
function puertosDe(x: unknown): string[] {
  return typeof x === "string" ? x.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** `USB\VID_1fc9&PID_2016\5&…` → `VID_1FC9&PID_2016` (el modelo, sin el lugar). */
export function modeloDe(instancia: unknown): string | undefined {
  const m = typeof instancia === "string" ? /VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(instancia) : null;
  return m ? `VID_${m[1]!.toUpperCase()}&PID_${m[2]!.toUpperCase()}` : undefined;
}

/**
 * Lo que devuelve el script de PowerShell de los puertos USB:
 * `{puertos: ["USB001"], impresoras: [{nombre, puerto}], dispositivos: [{puerto, descripcion, conectada, instancia}]}`.
 * ConvertTo-Json a veces da un solo objeto en vez de una lista: se aguantan
 * las dos formas. Primero van los puertos con la impresora conectada ahora
 * (Windows guarda puertos viejos sin nada detrás: elegir uno de esos no
 * imprime).
 */
export function parsearPuertos(json: string): PuertoUsb[] {
  let d: {
    puertos?: string | string[];
    impresoras?: { nombre?: string; puerto?: string } | Array<{ nombre?: string; puerto?: string }>;
    dispositivos?: DispositivoCrudo | DispositivoCrudo[];
  };
  try {
    d = JSON.parse(json.replace(/^﻿/, "").trim() || "{}");
  } catch {
    return [];
  }
  const puertos = lista(d.puertos).filter((p): p is string => typeof p === "string" && RE_PUERTO_USB.test(p));
  const impresoras = lista(d.impresoras);
  const dispositivos = lista(d.dispositivos);
  return [...new Set(puertos)]
    .sort()
    .map((puerto): PuertoUsb => {
      const aparatos = dispositivos.filter((x) => x?.puerto === puerto);
      // Si Windows recuerda varios aparatos en el mismo puerto, el conectado.
      const aparato = aparatos.find((x) => x?.conectada === true) ?? aparatos[0];
      const desc = aparato?.descripcion?.trim();
      const conectada = aparato?.conectada === true;
      const modelo = conectada ? modeloDe(aparato?.instancia) : undefined;
      const modelos = [...new Set(aparatos.map((x) => modeloDe(x?.instancia)).filter((m): m is string => !!m))].sort();
      return {
        puerto,
        ...(desc ? { dispositivo: desc } : {}),
        ...(modelo ? { modelo } : {}),
        ...(modelos.length > 0 ? { modelos } : {}),
        ...(conectada ? { conectada: true } : {}),
        // Una impresora en grupo ("USB003,USB004") usa todos esos puertos.
        impresoras: impresoras
          .filter((i) => typeof i?.nombre === "string" && puertosDe(i?.puerto).includes(puerto))
          .map((i) => i.nombre as string),
      };
    })
    .sort((a, b) => Number(b.conectada === true) - Number(a.conectada === true));
}

/**
 * ¿La impresora de Windows elegida sigue en el puerto USB donde está
 * conectada? Cuando alguien cambia el cable de puerto, Windows le da otro
 * (USB006) y la impresora de Windows se queda en el viejo (USB005), vacío.
 * Solo se propone otro puerto si es seguro que es la misma impresora: el
 * aparato conectado es de un modelo (VID/PID) que Windows recuerda en su
 * puerto y ninguna otra impresora de Windows usa ese puerto (así nunca se
 * mandan etiquetas a la de tickets). Sin saber el modelo no se adivina.
 */
export function diagnosticarPuerto(impresora: string, puertos: PuertoUsb[]): DiagnosticoPuerto {
  const suyos = impresora ? puertos.filter((p) => p.impresoras.includes(impresora)) : [];
  // No usa un puerto USB (driver de la marca en otro puerto, red…) o usa
  // varios a la vez (grupo de impresoras): no hay qué revisar.
  if (suyos.length !== 1) return { tipo: "bien" };
  const suyo = suyos[0]!;
  if (suyo.conectada === true) return { tipo: "bien" };
  const modelos = suyo.modelos ?? [];
  const conectados = puertos
    .filter(
      (p) => p !== suyo && p.conectada === true && p.impresoras.length === 0 && !!p.modelo && modelos.includes(p.modelo),
    )
    .map((p) => p.puerto)
    .sort();
  if (conectados.length === 1) return { tipo: "otro_puerto", puerto: suyo.puerto, conectado: conectados[0]! };
  if (conectados.length > 1) return { tipo: "varios_puertos", puerto: suyo.puerto, conectados };
  return { tipo: "sin_usb", puerto: suyo.puerto };
}

/** Para la orden que no salió: lo ve quien la mandó (teléfono, admin, caja o
 *  la página de etiquetas), que casi nunca está junto a la PC. */
export function mensajeOrdenPuerto(d: DiagnosticoPuerto): string | null {
  switch (d.tipo) {
    case "otro_puerto":
      return `La impresora se conectó en otro puerto USB de la PC (${d.conectado}) y Windows la sigue buscando en ${d.puerto}. En la PC abre AMISE Impresora y toca "Usar ${d.conectado}"; luego toca "Reimprimir".`;
    case "varios_puertos":
      return `La impresora no está en su puerto USB (${d.puerto}). En la PC abre AMISE Impresora y elige el puerto donde está conectada; luego toca "Reimprimir".`;
    case "sin_usb":
      return 'La PC no ve la impresora por USB: revisa que esté prendida y que el cable esté bien conectado a la PC, y toca "Reimprimir".';
    default:
      return null;
  }
}

/** Si la impresora no respondió, el error dice lo que de verdad pasó con su
 *  puerto USB (y lleva el diagnóstico para la ventana del programa). */
export function conDiagnostico(r: ResultadoImpresion, d: DiagnosticoPuerto | null): ResultadoImpresion {
  if (r.ok || !r.noResponde || !d) return r;
  const m = mensajeOrdenPuerto(d);
  if (!m) return { ...r, puerto: d };
  // Windows no la dejó quitar de su cola: puede salir sola después.
  const atorada = /NO se pudo quitar/.test(r.detalle ?? "");
  return { ...r, error: atorada ? `${m} Ojo: quedó esperando en Windows y puede salir sola.` : m, puerto: d };
}

/** `raw-print.exe`: la impresora no avanzó y el trabajo se quitó de la cola. */
export const RAW_NO_RESPONDE = 9001;
/** `raw-print.exe`: alguien canceló el trabajo en la cola de Windows. */
export const RAW_CANCELADA = 9002;

/** Lo que contestó `raw-print.exe`, como resultado para el programa. */
export function resultadoRaw(salida: string, impresora: string): ResultadoImpresion {
  const s = salida.trim();
  if (s.startsWith("OK")) return { ok: true };
  const m = /ERROR\s+(\d+)/.exec(s);
  return {
    ok: false,
    error: mensajeErrorRaw(s, impresora),
    ...(m && Number(m[1]) === RAW_NO_RESPONDE ? { noResponde: true as const } : {}),
    ...(s ? { detalle: s.slice(0, 300) } : {}),
  };
}

/** Mensaje en español sencillo para lo que contestó `raw-print.exe`. */
export function mensajeErrorRaw(salida: string, impresora: string): string {
  const m = /ERROR\s+(\d+)\s*(.*)/s.exec(salida);
  const codigo = m ? Number(m[1]) : NaN;
  const detalle = (m?.[2] ?? salida).trim().slice(0, 160);
  switch (codigo) {
    case RAW_NO_RESPONDE:
      return (
        `La impresora "${impresora}" no respondió: revisa que esté prendida, con etiquetas y bien conectada, y toca "Reimprimir".` +
        (/NO se pudo quitar/.test(detalle) ? " Ojo: quedó esperando en Windows y puede salir sola al prenderla." : "")
      );
    case RAW_CANCELADA:
      return 'Se canceló en la cola de Windows. Toca "Reimprimir" si hace falta.';
    case 1801:
      return `No encuentro la impresora "${impresora}" en Windows. Elígela otra vez en el programa.`;
    case 1804:
      return `La impresora "${impresora}" no acepta comandos directos. Usa "Preparar impresora USB" o el driver de la marca.`;
    case 5:
      return `Windows no dejó usar la impresora "${impresora}" (permisos).`;
    default:
      return `Windows no pudo imprimir en "${impresora}": ${detalle || "error desconocido"}`;
  }
}

/** Para nombres de archivo del modo de prueba. */
export function limpiarNombreArchivo(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "trabajo";
}

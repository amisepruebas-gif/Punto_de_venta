// ============================================================
// AMISE Impresora — proceso principal (Electron)
// ============================================================
//
// Programa de Windows que recibe las órdenes de impresión de etiquetas de
// AMISE (teléfono que arma lotes, admin y caja) y las imprime en una
// impresora de etiquetas por USB.
//
//   - Vive junto al reloj (bandeja) y arranca con Windows (`--oculto`).
//   - Una sola copia abierta.
//   - La ventana corre Firebase (la cola) y casi siempre está oculta; NO se
//     frena en segundo plano (`backgroundThrottling: false`).
//   - Todo lo que toca Windows (impresoras, archivos, el código guardado)
//     vive aquí y la ventana lo pide por el puente (preload).
//
// Opciones de prueba: `--a-archivo=CARPETA` (guarda los comandos en vez de
// imprimir) y `--emuladores` (se conecta a los emuladores locales).

import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import type { AccionBandeja, OpcionesPrograma } from "../compartido/api";
import { Almacen } from "./almacen";
import { imprimirRaw, listarImpresoras, prepararImpresora, puertosUsb } from "./impresoras";
import { registrar } from "./registro";

function valorOpcion(nombre: string): string | null {
  const pref = `--${nombre}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  return a ? a.slice(pref.length) : null;
}
const OPCIONES: OpcionesPrograma = {
  version: app.getVersion(),
  aArchivo: valorOpcion("a-archivo"),
  emuladores: process.argv.includes("--emuladores"),
};
const OCULTO = process.argv.includes("--oculto");
// Pruebas: los datos del programa (código, sesión, bitácora) en otra carpeta,
// sin tocar los de la instalación real de esta PC.
if (process.env.AMISE_IMPRESORA_DATOS) app.setPath("userData", process.env.AMISE_IMPRESORA_DATOS);

let ventana: BrowserWindow | null = null;
let bandeja: Tray | null = null;
let saliendo = false;
let estado = { texto: "Iniciando…", pausada: false, conectada: false };
let almacen: Almacen;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => mostrarVentana());
  app.whenReady().then(iniciar).catch((e) => {
    registrar("error", `No arrancó: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    app.quit();
  });
}

function rutaRecurso(nombre: string): string {
  return path.join(app.getAppPath(), "recursos", nombre);
}

function mostrarVentana(): void {
  if (!ventana) return;
  if (ventana.isMinimized()) ventana.restore();
  ventana.show();
  ventana.focus();
}

function crearVentana(): void {
  ventana = new BrowserWindow({
    width: 780,
    height: 700,
    minWidth: 560,
    minHeight: 520,
    show: false,
    title: "AMISE Impresora",
    icon: nativeImage.createFromPath(rutaRecurso("bandeja.png")),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Oculta debe seguir oyendo la cola y avisando que está viva.
      backgroundThrottling: false,
    },
  });
  ventana.removeMenu();
  void ventana.loadFile(path.join(__dirname, "../renderer/index.html"));
  ventana.once("ready-to-show", () => {
    if (!OCULTO) mostrarVentana();
  });
  // Cerrar la ventana solo la esconde: el programa sigue imprimiendo.
  ventana.on("close", (e) => {
    if (!saliendo) {
      e.preventDefault();
      ventana?.hide();
    }
  });
  ventana.webContents.on("render-process-gone", (_e, d) => {
    registrar("error", `La ventana se cerró (${d.reason}); se vuelve a abrir.`);
    if (!saliendo) void ventana?.reload();
  });
  // Ningún enlace abre otra ventana dentro del programa.
  ventana.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

function pedirBandeja(accion: AccionBandeja): void {
  ventana?.webContents.send("bandeja:accion", accion);
}

function actualizarBandeja(): void {
  if (!bandeja) return;
  bandeja.setToolTip(`AMISE Impresora — ${estado.texto}`.slice(0, 127));
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: estado.texto.slice(0, 60), enabled: false },
      { type: "separator" },
      { label: "Abrir", click: () => mostrarVentana() },
      estado.pausada
        ? { label: "Reanudar (imprimir al llegar)", click: () => pedirBandeja("reanudar") }
        : { label: "Pausar", click: () => pedirBandeja("pausar") },
      { label: "Imprimir prueba", click: () => pedirBandeja("prueba") },
      { type: "separator" },
      {
        label: "Salir (deja de imprimir)",
        click: () => {
          saliendo = true;
          app.quit();
        },
      },
    ]),
  );
}

function registrarPuente(): void {
  ipcMain.handle("opciones", () => OPCIONES);
  ipcMain.handle("vinculacion:leer", () => almacen.vinculacion());
  ipcMain.handle("vinculacion:guardar", (_e, codigo: unknown) => {
    if (typeof codigo !== "string" || codigo.length > 400) throw new Error("Código inválido");
    almacen.guardarVinculacion(codigo);
  });
  ipcMain.handle("vinculacion:borrar", () => almacen.borrarVinculacion());
  ipcMain.handle("config:leer", () => almacen.config());
  ipcMain.handle("config:guardar", (_e, cambios: unknown) => {
    const c = (cambios && typeof cambios === "object" ? cambios : {}) as {
      impresoraWindows?: string;
      pausada?: boolean;
    };
    return almacen.guardarConfig(c);
  });
  ipcMain.handle("impresoras:listar", () => (ventana ? listarImpresoras(ventana) : []));
  ipcMain.handle("impresoras:puertos", () => puertosUsb());
  ipcMain.handle("impresoras:preparar", async (_e, puerto: unknown) => {
    const r = await prepararImpresora(String(puerto));
    registrar(r.ok ? "info" : "error", `Preparar impresora en ${String(puerto)}: ${r.ok ? "OK" : r.error}`);
    return r;
  });
  ipcMain.handle("impresoras:imprimir", async (_e, p: unknown) => {
    const x = (p ?? {}) as { impresora?: unknown; datos?: unknown; nombre?: unknown };
    if (typeof x.datos !== "string" || x.datos.length === 0 || x.datos.length > 2_000_000) {
      return { ok: false, error: "No hay nada que imprimir." };
    }
    const r = await imprimirRaw(
      { impresora: String(x.impresora ?? ""), datos: x.datos, nombre: String(x.nombre ?? "AMISE etiquetas") },
      OPCIONES.aArchivo,
    );
    registrar(r.ok ? "info" : "error", `Imprimir "${String(x.nombre)}" en "${String(x.impresora)}": ${r.ok ? "OK" : r.error}`);
    return r;
  });
  ipcMain.on("ventana:mostrar", () => mostrarVentana());
  ipcMain.on("ventana:ocultar", () => ventana?.hide());
  ipcMain.on("bandeja:estado", (_e, e: unknown) => {
    const x = (e ?? {}) as Partial<typeof estado>;
    estado = {
      texto: typeof x.texto === "string" ? x.texto : estado.texto,
      pausada: x.pausada === true,
      conectada: x.conectada === true,
    };
    actualizarBandeja();
  });
  ipcMain.on("registro", (_e, nivel: unknown, mensaje: unknown) => {
    registrar(nivel === "error" ? "error" : "info", String(mensaje).slice(0, 2000));
  });
}

async function iniciar(): Promise<void> {
  almacen = new Almacen();
  registrar("info", `AMISE Impresora ${OPCIONES.version} arrancó${OPCIONES.aArchivo ? " (a archivo)" : ""}${OPCIONES.emuladores ? " (emuladores)" : ""}`);
  // Arranca con Windows, oculto junto al reloj (solo el programa instalado).
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, args: ["--oculto"] });
  }
  registrarPuente();
  bandeja = new Tray(nativeImage.createFromPath(rutaRecurso("bandeja.png")));
  bandeja.on("click", () => mostrarVentana());
  actualizarBandeja();
  crearVentana();
}

app.on("before-quit", () => {
  saliendo = true;
});
// Con la ventana oculta el programa sigue vivo en la bandeja.
app.on("window-all-closed", () => {
  /* no se sale: lo hace "Salir" de la bandeja */
});

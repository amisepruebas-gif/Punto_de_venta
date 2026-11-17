// Bitácora del programa en la carpeta de datos (registro.log, se rota en 1 MB).
// Sirve para saber qué pasó si una impresión falla. Nunca guarda el código
// de vinculación.
import { app } from "electron";
import { appendFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";

export function registrar(nivel: "info" | "error", mensaje: string): void {
  const linea = `${new Date().toISOString()} ${nivel.toUpperCase()} ${mensaje.replace(/AMISE1\.[^\s]+/g, "AMISE1.***")}`;
  if (nivel === "error") console.error(linea);
  else console.log(linea);
  try {
    const archivo = path.join(app.getPath("userData"), "registro.log");
    try {
      if (statSync(archivo).size > 1_000_000) renameSync(archivo, `${archivo}.1`);
    } catch {
      /* todavía no existe */
    }
    appendFileSync(archivo, `${linea}\n`);
  } catch {
    /* sin disco no se detiene el programa */
  }
}

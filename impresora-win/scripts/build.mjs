// Compila "AMISE Impresora" en dist/:
//   dist/main/main.js        proceso principal (esbuild)
//   dist/preload/preload.js  puente seguro hacia la ventana (esbuild)
//   dist/renderer/           la ventana con Firebase (Vite)
//   dist/raw-print.exe       ayudante que manda los bytes TAL CUAL a la
//                            impresora (csc.exe de .NET Framework, viene con
//                            Windows: no hay que instalar nada)
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raiz, "dist");
mkdirSync(dist, { recursive: true });

const comun = {
  bundle: true,
  platform: "node",
  format: "cjs",
  // Electron 33 trae Node 20.
  target: "node20",
  external: ["electron"],
  logLevel: "warning",
};
await build({
  ...comun,
  entryPoints: [path.join(raiz, "src/main/main.ts")],
  outfile: path.join(dist, "main/main.js"),
});
await build({
  ...comun,
  entryPoints: [path.join(raiz, "src/preload/preload.ts")],
  outfile: path.join(dist, "preload/preload.js"),
});

await viteBuild({ configFile: path.join(raiz, "vite.config.ts"), logLevel: "warn" });

const csc = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
const fuente = path.join(raiz, "ayudante", "RawPrint.cs");
const exe = path.join(dist, "raw-print.exe");
if (!existsSync(exe) || statSync(exe).mtimeMs < statSync(fuente).mtimeMs) {
  if (!existsSync(csc)) {
    throw new Error(`No encuentro ${csc}: se necesita .NET Framework 4 (viene con Windows 10/11).`);
  }
  execFileSync(csc, ["/nologo", "/optimize+", "/target:exe", "/platform:anycpu", `/out:${exe}`, fuente], {
    stdio: "inherit",
  });
}
console.log("AMISE Impresora compilado en dist/");

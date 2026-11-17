// Lo que el programa guarda en la PC (carpeta de datos de la app):
//   - el código de vinculación, CIFRADO con DPAPI de Windows (safeStorage):
//     es la llave de esta impresora;
//   - el número al azar de esta PC (`dispositivo`);
//   - la impresora de Windows elegida y si está en pausa.
import { app, safeStorage } from "electron";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ConfigLocal } from "../compartido/api";

type Guardado = {
  dispositivo?: string;
  /** base64 del código cifrado con safeStorage. */
  vinculacion?: string;
  impresoraWindows?: string;
  pausada?: boolean;
};

const RE_DISPOSITIVO = /^[A-Za-z0-9_-]{43}$/;

export class Almacen {
  private readonly archivo = path.join(app.getPath("userData"), "config.json");
  private datos: Guardado;

  constructor() {
    this.datos = this.leerArchivo();
    if (!this.datos.dispositivo || !RE_DISPOSITIVO.test(this.datos.dispositivo)) {
      this.datos.dispositivo = randomBytes(32).toString("base64url");
      this.escribir();
    }
  }

  private leerArchivo(): Guardado {
    try {
      const j: unknown = JSON.parse(readFileSync(this.archivo, "utf8"));
      if (j && typeof j === "object") return j as Guardado;
    } catch {
      /* primera vez o archivo dañado: se empieza en blanco */
    }
    return {};
  }

  private escribir(): void {
    mkdirSync(path.dirname(this.archivo), { recursive: true });
    const tmp = `${this.archivo}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.datos, null, 2));
    renameSync(tmp, this.archivo);
  }

  config(): ConfigLocal {
    return {
      dispositivo: this.datos.dispositivo!,
      ...(this.datos.impresoraWindows ? { impresoraWindows: this.datos.impresoraWindows } : {}),
      pausada: this.datos.pausada === true,
    };
  }

  guardarConfig(c: { impresoraWindows?: string; pausada?: boolean }): ConfigLocal {
    if ("impresoraWindows" in c) {
      this.datos.impresoraWindows =
        typeof c.impresoraWindows === "string" && c.impresoraWindows ? c.impresoraWindows.slice(0, 120) : undefined;
    }
    if ("pausada" in c) this.datos.pausada = c.pausada === true;
    this.escribir();
    return this.config();
  }

  vinculacion(): string | null {
    const v = this.datos.vinculacion;
    if (!v || !safeStorage.isEncryptionAvailable()) return null;
    try {
      return safeStorage.decryptString(Buffer.from(v, "base64"));
    } catch {
      return null;
    }
  }

  guardarVinculacion(codigo: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Windows no deja guardar el código cifrado en esta PC.");
    }
    this.datos.vinculacion = safeStorage.encryptString(codigo).toString("base64");
    this.escribir();
  }

  borrarVinculacion(): void {
    delete this.datos.vinculacion;
    this.escribir();
  }
}

// Lo que la ventana (renderer) puede pedirle al proceso principal de Electron
// por el puente seguro (preload). La ventana NO tiene acceso a Node: todo lo
// que toca Windows (impresoras, archivos, el código guardado) pasa por aquí.

export type ImpresoraWindows = {
  nombre: string;
  predeterminada: boolean;
  descripcion?: string;
};

/** Un puerto USB de impresora de Windows (`USB001`…) y lo que tiene. */
export type PuertoUsb = {
  puerto: string;
  /** Lo que dijo el aparato al conectarse (p. ej. "XP-365B"), si se sabe. */
  dispositivo?: string;
  /** El aparato de ese puerto está conectado ahora mismo. */
  conectada?: boolean;
  /** Impresoras de Windows que ya usan ese puerto. */
  impresoras: string[];
};

export type ResultadoImpresion =
  | { ok: true }
  | {
      ok: false;
      /** Para la persona, en español sencillo. */
      error: string;
      /** La impresora no avanzó (apagada, desconectada, sin papel…): no se imprimió y no quedó en la cola. */
      noResponde?: true;
      /** Lo que dijo Windows, para la bitácora. */
      detalle?: string;
    };

export type ConfigLocal = {
  /** Número al azar de esta PC (43 caracteres): con él la function la
   *  reconoce y no gasta otra entrada al volver a entrar. */
  dispositivo: string;
  /** Impresora de Windows elegida. */
  impresoraWindows?: string;
  pausada: boolean;
};

export type OpcionesPrograma = {
  version: string;
  /** Pruebas: guarda los comandos en esta carpeta en vez de imprimir. */
  aArchivo: string | null;
  /** Pruebas: se conecta a los emuladores locales (proyecto demo-caja). */
  emuladores: boolean;
};

export type AccionBandeja = "pausar" | "reanudar" | "prueba";

export interface ApiAmise {
  opciones(): Promise<OpcionesPrograma>;
  vinculacion: {
    leer(): Promise<string | null>;
    guardar(codigo: string): Promise<void>;
    borrar(): Promise<void>;
  };
  config: {
    leer(): Promise<ConfigLocal>;
    guardar(cambios: { impresoraWindows?: string; pausada?: boolean }): Promise<ConfigLocal>;
  };
  impresoras: {
    listar(): Promise<ImpresoraWindows[]>;
    puertosUsb(): Promise<PuertoUsb[]>;
    preparar(puerto: string): Promise<ResultadoImpresion>;
    imprimir(p: { impresora: string; datos: string; nombre: string }): Promise<ResultadoImpresion>;
  };
  ventana: { mostrar(): void; ocultar(): void };
  estadoBandeja(e: { texto: string; pausada: boolean; conectada: boolean }): void;
  alPedirBandeja(cb: (accion: AccionBandeja) => void): () => void;
  registro(nivel: "info" | "error", mensaje: string): void;
}

declare global {
  interface Window {
    amise: ApiAmise;
  }
}

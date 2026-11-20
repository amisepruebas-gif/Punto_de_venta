// Lo que la ventana (renderer) puede pedirle al proceso principal de Electron
// por el puente seguro (preload). La ventana NO tiene acceso a Node: todo lo
// que toca Windows (impresoras, archivos, el código guardado) pasa por aquí.

export type ImpresoraWindows = {
  nombre: string;
  predeterminada: boolean;
  descripcion?: string;
};

/** Nombre de la impresora que crea "Preparar impresora USB…". */
export const NOMBRE_IMPRESORA_GENERICA = "Etiquetas AMISE";

/** Un puerto USB de impresora de Windows (`USB001`…) y lo que tiene. */
export type PuertoUsb = {
  puerto: string;
  /** Lo que dijo el aparato al conectarse (p. ej. "XP-365B"), si se sabe. */
  dispositivo?: string;
  /** Modelo (`VID_1FC9&PID_2016`) del aparato conectado ahora en ese puerto. */
  modelo?: string;
  /** Modelos de todos los aparatos que Windows recuerda en ese puerto: con
   *  ellos se reconoce la misma impresora conectada en otro puerto. */
  modelos?: string[];
  /** El aparato de ese puerto está conectado ahora mismo. */
  conectada?: boolean;
  /** Impresoras de Windows que ya usan ese puerto. */
  impresoras: string[];
  /** De esas, las que Windows tiene en "Usar impresora sin conexión": les
   *  guarda las órdenes y no se las manda. Windows lo pone solo al quitar el
   *  cable, y cambiarla de puerto no lo quita. */
  sinConexion?: string[];
};

/**
 * Cómo está el puerto USB de la impresora de Windows elegida. Si alguien
 * cambia el cable a otro puerto USB, Windows le da un puerto nuevo (USB006)
 * y la impresora de Windows se queda en el viejo (USB005), donde ya no hay
 * nada: las órdenes no salen aunque la impresora esté prendida.
 */
export type DiagnosticoPuerto =
  /** Su puerto tiene la impresora conectada (o no es USB y no hay qué revisar). */
  | { tipo: "bien" }
  /** La misma impresora está conectada en otro puerto USB (`conectado`). */
  | { tipo: "otro_puerto"; puerto: string; conectado: string }
  /** No está en su puerto y hay varias conectadas: no se sabe cuál es. */
  | { tipo: "varios_puertos"; puerto: string; conectados: string[] }
  /** La PC no la ve por USB (apagada o sin cable). */
  | { tipo: "sin_usb"; puerto: string }
  /** Está conectada en su puerto, pero Windows la tiene en "Usar impresora
   *  sin conexión" (guarda las órdenes y no se las manda). */
  | { tipo: "sin_conexion"; puerto: string };

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
      /** Si no respondió: cómo está su puerto USB (se revisa en ese momento). */
      puerto?: DiagnosticoPuerto;
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
    /** Revisa si la impresora de Windows sigue en el puerto USB donde está
     *  conectada. `null`: no se pudo revisar (se deja lo que se sabía). */
    revisarPuerto(impresora: string): Promise<DiagnosticoPuerto | null>;
    preparar(puerto: string): Promise<ResultadoImpresion>;
    /** Le quita "Usar impresora sin conexión" (pide permiso de administrador). */
    ponerEnLinea(impresora: string): Promise<ResultadoImpresion>;
    imprimir(p: { impresora: string; datos: string; nombre: string }): Promise<ResultadoImpresion>;
  };
  ventana: { mostrar(): void; ocultar(): void };
  estadoBandeja(e: { texto: string; pausada: boolean; conectada: boolean }): void;
  alPedirBandeja(cb: (accion: AccionBandeja) => void): () => void;
  /** Windows avisó que se conectó o desconectó un aparato (USB…). */
  alCambiarDispositivos(cb: () => void): () => void;
  /** Aviso de Windows junto al reloj; al tocarlo se abre la ventana. */
  avisar(a: { titulo: string; texto: string }): void;
  registro(nivel: "info" | "error", mensaje: string): void;
}

declare global {
  interface Window {
    amise: ApiAmise;
  }
}

import { getDocFromCache, type DocumentReference } from "firebase/firestore";

/**
 * Herramientas para que la caja no se trabe sin internet.
 *
 * El SDK de Firestore guarda cada escritura al instante en la tablet (caché
 * persistente) y la sube sola al volver la red. Pero la promesa de
 * `setDoc`/`updateDoc` solo se cumple cuando el SERVIDOR confirma: sin red
 * nunca se cumple y la pantalla se queda cargando. Y las transacciones
 * necesitan al servidor: sin internet el SDK las reintenta 5 veces (cada
 * intento puede esperar hasta 15 s) antes de rendirse.
 */

/** No se pudo hacer en línea: no hay red o el servidor no contesta. */
export class SinConexion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "SinConexion";
  }
}

/** false solo si el dispositivo sabe que no tiene red (WiFi apagado o sin señal). */
export function hayRed(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** El error es por falta de conexión (y no, por ejemplo, de stock o permisos). */
export function esFallaDeRed(e: unknown): boolean {
  if (e instanceof SinConexion) return true;
  const code = (e as { code?: unknown } | null)?.code;
  return code === "unavailable" || code === "deadline-exceeded";
}

/**
 * Tiempo para hacer algo EN LÍNEA antes de darlo por perdido. Con red una
 * transacción tarda 1–2 s. Pasarse con una red lenta no hace daño: cada caso
 * sigue sin servidor (la venta queda OFFLINE, el resto avisa).
 */
const LIMITE_EN_LINEA_MS = 6_000;
/**
 * Si hace poco algo no se pudo hacer en línea, lo siguiente espera menos: con
 * el módem sin internet (la tablet sigue "conectada") no hay que esperar el
 * límite completo cada vez. Si el internet ya volvió, cabe de sobra.
 */
const LIMITE_TRAS_FALLO_MS = 2_000;
const VENTANA_FALLO_MS = 2 * 60_000;
/**
 * Si la transacción ya mandó sus escrituras, pudo quedar hecha en el
 * servidor: se le da más tiempo para saberlo.
 */
const LIMITE_ESCRIBIENDO_MS = 30_000;
let ultimoFallo = 0;

export type ControlLimite = {
  /** Lanza si ya se abandonó. La transacción lo llama al empezar. */
  siAbandonada: () => void;
  /**
   * La transacción lo llama justo antes de escribir: lanza si ya se abandonó
   * y, si no, marca que ya escribe (desde ahí no se abandona al primer límite).
   */
  vaAEscribir: () => void;
};

/**
 * Corre `trabajo` (lecturas y una transacción) con tiempo límite. Si se agota
 * antes de que la transacción escriba, se abandona: como revisa
 * `vaAEscribir()` antes de escribir, ya no hará nada, y lo que se haga sin
 * servidor no se cruza con ella.
 */
export function conLimite<T>(
  trabajo: (ctl: ControlLimite) => Promise<T>,
  opciones: {
    /** Límite fijo, para lo que no tiene prisa (p. ej. cerrar el corte). */
    limiteMs?: number;
  } = {},
): Promise<T> {
  const limiteMs =
    opciones.limiteMs ??
    (Date.now() - ultimoFallo < VENTANA_FALLO_MS ? LIMITE_TRAS_FALLO_MS : LIMITE_EN_LINEA_MS);
  let abandonada = false;
  let escribiendo = false;
  const siAbandonada = () => {
    if (abandonada) throw new SinConexion("El servidor no respondió a tiempo.");
  };
  const promesa = trabajo({
    siAbandonada,
    vaAEscribir: () => {
      siAbandonada();
      escribiendo = true;
    },
  });
  return new Promise<T>((resolve, reject) => {
    const abandonar = () => {
      abandonada = true;
      ultimoFallo = Date.now();
      reject(new SinConexion("El servidor no respondió a tiempo."));
    };
    let reloj = setTimeout(() => {
      if (!escribiendo) return abandonar();
      reloj = setTimeout(abandonar, Math.max(0, LIMITE_ESCRIBIENDO_MS - limiteMs));
    }, limiteMs);
    promesa.then(
      (r) => {
        clearTimeout(reloj);
        ultimoFallo = 0;
        resolve(r);
      },
      (e) => {
        clearTimeout(reloj);
        if (esFallaDeRed(e)) ultimoFallo = Date.now();
        reject(e);
      },
    );
  });
}

/**
 * Espera solo a que la escritura quede guardada en la tablet; el SDK la sube
 * sola al volver la red, aunque la app se cierre antes. La lectura del caché
 * entra en la misma fila de trabajo del SDK, detrás de la escritura, así que
 * cuando contesta ya está guardada aquí. Si la escritura falla en la tablet,
 * lanza; si el servidor la rechaza después, solo queda en la consola.
 */
export async function guardadoEnLaTablet(
  escritura: Promise<void>,
  ref: DocumentReference,
  que: string,
): Promise<void> {
  escritura.catch((e) => console.error(`${que}: no se pudo subir al servidor`, e));
  await Promise.race([
    escritura,
    getDocFromCache(ref).then(
      () => undefined,
      () => undefined,
    ),
  ]);
}

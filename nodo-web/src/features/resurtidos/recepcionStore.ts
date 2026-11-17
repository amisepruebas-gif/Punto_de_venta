import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { auth } from "@/firebase/config";
import { esFallaDeRed } from "@/lib/sinInternet";
import {
  conteoLoteEstaVacio,
  conteoLoteVacio,
  generarID,
  type ConteoLote,
} from "@shared";
import {
  subirSesionLote,
  type MetaSesionLote,
  type ResultadoSubidaLote,
} from "./loteRecepcionService";

// ============================================================
// Recepción de lotes: lo que vive en la tablet
// ============================================================
//
// Por lote: lo escaneado y aún sin terminar (`conteo`) y las sesiones ya
// "selladas" por subir. "Terminar" sella la sesión aunque no haya internet:
// su id, nombre y hora quedan fijos, así un reintento nunca duplica (el
// servidor contesta `yaEstaba`). Una sellada solo se borra de la tablet
// cuando el servidor contestó bien. Se guarda en localStorage: sobrevive a
// cerrar la app o a que se apague la tablet.
//
// Dos pestañas de la caja en el mismo navegador comparten ese guardado: cada
// una vuelve a leerlo cuando la otra lo cambia (zustand no lo hace solo), y lo
// que no se guarda (si está subiendo, la última subida) vive en otro store
// para que la vuelta de cada minuto no reescriba el guardado con una copia
// vieja.

export type SesionSellada = {
  sesionId: string;
  conteo: ConteoLote;
  meta: MetaSesionLote;
  /** El servidor la rechazó por algo que no es la red (p. ej. admin ya
   *  cerró el lote): ya no se reintenta sola. */
  error?: string;
};

export type RecepcionLoteLocal = {
  negocioId: string;
  loteId: string;
  conteo: ConteoLote;
  selladas: SesionSellada[];
};

type RecepcionState = {
  lotes: Record<string, RecepcionLoteLocal>;

  setConteo: (negocioId: string, loteId: string, conteo: ConteoLote) => void;
  /** Sella lo contado como sesión por subir y deja el conteo en blanco.
   *  `null` si no hay nada contado. */
  sellar: (negocioId: string, loteId: string, meta: MetaSesionLote) => SesionSellada | null;
  /** Para "Reintentar": quita el error y la vuelve a poner en la fila. */
  limpiarError: (negocioId: string, loteId: string, sesionId: string) => void;
  /** Borra de la tablet una sellada que el servidor no aceptó (a mano). */
  descartarSellada: (negocioId: string, loteId: string, sesionId: string) => void;
};

export const llaveRecepcion = (negocioId: string, loteId: string) => `${negocioId}|${loteId}`;

const NOMBRE_GUARDADO = "amise_nodo_recepcion_lotes";

/** Constantes para los selectores: devolver uno nuevo cada vez haría que
 *  zustand vuelva a pintar sin fin. */
const CONTEO_VACIO: ConteoLote = conteoLoteVacio();
const SIN_SELLADAS: SesionSellada[] = [];

/** Quita los lotes que ya no tienen nada en la tablet. */
function podar(lotes: Record<string, RecepcionLoteLocal>): Record<string, RecepcionLoteLocal> {
  const out: Record<string, RecepcionLoteLocal> = {};
  for (const [k, l] of Object.entries(lotes)) {
    if (l.selladas.length > 0 || !conteoLoteEstaVacio(l.conteo)) out[k] = l;
  }
  return out;
}

export const useRecepcionLotes = create<RecepcionState>()(
  persist(
    (set, get) => {
      /** Cambia la sellada `sesionId` de un lote (o la quita con `null`). */
      const cambiarSellada = (
        negocioId: string,
        loteId: string,
        sesionId: string,
        fn: (s: SesionSellada) => SesionSellada | null,
      ) =>
        set((st) => {
          const k = llaveRecepcion(negocioId, loteId);
          const l = st.lotes[k];
          if (!l) return {};
          const selladas: SesionSellada[] = [];
          for (const s of l.selladas) {
            const n = s.sesionId === sesionId ? fn(s) : s;
            if (n) selladas.push(n);
          }
          return { lotes: podar({ ...st.lotes, [k]: { ...l, selladas } }) };
        });

      return {
        lotes: {},

        setConteo: (negocioId, loteId, conteo) =>
          set((st) => {
            const k = llaveRecepcion(negocioId, loteId);
            const l = st.lotes[k] ?? { negocioId, loteId, conteo: CONTEO_VACIO, selladas: [] };
            return { lotes: podar({ ...st.lotes, [k]: { ...l, conteo } }) };
          }),

        sellar: (negocioId, loteId, meta) => {
          const k = llaveRecepcion(negocioId, loteId);
          const l = get().lotes[k];
          if (!l || conteoLoteEstaVacio(l.conteo)) return null;
          const sellada: SesionSellada = { sesionId: "s" + generarID(), conteo: l.conteo, meta };
          set((st) => ({
            lotes: {
              ...st.lotes,
              [k]: { ...l, conteo: CONTEO_VACIO, selladas: [...l.selladas, sellada] },
            },
          }));
          return sellada;
        },

        limpiarError: (negocioId, loteId, sesionId) =>
          cambiarSellada(negocioId, loteId, sesionId, ({ error: _e, ...s }) => s),

        descartarSellada: (negocioId, loteId, sesionId) =>
          cambiarSellada(negocioId, loteId, sesionId, () => null),
      };
    },
    {
      name: NOMBRE_GUARDADO,
      version: 1,
      partialize: (s) => ({ lotes: s.lotes }),
    },
  ),
);

// Otra pestaña cambió lo guardado: se vuelve a leer antes de escribir encima.
// (El evento solo llega a las DEMÁS pestañas, nunca a la que escribió.)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === NOMBRE_GUARDADO || e.key === null) {
      void useRecepcionLotes.persist.rehydrate();
    }
  });
}

/** Lo que no se guarda: el estado de la subida en ESTA pestaña. */
type SubidaState = {
  /** Hay una subida en curso. */
  subiendo: boolean;
  /** La última vuelta se cortó por falta de conexión. */
  sinRed: boolean;
  /** Última subida buena de cada lote (para decir qué entró). */
  ultimaSubida: Record<string, { sesionId: string; resultado: ResultadoSubidaLote }>;
};

export const useSubidaLotes = create<SubidaState>()(() => ({
  subiendo: false,
  sinRed: false,
  ultimaSubida: {},
}));

/** Lo escaneado (sin terminar) de un lote. */
export function useConteoLote(negocioId: string | null, loteId: string): ConteoLote {
  return useRecepcionLotes((s) =>
    negocioId ? s.lotes[llaveRecepcion(negocioId, loteId)]?.conteo ?? CONTEO_VACIO : CONTEO_VACIO,
  );
}

/** Sesiones de un lote selladas en la tablet y aún sin subir. */
export function useSelladasLote(negocioId: string | null, loteId: string): SesionSellada[] {
  return useRecepcionLotes((s) =>
    negocioId
      ? s.lotes[llaveRecepcion(negocioId, loteId)]?.selladas ?? SIN_SELLADAS
      : SIN_SELLADAS,
  );
}

// ============================================================
// Subida de las selladas
// ============================================================

/** Errores del servidor que se arreglan solos (red, sesión renovándose,
 *  choque de transacciones): se reintenta después. */
const CODIGOS_PASAJEROS = new Set([
  "unavailable",
  "deadline-exceeded",
  "aborted",
  "unauthenticated",
  "resource-exhausted",
  "internal",
  "cancelled",
]);

function esPasajero(e: unknown): boolean {
  if (esFallaDeRed(e)) return true;
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && CODIGOS_PASAJEROS.has(code);
}

function mensajeDeError(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "permission-denied") {
    return "El servidor no aceptó la recepción (permisos). Avísale a admin.";
  }
  return e instanceof Error && e.message ? e.message : String(e);
}

let enCurso: Promise<void> | null = null;
let encolada: Promise<void> | null = null;

/** Sube las selladas pendientes, de una en una y en orden. Si ya hay una
 *  vuelta en curso, se encola UNA más para cuando termine (la comparten
 *  todos los que llamen mientras tanto): nada se queda sin intentar y nunca
 *  hay dos subidas a la vez. */
export function subirPendientes(): Promise<void> {
  if (!enCurso) {
    enCurso = vueltaDeSubida()
      .catch((e) => console.error("Subida de recepciones:", e))
      .finally(() => {
        enCurso = null;
      });
    return enCurso;
  }
  if (!encolada) {
    encolada = enCurso.then(() => {
      encolada = null;
      return subirPendientes();
    });
  }
  return encolada;
}

async function vueltaDeSubida(): Promise<void> {
  // Sin sesión de Firebase el servidor contestaría "permisos" y la sellada
  // quedaría marcada como rechazada: se espera a que la caja entre.
  if (!auth.currentUser) return;
  const st = useRecepcionLotes;
  const subida = useSubidaLotes;
  const intentadas = new Set<string>();
  subida.setState({ subiendo: true });
  try {
    for (;;) {
      // Se vuelve a leer en cada paso: lo sellado mientras sube también entra.
      let siguiente: { l: RecepcionLoteLocal; s: SesionSellada } | null = null;
      for (const l of Object.values(st.getState().lotes)) {
        const s = l.selladas.find((x) => !x.error && !intentadas.has(x.sesionId));
        if (s) {
          siguiente = { l, s };
          break;
        }
      }
      if (!siguiente) {
        subida.setState({ sinRed: false });
        return;
      }
      const { l, s } = siguiente;
      intentadas.add(s.sesionId);
      try {
        const resultado = await subirSesionLote({
          negocioId: l.negocioId,
          loteId: l.loteId,
          sesionId: s.sesionId,
          conteo: s.conteo,
          meta: s.meta,
        });
        // Contestó bien (también `yaEstaba` o `vacia`): ya no vive aquí.
        st.getState().descartarSellada(l.negocioId, l.loteId, s.sesionId);
        subida.setState((x) => ({
          ultimaSubida: {
            ...x.ultimaSubida,
            [llaveRecepcion(l.negocioId, l.loteId)]: { sesionId: s.sesionId, resultado },
          },
        }));
      } catch (e) {
        if (esPasajero(e)) {
          // Sin red no tiene caso intentar las demás: se sigue después.
          console.warn("Recepción de lote pendiente de subir:", e);
          subida.setState({ sinRed: true });
          return;
        }
        console.error("Recepción de lote rechazada:", e);
        const error = mensajeDeError(e);
        st.setState((x) => {
          const k = llaveRecepcion(l.negocioId, l.loteId);
          const lote = x.lotes[k];
          if (!lote) return {};
          return {
            lotes: {
              ...x.lotes,
              [k]: {
                ...lote,
                selladas: lote.selladas.map((y) =>
                  y.sesionId === s.sesionId ? { ...y, error } : y,
                ),
              },
            },
          };
        });
      }
    }
  } finally {
    subida.setState({ subiendo: false });
  }
}

/** Cada cuánto se reintenta lo pendiente aunque no cambie nada. */
const REINTENTO_MS = 60_000;

/**
 * Reintenta las selladas pendientes: al montarse, al volver la red, cuando la
 * caja entra a Firebase y cada minuto. Va montado en `App` (se sube aunque
 * la caja esté vendiendo) y en la pantalla del lote (intenta al abrirla).
 */
export function useSubirSesiones() {
  useEffect(() => {
    const intentar = () => {
      void subirPendientes();
    };
    intentar();
    window.addEventListener("online", intentar);
    const reloj = setInterval(intentar, REINTENTO_MS);
    const sinAuth = onAuthStateChanged(auth, (u) => {
      if (u) intentar();
    });
    return () => {
      window.removeEventListener("online", intentar);
      clearInterval(reloj);
      sinAuth();
    };
  }, []);
}

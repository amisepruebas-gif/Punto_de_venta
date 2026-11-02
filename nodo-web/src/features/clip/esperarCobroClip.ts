import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { cobroClipFinal, paths, type CobroClip } from "@shared";
import { db } from "@/firebase/config";
import { fnConsultarCobroClip } from "@/firebase/callable";

/** Del doc del cobro (lo escribe el servidor) a lo que ve la caja. */
function aCobro(cobroId: string, d: DocumentData): CobroClip {
  return {
    cobroId,
    estado: d.estado,
    intento: Number(d.intento) || 0,
    monto: String(d.monto ?? ""),
    montoCentavos: Number(d.montoCentavos) || 0,
    pinpadRequestId: d.pinpadRequestId ?? null,
    tarjeta: d.tarjeta ?? null,
    pagadoCentavos: Number(d.pagadoCentavos) || 0,
    alerta: d.alerta ?? null,
    error: d.error ?? null,
    actualizadoEn: d.actualizadoEn ?? null,
  };
}

/**
 * Sigue un cobro en la terminal hasta que termina (aprobado, fallido,
 * cancelado o revisar). Escucha el doc del cobro y, como respaldo del aviso
 * de Clip (que se manda una sola vez), consulta cada 3 s el primer minuto y
 * luego cada 10 s. `onCambio` recibe los estados intermedios. Lo de un
 * intento anterior a `intento` se ignora: al reintentar, la caché del doc
 * todavía trae el rechazo del intento previo.
 */
export function esperarCobroClip(opts: {
  negocioId: string;
  sucursalId: string;
  cobroId: string;
  intento: number;
  onCambio: (c: CobroClip) => void;
  signal: AbortSignal;
}): Promise<CobroClip> {
  const { negocioId, sucursalId, cobroId, intento, onCambio, signal } = opts;
  return new Promise<CobroClip>((resolve, reject) => {
    const inicio = Date.now();
    let listo = false;
    let timer: number | undefined;
    let dejarDeEscuchar = () => {};

    const cerrar = () => {
      listo = true;
      dejarDeEscuchar();
      window.clearTimeout(timer);
      signal.removeEventListener("abort", alCancelar);
    };
    const ver = (c: CobroClip) => {
      if (listo || c.intento < intento) return;
      if (cobroClipFinal(c.estado)) {
        cerrar();
        resolve(c);
      } else {
        onCambio(c);
      }
    };
    const consultar = async () => {
      if (listo) return;
      try {
        ver((await fnConsultarCobroClip({ cobroId })).data);
      } catch {
        /* sin red: la siguiente consulta lo intenta otra vez */
      }
      if (listo) return;
      timer = window.setTimeout(consultar, Date.now() - inicio < 60_000 ? 3000 : 10_000);
    };
    const alCancelar = () => {
      if (listo) return;
      cerrar();
      reject(new DOMException("Se dejó de esperar el cobro", "AbortError"));
    };

    if (signal.aborted) return alCancelar();
    signal.addEventListener("abort", alCancelar);
    dejarDeEscuchar = onSnapshot(
      doc(db, paths.pagoClip(negocioId, sucursalId, cobroId)),
      (snap) => {
        if (snap.exists()) ver(aCobro(cobroId, snap.data()));
      },
      () => {
        /* sin permiso o sin red: las consultas siguen */
      },
    );
    timer = window.setTimeout(consultar, 3000);
  });
}

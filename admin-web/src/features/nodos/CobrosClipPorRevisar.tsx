import { useCallback, useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/firebase/config";
import { COL_NEGOCIOS, COL_SUCURSALES_DATA, etiquetaTarjetaClip, type TarjetaClip } from "@shared";

/** Un cobro con terminal que alguien tiene que revisar en Clip. */
type CobroPorRevisar = {
  cobroId: string;
  nodoId: string;
  sucursalId: string;
  monto: string;
  estado: string;
  tarjeta: TarjetaClip | null;
  creadoEn: number;
  motivo: string;
};

type DocCobro = {
  cobroId: string;
  nodoId: string;
  sucursalId: string;
  monto: string;
  estado: string;
  tarjeta?: TarjetaClip | null;
  alerta?: string | null;
  aprobacionesExtra?: unknown[];
  pagoTardio?: unknown;
  creadoEn: number;
  actualizadoEn?: number;
};

const MOTIVOS: Record<string, string> = {
  "pago-de-mas": "la terminal cobró de más",
  "pago-de-menos": "la terminal cobró de menos",
  "varias-aprobaciones": "más de una aprobación (posible cobro doble)",
  "aprobado-tarde": "Clip aprobó un intento que ya se daba por cerrado",
  "completado-sin-pago": "Clip lo dio por completado sin pago",
  "pago-en-intento-cerrado": "pago en un intento que Clip cerró",
};

const MIN = 60_000;

/** ¿Por qué hay que revisarlo? null si está bien. */
function motivoDe(c: DocCobro, ahora: number, sinVenta: boolean): string | null {
  if (c.alerta) return MOTIVOS[c.alerta] ?? c.alerta;
  if ((c.aprobacionesExtra?.length ?? 0) > 0) return MOTIVOS["varias-aprobaciones"];
  if (c.estado === "revisar") return "el cobro no cuadra con la venta";
  if (c.estado === "manual") return "confirmado a mano en la terminal, sin verificar con Clip";
  if (sinVenta) return "cobrado con tarjeta, pero no hay venta guardada";
  const abierto = ["enviando", "pendiente", "incierto"].includes(c.estado);
  if (abierto && ahora - (c.actualizadoEn ?? c.creadoEn) > 30 * MIN) {
    return c.estado === "incierto"
      ? "no se supo si la terminal lo recibió"
      : "quedó abierto en la terminal";
  }
  return null;
}

/**
 * Cobros con la terminal Clip de los últimos días que piden revisión en el
 * portal de Clip: cobro doble o de más, aprobado sin venta (el cajero ya había
 * cobrado de otra forma), confirmado a mano o abierto sin resolver. Lo normal
 * es que esta lista esté vacía.
 */
export function CobrosClipPorRevisar({
  negocioId,
  sucursales,
  nombreCaja,
}: {
  negocioId: string;
  sucursales: Array<{ sucursalId: string; nombre: string }>;
  nombreCaja: (nodoId: string) => string;
}) {
  const [items, setItems] = useState<CobroPorRevisar[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const ahora = Date.now();
      const out: CobroPorRevisar[] = [];
      for (const s of sucursales) {
        const snap = await getDocs(
          query(
            collection(
              db,
              `${COL_NEGOCIOS}/${negocioId}/${COL_SUCURSALES_DATA}/${s.sucursalId}/pagos_clip_web_new_version`,
            ),
            orderBy("creadoEn", "desc"),
            limit(40),
          ),
        );
        for (const d of snap.docs) {
          const c = d.data() as DocCobro;
          // Aprobado hace rato: ¿se guardó su venta? (ventaId = cobroId)
          let sinVenta = false;
          if (c.estado === "aprobado" && !c.alerta && ahora - c.creadoEn > 10 * MIN) {
            const v = await getDocs(
              query(
                collectionGroup(db, "items"),
                where("negocioId", "==", negocioId),
                where("ventaId", "==", c.cobroId),
                where("sucursalId", "==", c.sucursalId),
                where("nodoId", "==", c.nodoId),
                limit(1),
              ),
            );
            sinVenta = v.empty;
          }
          const motivo = motivoDe(c, ahora, sinVenta);
          if (motivo) {
            out.push({
              cobroId: c.cobroId,
              nodoId: c.nodoId,
              sucursalId: c.sucursalId,
              monto: c.monto,
              estado: c.estado,
              tarjeta: c.tarjeta ?? null,
              creadoEn: c.creadoEn,
              motivo,
            });
          }
        }
      }
      out.sort((a, b) => b.creadoEn - a.creadoEn);
      setItems(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [negocioId, sucursales]);

  useEffect(() => {
    if (sucursales.length > 0) void cargar();
  }, [cargar, sucursales.length]);

  return (
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Cobros con terminal por revisar</h2>
          <p className="text-xs text-muted-foreground">
            Lo que haya aquí se revisa (y si toca, se devuelve) en el portal de Clip.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando}>
          <RefreshCw className={`mr-1 h-3 w-3 ${cargando ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">No se pudo revisar: {error}</p>}
      {items && items.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Nada que revisar.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y text-sm">
          {items.map((c) => (
            <li key={c.cobroId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <span className="font-medium tabular-nums">${Number(c.monto).toLocaleString("es-MX")}</span>
              <span className="text-muted-foreground">
                {new Date(c.creadoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                {" · "}
                {nombreCaja(c.nodoId)}
                {c.tarjeta ? ` · ${etiquetaTarjetaClip(c.tarjeta)}` : ""}
              </span>
              <span className="w-full text-amber-800">{c.motivo}</span>
              <span className="w-full font-mono text-[11px] text-muted-foreground">venta {c.cobroId}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

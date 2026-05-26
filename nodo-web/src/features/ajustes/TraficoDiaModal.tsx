import { useEffect, useMemo, useState } from "react";
import { Cloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chainPartes,
  expandirDescargas,
  traficoStorage,
  type Descarga,
  type TraficoColeccion,
  type TraficoDia,
} from "@/lib/firestoreStats";

type Props = {
  ymd: string | null;
  onClose: () => void;
};

/**
 * Modal con el detalle del tráfico Firestore de un día concreto:
 *   - Resumen (servidor / cache).
 *   - Tabla por colección.
 *   - **Documentos descargados** — lista agrupada por (path, docId) con
 *     cantidad de descargas y desglose cache/servidor.
 */
export function TraficoDiaModal({ ymd, onClose }: Props) {
  const [dia, setDia] = useState<TraficoDia | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ymd) return;
    let cancelled = false;
    setLoading(true);
    traficoStorage
      .leer(ymd)
      .then((d) => {
        if (!cancelled) {
          setDia(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ymd]);

  const colecciones = dia
    ? Object.values(dia.porColeccion).sort(
        (a, b) => b.docsServer + b.docsCache - (a.docsServer + a.docsCache),
      )
    : [];

  const descargas = useMemo(
    () => (dia ? expandirDescargas(dia.eventos) : []),
    [dia],
  );

  if (!ymd) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-[36rem] max-w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Tráfico del {ymd}</h2>
            {dia && (
              <p className="text-xs text-muted-foreground">
                {dia.totalEventos} snapshots · {dia.totalDocsServidor} docs
                desde servidor · {dia.totalDocsCache} desde cache
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : !dia || dia.totalEventos === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin tráfico registrado este día.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4">
                <Cloud className="h-8 w-8 shrink-0 text-blue-600" />
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-blue-700">
                    Docs descargados de la red
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-blue-900">
                    {dia.totalDocsServidor.toLocaleString("es-MX")}
                  </p>
                </div>
              </div>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">
                Por colección
              </h3>
              <ul className="space-y-2">
                {colecciones.map((c) => (
                  <ColeccionRow key={c.path} c={c} />
                ))}
              </ul>

              <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">
                Descargas ({descargas.length})
              </h3>
              {descargas.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-muted-foreground">
                  Sin descargas registradas (eventos viejos sin IDs).
                </p>
              ) : (
                <ul className="space-y-1">
                  {descargas.map((d, i) => (
                    <DescargaRow key={i} d={d} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ColeccionRow({ c }: { c: TraficoColeccion }) {
  return (
    <li className="rounded-md border bg-card p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-mono text-xs font-semibold">{c.path}</p>
        <p className="shrink-0 text-[10px] text-muted-foreground">
          {c.snapshots} snap{c.snapshots === 1 ? "" : "s"}
        </p>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-2 text-[11px]">
        <Stat label="Server" valor={c.docsServer} color="text-blue-700" />
        <Stat label="Cache" valor={c.docsCache} color="text-emerald-700" />
        <Stat
          label="Completas"
          valor={c.completas}
          color="text-orange-700"
        />
        <Stat label="Parciales" valor={c.parciales} color="text-violet-700" />
      </div>
    </li>
  );
}

function Stat({
  label,
  valor,
  color,
}: {
  label: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="leading-tight">
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{valor}</p>
    </div>
  );
}

function DescargaRow({ d }: { d: Descarga }) {
  const partes = chainPartes(d.path, d.docId);
  const hora = new Date(d.ts).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <li className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {hora}
      </span>
      <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
        {partes.map((p, i) => (
          <span key={i} className="contents">
            <span
              className={`rounded px-1.5 py-0.5 ${
                i === partes.length - 1
                  ? "bg-blue-100 text-blue-800 font-semibold"
                  : "bg-muted text-foreground"
              }`}
            >
              {p}
            </span>
            {i < partes.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </span>
        ))}
      </div>
    </li>
  );
}

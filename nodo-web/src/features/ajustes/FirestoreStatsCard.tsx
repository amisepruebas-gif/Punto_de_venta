import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Cloud,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chainPartes,
  expandirDescargas,
  useFirestoreStats,
  type Descarga,
  type TraficoColeccion,
} from "@/lib/firestoreStats";
import { ymdMX } from "@shared";
import { TraficoCalendarioMesModal } from "./TraficoCalendarioMesModal";
import { TraficoDiaModal } from "./TraficoDiaModal";

/**
 * Card detallada de tráfico Firestore — día actual con desglose por
 * colección, totales server vs cache, y acceso al historial diario
 * (calendario por meses).
 */
export function FirestoreStatsCard() {
  const dia = useFirestoreStats((s) => s.diaActual);
  const reset = useFirestoreStats((s) => s.reset);
  const [calendarioOpen, setCalendarioOpen] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const colecciones = Object.values(dia.porColeccion).sort(
    (a, b) => b.docsServer + b.docsCache - (a.docsServer + a.docsCache),
  );
  const totalCompletas = colecciones.reduce((acc, c) => acc + c.completas, 0);
  const totalParciales = colecciones.reduce((acc, c) => acc + c.parciales, 0);

  const descargas = useMemo(
    () => expandirDescargas(dia.eventos),
    [dia.eventos],
  );

  const hoy = ymdMX();

  return (
    <>
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">Tráfico Firestore · Hoy</h3>
            <p className="text-xs text-muted-foreground">
              Snapshots de hoy. Histórico persiste 90 días.
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalendarioOpen(true)}
              title="Ver historial por días"
            >
              <CalendarIcon className="mr-1 h-3 w-3" /> Historial
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              title="Reiniciar contadores del día actual"
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
          </div>
        </div>

        {/* Cifra principal: docs realmente bajados de la red. Solo cuenta
            los `added + modified` de los snapshots no-cache (los que en
            verdad transfirieron datos). Lo demás son lecturas locales. */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4">
          <Cloud className="h-8 w-8 shrink-0 text-blue-600" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-blue-700">
              Docs descargados de la red hoy
            </p>
            <p className="text-3xl font-bold tabular-nums text-blue-900">
              {dia.totalDocsServidor.toLocaleString("es-MX")}
            </p>
          </div>
        </div>

        {/* Stats secundarios */}
        <div className="grid grid-cols-3 gap-2">
          <Chip
            label="Snapshots"
            valor={dia.totalEventos}
            color="text-foreground"
          />
          <Chip
            label="Completas"
            valor={totalCompletas}
            color="text-orange-700"
          />
          <Chip
            label="Parciales"
            valor={totalParciales}
            color="text-violet-700"
          />
        </div>

        {dia.totalEventos === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Sin snapshots registrados todavía.
          </p>
        )}

        {/* Desglose por colección */}
        {colecciones.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Por colección
            </h4>
            <ul className="space-y-1.5">
              {colecciones.map((c) => (
                <ColeccionFila key={c.path} c={c} />
              ))}
            </ul>
          </div>
        )}

        {/* Timeline de descargas individuales — una fila por documento
            bajado del servidor (más reciente arriba). Estilo "ventas":
            hora + path completo del doc. */}
        {descargas.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Descargas ({descargas.length})
            </h4>
            <ul className="space-y-1">
              {descargas.slice(0, 200).map((d, i) => (
                <DescargaFila key={i} d={d} />
              ))}
              {descargas.length > 200 && (
                <li className="text-center text-[11px] text-muted-foreground">
                  Mostrando 200 de {descargas.length}.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <TraficoCalendarioMesModal
        open={calendarioOpen}
        yInicial={hoy.y}
        mInicial={hoy.m}
        onClose={() => setCalendarioOpen(false)}
        onElegirDia={(ymd) => {
          setCalendarioOpen(false);
          setDiaSeleccionado(ymd);
        }}
      />

      <TraficoDiaModal
        ymd={diaSeleccionado}
        onClose={() => setDiaSeleccionado(null)}
      />
    </>
  );
}

function Chip({
  label,
  valor,
  color,
}: {
  label: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {valor.toLocaleString("es-MX")}
      </p>
    </div>
  );
}

function ColeccionFila({ c }: { c: TraficoColeccion }) {
  return (
    <li className="rounded-md border p-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-mono text-[12px] font-semibold">{c.path}</p>
        <p className="shrink-0 text-[10px] text-muted-foreground">
          {c.snapshots} snap{c.snapshots === 1 ? "" : "s"}
        </p>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-2 text-[11px]">
        <Stat label="Server" valor={c.docsServer} color="text-blue-700" />
        <Stat label="Cache" valor={c.docsCache} color="text-emerald-700" />
        <Stat label="Compl." valor={c.completas} color="text-orange-700" />
        <Stat label="Parc." valor={c.parciales} color="text-violet-700" />
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

function DescargaFila({ d }: { d: Descarga }) {
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

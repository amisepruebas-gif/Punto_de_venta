import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  filtrarPorDia,
  filtrarPorMes,
  totalesPorDia,
  useGastosNanobanana,
  type GastoEvento,
} from "@/features/gastos/useGastosNanobanana";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function diasEnMes(y: number, mIndex0: number): number {
  return new Date(y, mIndex0 + 1, 0).getDate();
}

function diaSemanaInicio(y: number, mIndex0: number): number {
  return new Date(y, mIndex0, 1).getDay();
}

function fmtMxn(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  });
}

function fmtMxnCompacto(n: number): string {
  if (n < 100) return n.toFixed(2);
  return n.toFixed(0);
}

/**
 * Reporte de gastos del API de Gemini 2.5 Flash Image (Nano Banana).
 * UI estilo "ventas":
 *   - Card grande con total del mes en MXN.
 *   - Calendario con totales por día.
 *   - Modal al hacer click en un día con la lista de items procesados.
 */
export function NanobananaPage() {
  const { eventos, loading } = useGastosNanobanana();
  const hoy = new Date();
  const [y, setY] = useState(hoy.getFullYear());
  const [m, setM] = useState(hoy.getMonth() + 1);
  const [diaAbierto, setDiaAbierto] = useState<number | null>(null);

  const mIndex0 = m - 1;
  const totalDiasMes = useMemo(() => diasEnMes(y, mIndex0), [y, mIndex0]);
  const offsetInicio = useMemo(
    () => diaSemanaInicio(y, mIndex0),
    [y, mIndex0],
  );

  const eventosMes = useMemo(
    () => filtrarPorMes(eventos, y, m),
    [eventos, y, m],
  );
  const totalesDia = useMemo(() => totalesPorDia(eventosMes), [eventosMes]);
  const totalMesMxn = useMemo(
    () => eventosMes.reduce((acc, e) => acc + (e.registro.costoMxn || 0), 0),
    [eventosMes],
  );
  const totalMesUsd = useMemo(
    () => eventosMes.reduce((acc, e) => acc + (e.registro.costoUsd || 0), 0),
    [eventosMes],
  );

  function avanzarMes() {
    if (m === 12) {
      setY(y + 1);
      setM(1);
    } else setM(m + 1);
  }
  function retrocederMes() {
    if (m === 1) {
      setY(y - 1);
      setM(12);
    } else setM(m - 1);
  }

  // Grid 7×6 fijo (mismo patrón que CalendarioMesModal de ventas).
  const TOTAL_CELDAS = 42;
  const celdas: Array<{ d: number | null }> = [];
  for (let i = 0; i < offsetInicio; i++) celdas.push({ d: null });
  for (let i = 1; i <= totalDiasMes; i++) celdas.push({ d: i });
  while (celdas.length < TOTAL_CELDAS) celdas.push({ d: null });

  return (
    <div className="container max-w-4xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <Link
          to="/gastos-firebase"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Gastos
        </Link>
      </div>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Sparkles className="h-5 w-5 text-fuchsia-600" />
          API Nano Banana (Gemini)
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Costo aproximado de las imágenes procesadas por Gemini 2.5 Flash
          Image. Cada operación "Quitar fondo" cuesta ~$0.039 USD.
        </p>
      </div>

      {/* Resumen del mes */}
      <div className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={retrocederMes}
            aria-label="Mes anterior"
            className="h-9 w-9"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="flex-1 text-center text-base font-semibold">
            {NOMBRES_MES[mIndex0]} {y}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={avanzarMes}
            aria-label="Mes siguiente"
            className="h-9 w-9"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[11px] uppercase tracking-wider text-fuchsia-700">
            Total del mes
          </p>
          <p className="text-3xl font-bold tabular-nums text-fuchsia-900">
            {fmtMxn(totalMesMxn)}
          </p>
          <p className="text-[11px] text-fuchsia-700">
            ≈ ${totalMesUsd.toFixed(2)} USD · {eventosMes.length} imagen
            {eventosMes.length === 1 ? "" : "es"} procesada
            {eventosMes.length === 1 ? "" : "s"}
          </p>
          {loading && (
            <p className="mt-1 text-[11px] text-muted-foreground">Cargando…</p>
          )}
        </div>
      </div>

      {/* Calendario */}
      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
          {DIAS_SEMANA.map((nombre, i) => (
            <span key={i}>{nombre}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, idx) => {
            if (c.d === null) {
              return <div key={idx} className="h-16" />;
            }
            const dato = totalesDia.get(c.d);
            const tieneGasto = !!dato && dato.count > 0;
            return (
              <button
                key={idx}
                type="button"
                disabled={!tieneGasto}
                onClick={() => {
                  if (tieneGasto) setDiaAbierto(c.d);
                }}
                className={`flex h-16 flex-col items-center justify-center rounded-md border text-xs transition ${
                  tieneGasto
                    ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100"
                    : "border-border/50 bg-muted/30 text-muted-foreground"
                }`}
              >
                <span
                  className={`text-sm font-bold leading-none ${
                    tieneGasto ? "text-fuchsia-800" : "text-muted-foreground"
                  }`}
                >
                  {c.d}
                </span>
                {tieneGasto && (
                  <span className="mt-0.5 text-[9px] font-semibold leading-none tabular-nums">
                    ${fmtMxnCompacto(dato.mxn)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <DiaModal
        y={y}
        m={m}
        d={diaAbierto}
        eventos={eventos}
        onClose={() => setDiaAbierto(null)}
      />
    </div>
  );
}

function DiaModal({
  y,
  m,
  d,
  eventos,
  onClose,
}: {
  y: number;
  m: number;
  d: number | null;
  eventos: GastoEvento[];
  onClose: () => void;
}) {
  const eventosDia = useMemo(
    () => (d != null ? filtrarPorDia(eventos, y, m, d) : []),
    [eventos, y, m, d],
  );
  const totalMxn = eventosDia.reduce(
    (acc, e) => acc + (e.registro.costoMxn || 0),
    0,
  );

  if (d == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
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
            <h2 className="font-semibold">
              {d} de {NOMBRES_MES[m - 1]} {y}
            </h2>
            <p className="text-xs text-muted-foreground">
              {eventosDia.length} imagen{eventosDia.length === 1 ? "" : "es"}{" "}
              · Total{" "}
              <span className="font-semibold text-fuchsia-700">
                {fmtMxn(totalMxn)}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {eventosDia.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin gastos en este día.
            </p>
          ) : (
            <ul className="space-y-2">
              {eventosDia.map((e, i) => (
                <EventoRow key={i} ev={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EventoRow({ ev }: { ev: GastoEvento }) {
  const r = ev.registro;
  const hora = new Date(r.fecha).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <li className="flex items-center gap-3 rounded-md border bg-card p-2.5">
      {r.imagenUrl ? (
        <img
          src={r.imagenUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">
          —
        </div>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <Link
          to={`/articulos/${ev.articuloId}`}
          className="block min-w-0"
        >
          <p className="truncate text-sm font-semibold hover:underline">
            {ev.articuloNombre}
            {ev.subvariacionNombre ? ` — ${ev.subvariacionNombre}` : ""}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            #{ev.articuloId}
            {ev.subvariacionCodigo
              ? ` · ${ev.subvariacionCodigo}`
              : ""}
            {" · "}
            {hora}
            {r.emailUsuario ? ` · ${r.emailUsuario}` : ""}
          </p>
        </Link>
      </div>
      <div className="shrink-0 text-right leading-tight">
        <p className="text-sm font-bold tabular-nums text-fuchsia-700">
          {fmtMxn(r.costoMxn || 0)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          ${(r.costoUsd || 0).toFixed(3)} USD · TC {r.tipoCambio}
        </p>
      </div>
    </li>
  );
}

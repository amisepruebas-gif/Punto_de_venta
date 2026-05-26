import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useVentasMes } from "./useVentasMes";

type Props = {
  open: boolean;
  /** Año/mes inicial al abrir (defaults: hoy MX). */
  yInicial: string;
  mInicial: string;
  onClose: () => void;
  /** Callback al elegir un día con ventas. */
  onElegirDia: (y: string, m: string, d: string) => void;
};

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
  // 0 = domingo
  return new Date(y, mIndex0, 1).getDay();
}

function fmt(n: number): string {
  if (n < 1000) return `$${n}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString("es-MX")}`;
}

/**
 * Modal que muestra el calendario del mes con totales por día. Replica el
 * comportamiento del ViewPager `adapterModel.java` Android:
 *   - Total del mes en grande arriba.
 *   - Grid 7 columnas con día del mes + monto vendido.
 *   - Días con ventas: borde rojo + texto rojo (clase de Tailwind).
 *   - Días sin ventas: gris claro.
 *   - Click en día con ventas → llama `onElegirDia(y, m, d)`.
 *
 * Navegación entre meses con flechas izq/der.
 */
export function CalendarioMesModal({
  open,
  yInicial,
  mInicial,
  onClose,
  onElegirDia,
}: Props) {
  const { negocioId, sucursalId } = useNodoSession();
  const [y, setY] = useState(yInicial);
  const [m, setM] = useState(mInicial);

  // Si yInicial/mInicial cambian (ej. el padre cambia de día), reseteamos.
  // Solo cuando se abre — sin tocar el mes seleccionado mientras está abierto.
  // (Ese efecto vive en el padre normalmente; aquí mantenemos local.)

  const { resumen, totalMes, loading } = useVentasMes(
    negocioId,
    sucursalId,
    y,
    m,
  );

  const yNum = parseInt(y, 10);
  const mNum = parseInt(m, 10);
  const mIndex0 = mNum - 1;

  const totalDiasMes = useMemo(() => diasEnMes(yNum, mIndex0), [yNum, mIndex0]);
  const offsetInicio = useMemo(
    () => diaSemanaInicio(yNum, mIndex0),
    [yNum, mIndex0],
  );

  function avanzarMes() {
    if (mNum === 12) {
      setY(String(yNum + 1));
      setM("1");
    } else {
      setM(String(mNum + 1));
    }
  }

  function retrocederMes() {
    if (mNum === 1) {
      setY(String(yNum - 1));
      setM("12");
    } else {
      setM(String(mNum - 1));
    }
  }

  if (!open) return null;

  // Construir las celdas del grid. Siempre rellenamos a 42 celdas (7 cols × 6
  // filas) para que el modal mantenga el MISMO alto entre meses (28, 29, 30
  // o 31 días, con offset de 0–6). Sin esto, febrero "encogía" y enero/marzo
  // se estiraban un renglón extra cuando el día 1 caía en viernes/sábado.
  const TOTAL_CELDAS = 42;
  const celdas: Array<{ d: number | null }> = [];
  for (let i = 0; i < offsetInicio; i++) celdas.push({ d: null });
  for (let i = 1; i <= totalDiasMes; i++) celdas.push({ d: i });
  while (celdas.length < TOTAL_CELDAS) celdas.push({ d: null });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-[24rem] max-w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        {/* Header con flechas + nombre de mes + cerrar */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Total del mes en grande (replica `textView507` de Android) */}
        <div className="border-b bg-muted/40 px-4 py-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Total del mes
          </p>
          <p className="text-3xl font-bold tabular-nums text-emerald-700">
            {fmtFull(totalMes)}
          </p>
          {loading && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Cargando…
            </p>
          )}
        </div>

        {/* Grid del calendario */}
        <div className="overflow-y-auto p-3">
          {/* Header semana */}
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {DIAS_SEMANA.map((nombre, i) => (
              <span key={i}>{nombre}</span>
            ))}
          </div>

          {/* Días */}
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((c, idx) => {
              if (c.d === null) {
                return <div key={idx} className="h-14" />;
              }
              const dStr = String(c.d);
              const dato = resumen.get(dStr);
              const tieneVenta = !!dato && dato.total > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!tieneVenta}
                  onClick={() => {
                    if (tieneVenta) onElegirDia(y, m, dStr);
                  }}
                  className={`flex h-14 flex-col items-center justify-center rounded-md border text-xs transition ${
                    tieneVenta
                      ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-border/50 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`text-sm font-bold leading-none ${
                      tieneVenta ? "text-rose-700" : "text-muted-foreground"
                    }`}
                  >
                    {c.d}
                  </span>
                  {tieneVenta && (
                    <span className="mt-0.5 text-[9px] font-semibold leading-none tabular-nums">
                      {fmt(dato.total)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

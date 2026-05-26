import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { traficoStorage, type TraficoDia } from "@/lib/firestoreStats";

type Props = {
  open: boolean;
  yInicial: string;
  mInicial: string;
  onClose: () => void;
  onElegirDia: (ymd: string) => void;
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
  return new Date(y, mIndex0, 1).getDay();
}

function fmtCompacto(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * Calendario mensual para historial de tráfico Firestore. Mismo patrón
 * que `CalendarioMesModal` de Ventas: grid 7×6 fijo, marca días con
 * tráfico registrado (en azul), muestra cantidad de docs descargados
 * (server + cache) en cada celda.
 */
export function TraficoCalendarioMesModal({
  open,
  yInicial,
  mInicial,
  onClose,
  onElegirDia,
}: Props) {
  const [y, setY] = useState(yInicial);
  const [m, setM] = useState(mInicial);
  const [resumen, setResumen] = useState<Map<string, TraficoDia>>(new Map());
  const [loading, setLoading] = useState(false);

  const yNum = parseInt(y, 10);
  const mNum = parseInt(m, 10);
  const mIndex0 = mNum - 1;

  // Carga los días de este mes que tengan registro.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const dias = await traficoStorage.listarDias();
        const prefijo = `${y}-${String(mNum).padStart(2, "0")}`;
        const delMes = dias.filter((d) => d.startsWith(prefijo));
        const map = new Map<string, TraficoDia>();
        await Promise.all(
          delMes.map(async (ymd) => {
            const data = await traficoStorage.leer(ymd);
            if (data) map.set(ymd, data);
          }),
        );
        if (!cancelled) setResumen(map);
      } catch (e) {
        console.error("TraficoCalendarioMesModal:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, y, m, mNum]);

  const totalDiasMes = useMemo(() => diasEnMes(yNum, mIndex0), [yNum, mIndex0]);
  const offsetInicio = useMemo(
    () => diaSemanaInicio(yNum, mIndex0),
    [yNum, mIndex0],
  );

  const totalMes = useMemo(() => {
    let total = 0;
    resumen.forEach((d) => {
      total += d.totalDocsServidor + d.totalDocsCache;
    });
    return total;
  }, [resumen]);

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

        <div className="border-b bg-muted/40 px-4 py-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Total docs · mes
          </p>
          <p className="text-3xl font-bold tabular-nums text-blue-700">
            {totalMes.toLocaleString("es-MX")}
          </p>
          {loading && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Cargando…
            </p>
          )}
        </div>

        <div className="overflow-y-auto p-3">
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {DIAS_SEMANA.map((nombre, i) => (
              <span key={i}>{nombre}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celdas.map((c, idx) => {
              if (c.d === null) {
                return <div key={idx} className="h-14" />;
              }
              const ymd = `${y}-${String(mNum).padStart(2, "0")}-${String(
                c.d,
              ).padStart(2, "0")}`;
              const dato = resumen.get(ymd);
              const totalDia = dato
                ? dato.totalDocsServidor + dato.totalDocsCache
                : 0;
              const tieneTrafico = totalDia > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!tieneTrafico}
                  onClick={() => {
                    if (tieneTrafico) onElegirDia(ymd);
                  }}
                  className={`flex h-14 flex-col items-center justify-center rounded-md border text-xs transition ${
                    tieneTrafico
                      ? "border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "border-border/50 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`text-sm font-bold leading-none ${
                      tieneTrafico ? "text-blue-700" : "text-muted-foreground"
                    }`}
                  >
                    {c.d}
                  </span>
                  {tieneTrafico && (
                    <span className="mt-0.5 text-[9px] font-semibold leading-none tabular-nums">
                      {fmtCompacto(totalDia)}
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

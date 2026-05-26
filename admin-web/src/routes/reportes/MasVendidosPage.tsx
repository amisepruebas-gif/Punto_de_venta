import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { useVentasAdmin } from "@/features/ventas-admin/useVentasAdmin";
import { Button } from "@/components/ui/button";

type Rango = 7 | 30 | 90;

const KEY_SIN_VARIACION = "__sin__";

type DetalleVariacion = {
  /** `KEY_SIN_VARIACION` cuando la venta no llevó subvariación. */
  key: string;
  codigo?: string;
  nombre: string;
  cantidad: number;
  monto: number;
};

type Aggregado = {
  /** id del padre (8-dig). */
  id: string;
  nombre: string;
  cantidad: number;
  monto: number;
  /** Detalle por variación (incluido "(sin variación)" para ventas legacy). */
  porVariacion: Map<string, DetalleVariacion>;
};

export function MasVendidosPage() {
  const [rango, setRango] = useState<Rango>(30);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const desde = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (rango - 1));
    return d;
  }, [rango]);

  const { ventas, loading } = useVentasAdmin({ desde, limite: 5000 });

  const top = useMemo<Aggregado[]>(() => {
    const map = new Map<string, Aggregado>();
    for (const v of ventas) {
      for (const art of v.articulos) {
        const cant = Number(art.cantidad) || 0;
        const precio = Number(art.precio) || 0;
        const monto = cant * precio;

        let agg = map.get(art.id);
        if (!agg) {
          agg = {
            id: art.id,
            nombre: art.nombrePublico,
            cantidad: 0,
            monto: 0,
            porVariacion: new Map(),
          };
          map.set(art.id, agg);
        }
        agg.cantidad += cant;
        agg.monto += monto;

        const subKey = art.subvariacionCodigo ?? KEY_SIN_VARIACION;
        let det = agg.porVariacion.get(subKey);
        if (!det) {
          det = {
            key: subKey,
            codigo: art.subvariacionCodigo,
            nombre:
              art.subvariacionNombre ??
              (art.subvariacionCodigo
                ? art.subvariacionCodigo
                : "(sin variación)"),
            cantidad: 0,
            monto: 0,
          };
          agg.porVariacion.set(subKey, det);
        }
        det.cantidad += cant;
        det.monto += monto;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 30);
  }, [ventas]);

  function toggle(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="container max-w-4xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Más vendidos</h1>
        <p className="text-sm text-muted-foreground">
          Top 30 artículos por cantidad vendida. Expande para ver detalle por
          subvariación.
        </p>
      </div>

      <div className="flex gap-2">
        {([7, 30, 90] as Rango[]).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={rango === r ? "default" : "outline"}
            onClick={() => setRango(r)}
          >
            {r} días
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Agregando ventas…
        </p>
      ) : top.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sin ventas en el rango
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="w-12 px-2 py-2"></th>
                <th className="w-12 px-2 py-2">#</th>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Artículo</th>
                <th className="px-4 py-2 text-right">Cantidad</th>
                <th className="px-4 py-2 text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {top.map((a, i) => {
                const open = expandidas.has(a.id);
                const tieneVarios = a.porVariacion.size > 1;
                return (
                  <FilaPadre
                    key={a.id}
                    agg={a}
                    rank={i + 1}
                    open={open}
                    expandible={tieneVarios}
                    onToggle={() => toggle(a.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaPadre({
  agg,
  rank,
  open,
  expandible,
  onToggle,
}: {
  agg: Aggregado;
  rank: number;
  open: boolean;
  expandible: boolean;
  onToggle: () => void;
}) {
  const detalles = Array.from(agg.porVariacion.values()).sort(
    (a, b) => b.cantidad - a.cantidad,
  );
  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-2 py-2">
          {expandible && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={open ? "Contraer" : "Expandir"}
              className="rounded p-1 hover:bg-muted"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </td>
        <td className="px-2 py-2 text-muted-foreground">{rank}</td>
        <td className="px-4 py-2 font-mono text-xs">{agg.id}</td>
        <td className="px-4 py-2">{agg.nombre}</td>
        <td className="px-4 py-2 text-right font-semibold">{agg.cantidad}</td>
        <td className="px-4 py-2 text-right">${agg.monto.toFixed(0)}</td>
      </tr>
      {open &&
        detalles.map((det) => (
          <tr
            key={det.key}
            className="border-b bg-muted/30 last:border-0 text-xs"
          >
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5"></td>
            <td className="px-4 py-1.5 font-mono text-muted-foreground">
              {det.codigo ?? "—"}
            </td>
            <td className="px-4 py-1.5 text-muted-foreground">
              ↳ {det.nombre}
            </td>
            <td className="px-4 py-1.5 text-right">{det.cantidad}</td>
            <td className="px-4 py-1.5 text-right">
              ${det.monto.toFixed(0)}
            </td>
          </tr>
        ))}
    </>
  );
}

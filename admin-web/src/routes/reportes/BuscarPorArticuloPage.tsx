import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useVentasAdmin } from "@/features/ventas-admin/useVentasAdmin";
import { useArticulos } from "@/features/articulos/useArticulos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const FILTRO_TODAS = "";
const FILTRO_SIN_VARIACION = "__sin__";

export function BuscarPorArticuloPage() {
  const [dias, setDias] = useState(90);
  const [articuloIdBusqueda, setArticuloIdBusqueda] = useState("");
  const [filtroVariacion, setFiltroVariacion] = useState(FILTRO_TODAS);
  const { articulos } = useArticulos();

  const desde = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (dias - 1));
    return d;
  }, [dias]);

  const { ventas, loading } = useVentasAdmin({ desde, limite: 5000 });

  const articulo = articulos.find(
    (a) =>
      a.id === articuloIdBusqueda.trim() ||
      a.sigla?.toLowerCase() === articuloIdBusqueda.trim().toLowerCase(),
  );

  // Match item de venta contra filtros (artículo padre + opcional variación).
  function matchItem(a: { id: string; subvariacionCodigo?: string }) {
    if (a.id !== articulo?.id) return false;
    if (filtroVariacion === FILTRO_TODAS) return true;
    if (filtroVariacion === FILTRO_SIN_VARIACION) {
      return !a.subvariacionCodigo;
    }
    return a.subvariacionCodigo === filtroVariacion;
  }

  const ventasConArticulo = useMemo(() => {
    if (!articulo) return [];
    return ventas.filter((v) => v.articulos.some(matchItem));
  }, [ventas, articulo, filtroVariacion]);

  const resumen = useMemo(() => {
    if (!articulo) return null;
    let cantidad = 0;
    let ingresos = 0;
    // Desglose por variación cuando no hay filtro específico.
    const desglose = new Map<
      string,
      { codigo?: string; nombre: string; cantidad: number; ingresos: number }
    >();
    for (const v of ventasConArticulo) {
      for (const a of v.articulos) {
        if (!matchItem(a)) continue;
        const cant = Number(a.cantidad) || 0;
        const precio = Number(a.precio) || 0;
        cantidad += cant;
        ingresos += cant * precio;
        const k = a.subvariacionCodigo ?? FILTRO_SIN_VARIACION;
        const prev = desglose.get(k);
        if (prev) {
          prev.cantidad += cant;
          prev.ingresos += cant * precio;
        } else {
          desglose.set(k, {
            codigo: a.subvariacionCodigo,
            nombre:
              a.subvariacionNombre ??
              (a.subvariacionCodigo ?? "(sin variación)"),
            cantidad: cant,
            ingresos: cant * precio,
          });
        }
      }
    }
    return {
      cantidad,
      ingresos,
      ventas: ventasConArticulo.length,
      desglose: Array.from(desglose.values()).sort(
        (a, b) => b.cantidad - a.cantidad,
      ),
    };
  }, [ventasConArticulo, articulo, filtroVariacion]);

  const tieneVariaciones = (articulo?.subvariaciones?.length ?? 0) > 0;

  return (
    <div className="container max-w-4xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Consulta por artículo
        </h1>
        <p className="text-sm text-muted-foreground">
          Ventas que contienen un artículo específico
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>ID o sigla del artículo</Label>
          <Input
            value={articuloIdBusqueda}
            onChange={(e) => setArticuloIdBusqueda(e.target.value)}
            placeholder="12300001 o CAM"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Últimos</Label>
          <div className="flex gap-1">
            {[30, 90, 180, 365].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={dias === d ? "default" : "outline"}
                onClick={() => setDias(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {articuloIdBusqueda && !articulo && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Artículo no encontrado en el catálogo
        </p>
      )}

      {articulo && (
        <>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div>
              <h2 className="font-semibold">{articulo.nombre}</h2>
              <p className="text-sm text-muted-foreground">
                #{articulo.id} · {articulo.sigla} · ${articulo.precioVenta}
                {tieneVariaciones && (
                  <span className="ml-1">
                    · {articulo.subvariaciones!.length} variaciones
                  </span>
                )}
              </p>
            </div>
            {tieneVariaciones && (
              <div className="space-y-1.5">
                <Label className="text-xs">Filtrar por variación</Label>
                <select
                  value={filtroVariacion}
                  onChange={(e) => setFiltroVariacion(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value={FILTRO_TODAS}>Todas las variaciones</option>
                  <option value={FILTRO_SIN_VARIACION}>(sin variación)</option>
                  {articulo.subvariaciones!.map((sv) => (
                    <option key={sv.codigo} value={sv.codigo}>
                      {sv.nombre} — {sv.codigo}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Buscando…
            </p>
          ) : (
            <>
              {resumen && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Kpi label="Ventas" value={String(resumen.ventas)} />
                    <Kpi label="Cantidad" value={String(resumen.cantidad)} />
                    <Kpi
                      label="Ingresos"
                      value={`$${resumen.ingresos.toFixed(0)}`}
                    />
                  </div>
                  {resumen.desglose.length > 1 && (
                    <div className="rounded-lg border bg-card p-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Desglose por variación
                      </p>
                      <ul className="space-y-1">
                        {resumen.desglose.map((d) => (
                          <li
                            key={d.codigo ?? "sin"}
                            className="flex justify-between gap-2 text-sm"
                          >
                            <span className="truncate">
                              <span className="font-mono text-xs text-muted-foreground">
                                {d.codigo ?? "—"}
                              </span>{" "}
                              <span>{d.nombre}</span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {d.cantidad} pz · ${d.ingresos.toFixed(0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {ventasConArticulo.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="border-b bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-2">Venta</th>
                        <th className="px-4 py-2">Fecha</th>
                        <th className="px-4 py-2">Vendedor</th>
                        <th className="px-4 py-2">Variación</th>
                        <th className="px-4 py-2 text-right">Cant</th>
                        <th className="px-4 py-2 text-right">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasConArticulo.slice(0, 100).map((v) => {
                        const item = v.articulos.find(matchItem);
                        if (!item) return null;
                        return (
                          <tr
                            key={v.ventaId}
                            className="border-b last:border-0"
                          >
                            <td className="px-4 py-2">#{v.numeroDeVenta}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">
                              {v.fecha}
                            </td>
                            <td className="px-4 py-2">{v.enTurno}</td>
                            <td className="px-4 py-2 text-xs">
                              {item.subvariacionCodigo ? (
                                <span>
                                  <span className="font-mono">
                                    {item.subvariacionCodigo}
                                  </span>
                                  {item.subvariacionNombre && (
                                    <>
                                      {" "}
                                      <span className="text-muted-foreground">
                                        {item.subvariacionNombre}
                                      </span>
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {item.cantidad}
                            </td>
                            <td className="px-4 py-2 text-right">
                              ${Number(item.precio).toFixed(0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sin ventas con este artículo en el rango
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useResurtidos } from "@/features/resurtidos/useResurtidos";
import { useZonasPrecio } from "@/features/zonas-precio/useZonasPrecio";
import { useUbicaciones } from "@/features/fabricacion/useFabricacion";
import { calcularExistencias } from "@/features/fabricacion/existenciasFabricado";

/** Artículos fabricados con su existencia en taller, en tránsito y en
 *  cada sucursal. */
export function FabricadosPage() {
  const navigate = useNavigate();
  const { articulos, loading } = useArticulos();
  const { resurtidos } = useResurtidos();
  const { zonas } = useZonasPrecio();
  const { sucursales, defaultSucursalId } = useUbicaciones();
  const [q, setQ] = useState("");

  const filas = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return articulos
      .filter((a) => a.fabricado)
      .filter(
        (a) =>
          !texto ||
          a.nombre.toLowerCase().includes(texto) ||
          a.id.includes(texto) ||
          (a.etiquetas ?? []).some((t) => t.includes(texto)),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((a) => ({
        articulo: a,
        existencias: calcularExistencias(a, sucursales, defaultSucursalId, resurtidos),
        zona: zonas.find((z) => z.zonaId === a.zonaPrecioId)?.nombre,
      }));
  }, [articulos, resurtidos, zonas, sucursales, defaultSucursalId, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, código o etiqueta"
          className="max-w-sm"
        />
        <div className="flex-1" />
        <Button onClick={() => navigate("/fabricacion/registrar")}>
          <Plus className="mr-2 h-4 w-4" /> Registrar producción
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : filas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Aún no hay artículos fabricados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Artículo</th>
                <th className="px-3 py-2 text-right font-medium">Taller</th>
                <th className="px-3 py-2 text-right font-medium">En tránsito</th>
                {sucursales.map((s) => (
                  <th key={s.sucursalId} className="px-3 py-2 text-right font-medium">
                    {s.nombre}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map(({ articulo: a, existencias: e, zona }) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to={`/fabricacion/articulos/${a.id}`} className="flex items-center gap-2">
                      {a.imagenUrl ? (
                        <img src={a.imagenUrl} alt="" className="h-9 w-9 rounded object-cover" loading="lazy" />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:underline">{a.nombre}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          #{a.id}
                          {zona ? ` · ${zona}` : ""}
                          {a.soloMayoreo ? " · solo mayoreo" : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.taller}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.enTransito}</td>
                  {e.sucursales.map((s) => (
                    <td key={s.sucursalId} className="px-3 py-2 text-right tabular-nums">
                      {s.cantidad}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

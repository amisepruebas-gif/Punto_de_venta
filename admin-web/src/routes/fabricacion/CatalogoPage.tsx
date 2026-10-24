import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useUbicaciones } from "@/features/fabricacion/useFabricacion";
import { CatalogoCard } from "@/features/catalogo/CatalogoCard";
import {
  articuloVisibleEnSucursal,
  leerStockTienda,
  slugCategoria,
  type Articulo,
} from "@shared";

const SIN_CATEGORIA = "Sin categoría";
const SIN_SUBCATEGORIA = "General";

type Grupo = {
  categoria: string;
  subgrupos: Array<{
    subcategoria: string;
    items: Array<{ articulo: Articulo; existencia: number }>;
  }>;
  piezas: number;
};

/**
 * Catálogo visual de lo que hay en existencia en una sucursal (pensado para
 * las de mayoreo): tarjetas agrupadas por categoría y subcategoría. Solo
 * muestra lo que esa sucursal puede vender.
 */
export function CatalogoPage() {
  const { articulos, loading } = useArticulos();
  const { categorias, subcategorias } = useCategorias();
  const { sucursales, defaultSucursalId } = useUbicaciones();
  const [sucursalElegida, setSucursalElegida] = useState("");
  const [soloConExistencia, setSoloConExistencia] = useState(true);
  const [q, setQ] = useState("");

  // Por defecto, la primera sucursal de mayoreo (si no, la principal).
  const sucursalId =
    sucursalElegida ||
    sucursales.find((s) => s.modoMayoreo)?.sucursalId ||
    defaultSucursalId ||
    "";
  const sucursal = sucursales.find((s) => s.sucursalId === sucursalId);
  const esDefault = sucursalId === defaultSucursalId;

  const grupos = useMemo<Grupo[]>(() => {
    if (!sucursal) return [];
    const texto = q.trim().toLowerCase();
    const nombreCat = new Map(categorias.map((c) => [c.categoriaId, c.nombre]));
    const nombreSub = new Map(subcategorias.map((s) => [s.subcategoriaId, s.nombre]));
    const porCategoria = new Map<string, Map<string, Grupo["subgrupos"][number]["items"]>>();

    for (const a of articulos) {
      if (!articuloVisibleEnSucursal(a, sucursal.modoMayoreo)) continue;
      if (
        texto &&
        !a.nombre.toLowerCase().includes(texto) &&
        !a.id.includes(texto) &&
        !(a.etiquetas ?? []).some((t) => t.includes(texto))
      ) {
        continue;
      }
      const subs = a.subvariaciones ?? [];
      const existencia =
        subs.length > 0
          ? subs.reduce((acc, sv) => acc + leerStockTienda(sv, sucursalId, esDefault), 0)
          : leerStockTienda(a, sucursalId, esDefault);
      if (soloConExistencia && existencia <= 0) continue;
      const cat = (a.categoriaId && nombreCat.get(a.categoriaId)) || SIN_CATEGORIA;
      const sub = (a.subcategoriaId && nombreSub.get(a.subcategoriaId)) || SIN_SUBCATEGORIA;
      const subMap = porCategoria.get(cat) ?? new Map();
      const items = subMap.get(sub) ?? [];
      items.push({ articulo: a, existencia });
      subMap.set(sub, items);
      porCategoria.set(cat, subMap);
    }

    const orden = (a: string, b: string, ultimo: string) =>
      a === ultimo ? 1 : b === ultimo ? -1 : a.localeCompare(b, "es");
    return [...porCategoria.entries()]
      .sort(([a], [b]) => orden(a, b, SIN_CATEGORIA))
      .map(([categoria, subMap]) => {
        const subgrupos = [...subMap.entries()]
          .sort(([a], [b]) => orden(a, b, SIN_SUBCATEGORIA))
          .map(([subcategoria, items]) => ({
            subcategoria,
            items: items.sort((x, y) => x.articulo.nombre.localeCompare(y.articulo.nombre, "es")),
          }));
        const piezas = subgrupos.reduce(
          (acc, s) => acc + s.items.reduce((a, i) => a + i.existencia, 0),
          0,
        );
        return { categoria, subgrupos, piezas };
      });
  }, [articulos, categorias, subcategorias, sucursal, sucursalId, esDefault, soloConExistencia, q]);

  const totalArticulos = grupos.reduce(
    (acc, g) => acc + g.subgrupos.reduce((a, s) => a + s.items.length, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sucursalId}
          onChange={(e) => setSucursalElegida(e.target.value)}
          aria-label="Sucursal"
          className="flex h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          {sucursales.map((s) => (
            <option key={s.sucursalId} value={s.sucursalId}>
              {s.nombre}
              {s.modoMayoreo ? " (mayoreo)" : ""}
            </option>
          ))}
        </select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en el catálogo"
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={soloConExistencia}
            onChange={(e) => setSoloConExistencia(e.target.checked)}
          />
          Solo con existencia
        </label>
        <span className="ml-auto text-sm text-muted-foreground">
          {totalArticulos} artículos
        </span>
      </div>

      {grupos.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Categorías">
          {grupos.map((g) => (
            <a
              key={g.categoria}
              href={`#cat-${slugCategoria(g.categoria)}`}
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            >
              {g.categoria}
            </a>
          ))}
        </nav>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : grupos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {sucursal?.modoMayoreo
              ? "Esta sucursal aún no tiene existencia de artículos de mayoreo."
              : "Sin artículos con existencia en esta sucursal."}
          </p>
        </div>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} id={`cat-${slugCategoria(g.categoria)}`} className="space-y-3 scroll-mt-4">
            <h3 className="flex items-baseline gap-2 border-b pb-1 text-lg font-semibold">
              {g.categoria}
              <span className="text-xs font-normal text-muted-foreground">{g.piezas} pz</span>
            </h3>
            {g.subgrupos.map((s) => (
              <div key={s.subcategoria} className="space-y-2">
                {(g.subgrupos.length > 1 || s.subcategoria !== SIN_SUBCATEGORIA) && (
                  <h4 className="text-sm font-medium text-muted-foreground">{s.subcategoria}</h4>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {s.items.map(({ articulo, existencia }) => (
                    <CatalogoCard key={articulo.id} articulo={articulo} existencia={existencia} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

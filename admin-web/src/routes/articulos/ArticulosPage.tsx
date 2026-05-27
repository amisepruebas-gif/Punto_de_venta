import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Package, Layers } from "lucide-react";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useNegocio } from "@/hooks/useNegocio";
import { Button } from "@/components/ui/button";
import type { Articulo, ArticuloSubvariacion } from "@shared";
import { resolverTrios, StockTrio } from "@/features/articulos/stockHelpers";
import { ArticulosSearchBar } from "@/features/articulos/ArticulosSearchBar";

const FILTRO_SIN_CATEGORIA = "__sin__";
const FILTRO_TODAS = "";

export function ArticulosPage() {
  const navigate = useNavigate();
  const { articulos, loading } = useArticulos();
  const { categorias, subcategorias } = useCategorias();
  const { sucursales } = useSucursales();
  const { negocio } = useNegocio();
  const [q, setQ] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState(FILTRO_TODAS);
  const [filtroSubcategoria, setFiltroSubcategoria] = useState(FILTRO_TODAS);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState(FILTRO_TODAS);
  const [filtroVariaciones, setFiltroVariaciones] = useState<"" | "con" | "sin">(
    "",
  );
  const [filtroSucursal, setFiltroSucursal] = useState<string>(FILTRO_TODAS);

  // Default fallback: si el negocio no tiene `sucursalDefaultId`, la primera
  // sucursal alfabéticamente actúa como default (contrato legacy del schema).
  // `useSucursales` ya entrega el array ordenado por nombre — para el
  // fallback queremos orden por `sucursalId` (alfabético), mismo criterio
  // que `resurtidoService.cargarSucursalesIds`.
  const defaultSucursalId = useMemo(() => {
    if (negocio?.sucursalDefaultId) return negocio.sucursalDefaultId;
    const ids = sucursales.map((s) => s.sucursalId).sort();
    return ids[0];
  }, [negocio?.sucursalDefaultId, sucursales]);
  const subcategoriasFiltradas = useMemo(
    () =>
      filtroCategoria && filtroCategoria !== FILTRO_SIN_CATEGORIA
        ? subcategorias.filter((sc) => sc.categoriaId === filtroCategoria)
        : [],
    [filtroCategoria, subcategorias],
  );

  // Universo de etiquetas presentes en el catálogo (para el dropdown).
  const etiquetasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const a of articulos) {
      for (const t of a.etiquetas ?? []) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [articulos]);

  const resultados = useMemo(() => {
    const s = q.trim().toLowerCase();
    return articulos.filter((a) => {
      // Filtro por categoría
      if (filtroCategoria === FILTRO_SIN_CATEGORIA) {
        if (a.categoriaId) return false;
      } else if (filtroCategoria) {
        if (a.categoriaId !== filtroCategoria) return false;
      }
      // Filtro por subcategoría (solo aplica si hay categoría seleccionada)
      if (filtroSubcategoria && a.subcategoriaId !== filtroSubcategoria) {
        return false;
      }
      // Filtro por etiqueta
      if (filtroEtiqueta && !(a.etiquetas ?? []).includes(filtroEtiqueta)) {
        return false;
      }
      // Filtro por presencia de variaciones
      if (filtroVariaciones === "con" && !(a.subvariaciones?.length ?? 0)) {
        return false;
      }
      if (filtroVariaciones === "sin" && (a.subvariaciones?.length ?? 0) > 0) {
        return false;
      }
      // Búsqueda por texto libre
      if (!s) return true;
      return (
        a.nombre?.toLowerCase().includes(s) ||
        a.sigla?.toLowerCase().includes(s) ||
        a.id?.includes(s) ||
        a.referencia?.toLowerCase().includes(s) ||
        (a.etiquetas ?? []).some((t) => t.includes(s))
      );
    });
  }, [
    q,
    filtroCategoria,
    filtroSubcategoria,
    filtroEtiqueta,
    filtroVariaciones,
    articulos,
  ]);

  function limpiarFiltros() {
    setFiltroCategoria(FILTRO_TODAS);
    setFiltroSubcategoria(FILTRO_TODAS);
    setFiltroEtiqueta(FILTRO_TODAS);
    setFiltroVariaciones("");
    setFiltroSucursal(FILTRO_TODAS);
  }

  const hayFiltrosActivos =
    !!filtroCategoria ||
    !!filtroSubcategoria ||
    !!filtroEtiqueta ||
    !!filtroVariaciones ||
    !!filtroSucursal;

  return (
    <div className="container max-w-6xl space-y-4 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Artículos</h1>
          <p className="text-sm text-muted-foreground">
            {resultados.length} de {articulos.length}{" "}
            {articulos.length === 1 ? "artículo" : "artículos"}
          </p>
        </div>
        <Button onClick={() => navigate("/articulos/nuevo")}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo artículo
        </Button>
      </div>

      {/* Buscador + autocomplete. `q` controlado para que también filtre la
          lista de abajo. El componente maneja su propio dropdown / highlight. */}
      <ArticulosSearchBar
        q={q}
        onQChange={setQ}
        filtroSucursal={filtroSucursal}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <select
          value={filtroCategoria}
          onChange={(e) => {
            setFiltroCategoria(e.target.value);
            setFiltroSubcategoria(FILTRO_TODAS);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value={FILTRO_TODAS}>Todas las categorías</option>
          <option value={FILTRO_SIN_CATEGORIA}>(sin categoría)</option>
          {categorias.map((c) => (
            <option key={c.categoriaId} value={c.categoriaId}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroSubcategoria}
          onChange={(e) => setFiltroSubcategoria(e.target.value)}
          disabled={
            !filtroCategoria || filtroCategoria === FILTRO_SIN_CATEGORIA
          }
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value={FILTRO_TODAS}>Todas las subcategorías</option>
          {subcategoriasFiltradas.map((sc) => (
            <option key={sc.subcategoriaId} value={sc.subcategoriaId}>
              {sc.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroEtiqueta}
          onChange={(e) => setFiltroEtiqueta(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value={FILTRO_TODAS}>Todas las etiquetas</option>
          {etiquetasDisponibles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filtroVariaciones}
          onChange={(e) =>
            setFiltroVariaciones(e.target.value as "" | "con" | "sin")
          }
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Con y sin variaciones</option>
          <option value="con">Solo con variaciones</option>
          <option value="sin">Solo sin variaciones</option>
        </select>
        <select
          value={filtroSucursal}
          onChange={(e) => setFiltroSucursal(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          title="Existencia por sucursal"
        >
          <option value={FILTRO_TODAS}>Existencia · todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s.sucursalId} value={s.sucursalId}>
              Existencia · {s.nombre}
            </option>
          ))}
        </select>
      </div>

      {hayFiltrosActivos && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : resultados.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {q || hayFiltrosActivos
              ? "Sin resultados con esos filtros"
              : "Sin artículos aún"}
          </p>
          {!q && !hayFiltrosActivos && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/articulos/nuevo")}
            >
              Crear el primer artículo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Artículos sin variaciones — grid clásico de cards. */}
          {resultados.filter((a) => !a.subvariaciones?.length).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {resultados
                .filter((a) => !a.subvariaciones?.length)
                .map((a) => (
                  <ArticuloCard
                    key={a.id}
                    articulo={a}
                    filtroSucursal={filtroSucursal}
                    defaultSucursalId={defaultSucursalId}
                  />
                ))}
            </div>
          )}
          {/* Artículos con variaciones — uno por bloque, padre como header. */}
          {resultados
            .filter((a) => (a.subvariaciones?.length ?? 0) > 0)
            .map((a) => (
              <ArticuloConVariaciones
                key={a.id}
                articulo={a}
                filtroSucursal={filtroSucursal}
                defaultSucursalId={defaultSucursalId}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Render para artículos con subvariaciones: el padre es header de grupo
 * (no clickeable como item vendible — su id está inhabilitado al escaneo
 * cuando `usaSubvariacionesV2` está activo) y cada variación se muestra
 * como tarjeta debajo.
 *
 * Trio del header: SE CALCULA sumando los trios de las subvariaciones,
 * NO leyendo del padre. Motivo: `resurtidoService` sólo actualiza el
 * snapshot del padre (`cantidad`/`cantidadBodega`) cuando el destino es
 * la sucursal default; nunca toca `articulo.cantidadPorSucursal[sid]`
 * para artículos con variaciones. Leer del padre directamente subcuenta
 * silenciosamente cuando hay stock recibido en sucursales no-default.
 */
function ArticuloConVariaciones({
  articulo,
  filtroSucursal,
  defaultSucursalId,
}: {
  articulo: Articulo;
  filtroSucursal: string;
  defaultSucursalId: string | undefined;
}) {
  const subs = articulo.subvariaciones ?? [];
  const trio = subs.reduce(
    (acc, sv) => {
      const t = resolverTrios(sv, filtroSucursal, defaultSucursalId);
      return {
        suc: acc.suc + t.suc,
        bod: acc.bod + t.bod,
        tot: acc.tot + t.tot,
      };
    },
    { suc: 0, bod: 0, tot: 0 },
  );
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <Link
          to={`/articulos/${articulo.id}`}
          className="min-w-0 flex-1 hover:underline"
        >
          <p className="truncate font-medium">{articulo.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">
            #{articulo.id} · {articulo.sigla} · ${articulo.precioVenta} ·{" "}
            {subs.length} {subs.length === 1 ? "variación" : "variaciones"}
          </p>
        </Link>
        <StockTrio trio={trio} />
      </header>
      <div className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {subs.map((sv) => (
          <SubvariacionCard
            key={sv.codigo ?? sv.nombre}
            articulo={articulo}
            sv={sv}
            filtroSucursal={filtroSucursal}
            defaultSucursalId={defaultSucursalId}
          />
        ))}
      </div>
    </section>
  );
}

function SubvariacionCard({
  articulo,
  sv,
  filtroSucursal,
  defaultSucursalId,
}: {
  articulo: Articulo;
  sv: ArticuloSubvariacion;
  filtroSucursal: string;
  defaultSucursalId: string | undefined;
}) {
  const trio = resolverTrios(sv, filtroSucursal, defaultSucursalId);
  const imagen = sv.imagenUrl ?? articulo.imagenUrl;
  return (
    <Link
      to={`/articulos/${articulo.id}`}
      className="group flex flex-col overflow-hidden rounded-md border bg-background transition-colors hover:bg-accent/50"
    >
      {imagen ? (
        <img
          src={imagen}
          alt={sv.nombre}
          className="h-24 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-24 items-center justify-center bg-muted">
          <Package className="h-6 w-6 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <p className="line-clamp-1 text-sm font-medium">{sv.nombre}</p>
        <p className="truncate text-[10px] font-mono text-muted-foreground">
          {sv.codigo ?? "(sin código aún)"}
        </p>
        {sv.referencia && (
          <p className="truncate text-[10px] text-muted-foreground">
            {sv.referencia}
          </p>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold">${articulo.precioVenta}</span>
          <StockTrio trio={trio} compact />
        </div>
      </div>
    </Link>
  );
}

function ArticuloCard({
  articulo,
  filtroSucursal,
  defaultSucursalId,
}: {
  articulo: Articulo;
  filtroSucursal: string;
  defaultSucursalId: string | undefined;
}) {
  const trio = resolverTrios(articulo, filtroSucursal, defaultSucursalId);
  return (
    <Link
      to={`/articulos/${articulo.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-accent/50"
    >
      {articulo.imagenUrl ? (
        <img
          src={articulo.imagenUrl}
          alt={articulo.nombre}
          className="h-32 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-32 items-center justify-center bg-muted">
          <Package className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 font-medium">{articulo.nombre}</p>
        <p className="text-xs text-muted-foreground">
          #{articulo.id} · {articulo.sigla}
        </p>
        {(articulo.etiquetas ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(articulo.etiquetas ?? []).slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">
            ${articulo.precioVenta}
          </span>
          <StockTrio trio={trio} />
        </div>
      </div>
    </Link>
  );
}


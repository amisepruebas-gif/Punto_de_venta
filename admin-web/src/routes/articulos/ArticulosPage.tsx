import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Package, Search, Layers, X } from "lucide-react";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useNegocio } from "@/hooks/useNegocio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Articulo, ArticuloSubvariacion } from "@shared";

const FILTRO_SIN_CATEGORIA = "__sin__";
const FILTRO_TODAS = "";
const MAX_SUGERENCIAS = 6;

/**
 * Soporte para mostrar existencia por sucursal:
 *   - Cada item (Articulo o ArticuloSubvariacion) guarda su stock de
 *     "tienda" en `cantidad` (sucursal default) o en
 *     `cantidadPorSucursal[sid]` (sucursales no-default), per schema.
 *   - `cantidadBodega` es UNA sola bodega global del negocio (no se
 *     particiona por sucursal).
 *   - "cant suc" depende del filtro: si hay sucursal elegida, es el stock
 *     ahí; si está en "todas", es la suma sobre todas las sucursales.
 *   - "total" siempre = Σ sucursales (tienda) + bodega global — no depende
 *     del filtro, por eso un mismo artículo muestra el mismo total
 *     independientemente de qué sucursal estés viendo.
 */
type StockShape = {
  cantidad?: string;
  cantidadBodega?: string;
  cantidadPorSucursal?: { [sid: string]: string };
};

function stockEnSucursal(
  item: StockShape,
  sucursalId: string,
  defaultId: string | undefined,
): number {
  if (defaultId && sucursalId === defaultId) {
    return Number(item.cantidad) || 0;
  }
  return Number(item.cantidadPorSucursal?.[sucursalId]) || 0;
}

function stockEnTodasSucursales(item: StockShape): number {
  const cant = Number(item.cantidad) || 0;
  const otros = Object.values(item.cantidadPorSucursal ?? {}).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0,
  );
  return cant + otros;
}

/** Resuelve los tres números a mostrar para un item dado el filtro actual. */
function resolverTrios(
  item: StockShape,
  filtroSucursal: string,
  defaultId: string | undefined,
): { suc: number; bod: number; tot: number } {
  const bod = Number(item.cantidadBodega) || 0;
  const todas = stockEnTodasSucursales(item);
  const suc = filtroSucursal
    ? stockEnSucursal(item, filtroSucursal, defaultId)
    : todas;
  return { suc, bod, tot: todas + bod };
}

/**
 * Entry del índice de autocomplete — mismo shape conceptual que el de
 * nodo-web/useArticulos. Cuando un artículo tiene variaciones, el padre
 * NO entra y cada variación entra como su propia fila. Cuando no tiene,
 * entra el padre.
 */
type SearchEntry = {
  kind: "articulo" | "variacion";
  idPadre: string;
  subvariacionCodigo?: string;
  subvariacionNombre?: string;
  titulo: string;
  blob: string; // texto en lowercase para `includes`
};

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
  // Autocomplete: dropdown de sugerencias mientras se escribe.
  // Click en una sugerencia → navega al detalle (`/articulos/{idPadre}`).
  // El input también sigue filtrando la lista de abajo (mismo `q`).
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Índice de búsqueda — mismo principio que nodo-web/useArticulos:
  // artículos sin variaciones entran como `articulo`, con variaciones
  // entran SOLO las variaciones (el padre se omite).
  const searchIndex = useMemo<SearchEntry[]>(() => {
    const out: SearchEntry[] = [];
    for (const a of articulos) {
      const subs = a.subvariaciones ?? [];
      const blobBase = `${a.nombre ?? ""} ${a.sigla ?? ""} ${a.id ?? ""} ${
        a.referencia ?? ""
      } ${(a.etiquetas ?? []).join(" ")}`.toLowerCase();
      if (subs.length > 0) {
        for (const sv of subs) {
          out.push({
            kind: "variacion",
            idPadre: a.id,
            subvariacionCodigo: sv.codigo,
            subvariacionNombre: sv.nombre,
            titulo: `${a.nombre} — ${sv.nombre}`,
            blob: `${blobBase} ${sv.nombre ?? ""} ${
              sv.codigo ?? ""
            } ${sv.referencia ?? ""}`.toLowerCase(),
          });
        }
      } else {
        out.push({
          kind: "articulo",
          idPadre: a.id,
          titulo: a.nombre,
          blob: blobBase,
        });
      }
    }
    return out;
  }, [articulos]);

  const byId = useMemo(() => {
    const m = new Map<string, Articulo>();
    for (const a of articulos) m.set(a.id, a);
    return m;
  }, [articulos]);

  const sugerencias = useMemo<SearchEntry[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return searchIndex
      .filter((e) => e.blob.includes(s))
      .slice(0, MAX_SUGERENCIAS);
  }, [q, searchIndex]);

  useEffect(() => {
    setHighlight(0);
  }, [q]);

  // Click fuera del wrapper cierra el dropdown.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setAutocompleteOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  function elegirSugerencia(idx: number) {
    const entry = sugerencias[idx];
    if (!entry) return;
    setAutocompleteOpen(false);
    setQ("");
    // Si el match es una subvariación específica, propagamos el código por
    // query (`?sub=v-NN-XXX`). ArticuloEditPage lo lee y le pide al
    // SubvariacionesEditor que expanda + scrollee a esa sub. Match al
    // padre (por nombre/sigla/id) no agrega el query.
    const sub = entry.subvariacionCodigo
      ? `?sub=${encodeURIComponent(entry.subvariacionCodigo)}`
      : "";
    navigate(`/articulos/${entry.idPadre}${sub}`);
  }

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

      <div ref={wrapRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAutocompleteOpen(true);
          }}
          onFocus={() => setAutocompleteOpen(true)}
          onKeyDown={(e) => {
            if (!sugerencias.length) {
              if (e.key === "Escape") setAutocompleteOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(sugerencias.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              elegirSugerencia(highlight);
            } else if (e.key === "Escape") {
              setAutocompleteOpen(false);
            }
          }}
          placeholder="Buscar por nombre, sigla, ID, referencia o etiqueta…"
          className="pl-9 pr-10"
          inputMode="search"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setAutocompleteOpen(false);
            }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Dropdown de autocomplete — mismo patrón visual que nodo-web. */}
        {autocompleteOpen && q.trim() && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border bg-card shadow-lg">
            {sugerencias.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {loading ? "Cargando…" : "Sin resultados"}
              </p>
            ) : (
              <ul role="listbox">
                {sugerencias.map((entry, idx) => {
                  const padre = byId.get(entry.idPadre);
                  const sv =
                    entry.subvariacionCodigo && padre
                      ? padre.subvariaciones?.find(
                          (s) => s.codigo === entry.subvariacionCodigo,
                        )
                      : undefined;
                  const item = sv ?? padre;
                  const trio = item
                    ? resolverTrios(item, filtroSucursal, defaultSucursalId)
                    : { suc: 0, bod: 0, tot: 0 };
                  const imagen = sv?.imagenUrl ?? padre?.imagenUrl;
                  return (
                    <li
                      key={`${entry.idPadre}__${entry.subvariacionCodigo ?? ""}`}
                      role="option"
                      aria-selected={idx === highlight}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        elegirSugerencia(idx);
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                        idx === highlight ? "bg-accent" : ""
                      }`}
                    >
                      {imagen ? (
                        <img
                          src={imagen}
                          alt=""
                          className="h-9 w-9 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                          {padre?.sigla || "—"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{entry.titulo}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.kind === "variacion"
                            ? entry.subvariacionCodigo
                            : `${padre?.sigla ? padre.sigla + " · " : ""}#${entry.idPadre}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          ${padre?.precioVenta ?? "—"}
                        </p>
                        <StockTrio trio={trio} compact />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

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

/**
 * Bloque de tres números — Suc / Bod / Tot.
 * `Suc` se grisea cuando vale 0 (regla pedida: el artículo se sigue
 * mostrando aunque no haya existencia en la sucursal elegida).
 */
function StockTrio({
  trio,
  compact,
}: {
  trio: { suc: number; bod: number; tot: number };
  compact?: boolean;
}) {
  const sizeNum = compact ? "text-[10px]" : "text-xs";
  const sizeLbl = compact ? "text-[9px]" : "text-[10px]";
  const sucMuted = trio.suc === 0;
  return (
    <div
      className={`flex shrink-0 items-baseline gap-1.5 tabular-nums ${sizeNum}`}
      title={`Sucursal: ${trio.suc} · Bodega: ${trio.bod} · Total: ${trio.tot}`}
    >
      <span className={sucMuted ? "text-muted-foreground/50" : "font-semibold"}>
        <span className={`${sizeLbl} font-normal text-muted-foreground`}>S </span>
        {trio.suc}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        <span className={`${sizeLbl}`}>B </span>
        {trio.bod}
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        <span className={`${sizeLbl}`}>T </span>
        {trio.tot}
      </span>
    </div>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Package, Layers, ClipboardList, ListChecks, Check } from "lucide-react";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useGeneros } from "@/features/categorias/useGeneros";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useNegocio } from "@/hooks/useNegocio";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FILTRO_SIN,
  clasificacionVigente,
  coincidePalabras,
  normalizarEtiqueta,
  normalizarTexto,
  palabrasDeConsulta,
  pasaFiltrosVigente,
  resolverEscalones,
  resolverSucursalDefaultId,
  resolverUbicacionStock,
  type Articulo,
  type ArticuloSubvariacion,
  type CatalogosVigentes,
} from "@shared";

/** Filtro por tipo: con precio de mayoreo (incluye el legacy de un
 *  escalón, para revisarlo), "solo mayoreo" o fabricados. */
type FiltroTipo = "" | "mayoreo" | "solo" | "fabricado";
import { resolverTrios, StockTrio } from "@/features/articulos/stockHelpers";
import { ArticulosSearchBar } from "@/features/articulos/ArticulosSearchBar";
import { ExistenciasSucursalEditor } from "@/features/articulos/ExistenciasSucursalEditor";
import { AsignarEnBloqueDialog } from "@/features/articulos/AsignarEnBloqueDialog";

/** "(sin …)": sin el dato o con un id que ya no existe (`FILTRO_SIN`). */
const FILTRO_SIN_CATEGORIA = FILTRO_SIN;
const FILTRO_TODAS = "";

/** En modo selección, la tarjeta marca/desmarca en vez de abrir el artículo. */
type Seleccion = { activo: boolean; onToggle: () => void };

export function ArticulosPage() {
  const navigate = useNavigate();
  const { articulos, loading } = useArticulos();
  const { categorias, subcategorias, loading: loadingCategorias } = useCategorias();
  const { generos, loading: loadingGeneros } = useGeneros();
  const { sucursales, loading: loadingSucursales } = useSucursales();
  const { negocio, negocioId, loading: loadingNegocio } = useNegocio();
  const [q, setQ] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState(FILTRO_TODAS);
  const [filtroSubcategoria, setFiltroSubcategoria] = useState(FILTRO_TODAS);
  const [filtroGenero, setFiltroGenero] = useState(FILTRO_TODAS);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState(FILTRO_TODAS);
  // Asignación en bloque: modo selección (las tarjetas marcan en vez de abrir).
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [asignando, setAsignando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("");
  const [filtroVariaciones, setFiltroVariaciones] = useState<"" | "con" | "sin">(
    "",
  );
  const [filtroSucursal, setFiltroSucursal] = useState<string>(FILTRO_TODAS);
  // Modo de edición de existencias de la sucursal del filtro. Mientras está
  // activo el filtro de sucursal queda fijo.
  const [editandoExistencias, setEditandoExistencias] = useState(false);

  // Default fallback: si el negocio no tiene `sucursalDefaultId`, la primera
  // sucursal alfabéticamente actúa como default (contrato legacy del schema).
  // `useSucursales` ya entrega el array ordenado por nombre — para el
  // fallback queremos orden por `sucursalId` (alfabético), mismo criterio
  // que `resurtidoService.cargarSucursalesIds`.
  const sucursalesIds = useMemo(
    () => sucursales.map((s) => s.sucursalId),
    [sucursales],
  );
  const defaultSucursalId = useMemo(
    () => resolverSucursalDefaultId(negocio?.sucursalDefaultId, sucursalesIds),
    [negocio?.sucursalDefaultId, sucursalesIds],
  );
  const sucursalFiltro = sucursales.find(
    (s) => s.sucursalId === filtroSucursal,
  );
  const ubicacionFiltro = useMemo(
    () =>
      filtroSucursal
        ? resolverUbicacionStock(
            filtroSucursal,
            negocio?.sucursalDefaultId,
            sucursalesIds,
          )
        : null,
    [filtroSucursal, negocio?.sucursalDefaultId, sucursalesIds],
  );
  // Sólo con negocio y sucursales cargados: si no, la default podría
  // resolverse con datos incompletos.
  const puedeEditarExistencias =
    !!negocioId &&
    !!sucursalFiltro &&
    !!ubicacionFiltro &&
    !loadingNegocio &&
    !loadingSucursales;
  const subcategoriasFiltradas = useMemo(
    () =>
      filtroCategoria && filtroCategoria !== FILTRO_SIN_CATEGORIA
        ? subcategorias.filter((sc) => sc.categoriaId === filtroCategoria)
        : [],
    [filtroCategoria, subcategorias],
  );

  // Universo de etiquetas presentes en el catálogo (para el dropdown), sin
  // repetir por mayúsculas, # o acentos: clave normalizada → como se ve.
  const etiquetasDisponibles = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of articulos) {
      for (const t of a.etiquetas ?? []) {
        const k = normalizarEtiqueta(t);
        if (k && !m.has(k)) m.set(k, t);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [articulos]);

  // Ids vigentes de los catálogos: un id borrado cuenta como "(sin …)". Hasta
  // que cargan no se valida (para no mostrar todo como huérfano un instante).
  const catalogos = useMemo<CatalogosVigentes>(
    () =>
      loadingCategorias || loadingGeneros
        ? {}
        : {
            categorias: new Set(categorias.map((c) => c.categoriaId)),
            subcategorias: new Set(subcategorias.map((sc) => sc.subcategoriaId)),
            generos: new Set(generos.map((g) => g.generoId)),
          },
    [loadingCategorias, loadingGeneros, categorias, subcategorias, generos],
  );
  const nombres = useMemo(
    () => ({
      categoria: new Map(categorias.map((c) => [c.categoriaId, c.nombre])),
      subcategoria: new Map(subcategorias.map((sc) => [sc.subcategoriaId, sc.nombre])),
      genero: new Map(generos.map((g) => [g.generoId, g.nombre])),
    }),
    [categorias, subcategorias, generos],
  );
  /** "Llavero · Anime" para la tarjeta. */
  function textoClasificacion(a: Articulo): string {
    return [
      a.categoriaId ? nombres.categoria.get(a.categoriaId) : undefined,
      a.generoId ? nombres.genero.get(a.generoId) : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const resultados = useMemo(() => {
    const palabras = palabrasDeConsulta(q);
    const filtros = {
      categoriaId: filtroCategoria || undefined,
      // La subcategoría solo aplica con una categoría elegida.
      subcategoriaId: filtroSubcategoria || undefined,
      generoId: filtroGenero || undefined,
      etiqueta: filtroEtiqueta || undefined,
    };
    return articulos.filter((a) => {
      // Categoría, subcategoría, género y etiqueta
      if (!pasaFiltrosVigente(clasificacionVigente(a, catalogos), filtros)) {
        return false;
      }
      // Filtro por presencia de variaciones
      if (filtroVariaciones === "con" && !(a.subvariaciones?.length ?? 0)) {
        return false;
      }
      if (filtroVariaciones === "sin" && (a.subvariaciones?.length ?? 0) > 0) {
        return false;
      }
      // Filtro por tipo (mayoreo / solo mayoreo / fabricado)
      if (filtroTipo === "mayoreo" && resolverEscalones(a).length === 0) {
        return false;
      }
      if (filtroTipo === "solo" && !a.soloMayoreo) return false;
      if (filtroTipo === "fabricado" && !a.fabricado) return false;
      // Texto libre: por palabras y sin acentos, también por el nombre de la
      // categoría, la subcategoría y el género.
      if (palabras.length === 0) return true;
      const texto = normalizarTexto(
        [
          a.nombre,
          a.sigla,
          a.id,
          a.referencia,
          ...(a.etiquetas ?? []),
          a.categoriaId ? nombres.categoria.get(a.categoriaId) : "",
          a.subcategoriaId ? nombres.subcategoria.get(a.subcategoriaId) : "",
          a.generoId ? nombres.genero.get(a.generoId) : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      return coincidePalabras(texto, palabras);
    });
  }, [
    q,
    filtroCategoria,
    filtroSubcategoria,
    filtroGenero,
    filtroEtiqueta,
    filtroVariaciones,
    filtroTipo,
    articulos,
    catalogos,
    nombres,
  ]);

  const seleccionados = useMemo(
    () => (seleccion.size === 0 ? [] : articulos.filter((a) => seleccion.has(a.id))),
    [articulos, seleccion],
  );

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function seleccionDe(id: string): Seleccion | undefined {
    return seleccionando
      ? { activo: seleccion.has(id), onToggle: () => alternarSeleccion(id) }
      : undefined;
  }
  function seleccionarFiltrados() {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const a of resultados) next.add(a.id);
      return next;
    });
  }
  function terminarSeleccion() {
    setSeleccionando(false);
    setSeleccion(new Set());
  }

  function limpiarFiltros() {
    setFiltroCategoria(FILTRO_TODAS);
    setFiltroSubcategoria(FILTRO_TODAS);
    setFiltroGenero(FILTRO_TODAS);
    setFiltroEtiqueta(FILTRO_TODAS);
    setFiltroVariaciones("");
    setFiltroTipo("");
    if (!editandoExistencias) setFiltroSucursal(FILTRO_TODAS);
  }

  const hayFiltrosActivos =
    !!filtroCategoria ||
    !!filtroSubcategoria ||
    !!filtroGenero ||
    !!filtroEtiqueta ||
    !!filtroVariaciones ||
    !!filtroTipo ||
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
        <div className="flex flex-wrap justify-end gap-2">
          {!seleccionando && !editandoExistencias && (
            <Button
              variant="outline"
              onClick={() => {
                setAviso(null);
                setSeleccionando(true);
              }}
              title="Poner categoría, género o etiquetas a muchos artículos a la vez"
            >
              <ListChecks className="mr-2 h-4 w-4" /> Seleccionar
            </Button>
          )}
          <Button onClick={() => navigate("/articulos/nuevo")}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo artículo
          </Button>
        </div>
      </div>

      {aviso && (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          {aviso}
        </p>
      )}

      {/* Buscador + autocomplete. `q` controlado para que también filtre la
          lista de abajo. El componente maneja su propio dropdown / highlight. */}
      <ArticulosSearchBar
        q={q}
        onQChange={setQ}
        filtroSucursal={filtroSucursal}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
          value={filtroGenero}
          onChange={(e) => setFiltroGenero(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          aria-label="Género"
        >
          <option value={FILTRO_TODAS}>Todos los géneros</option>
          <option value={FILTRO_SIN}>(sin género)</option>
          {generos.map((g) => (
            <option key={g.generoId} value={g.generoId}>
              {g.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroEtiqueta}
          onChange={(e) => setFiltroEtiqueta(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value={FILTRO_TODAS}>Todas las etiquetas</option>
          {etiquetasDisponibles.map(([k, t]) => (
            <option key={k} value={k}>
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
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          title="Mayoreo y fabricación"
        >
          <option value="">Todos los tipos</option>
          <option value="mayoreo">Con precio de mayoreo</option>
          <option value="solo">Solo mayoreo</option>
          <option value="fabricado">Fabricados</option>
        </select>
        <select
          value={filtroSucursal}
          onChange={(e) => setFiltroSucursal(e.target.value)}
          disabled={editandoExistencias}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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

      {(hayFiltrosActivos || puedeEditarExistencias) && (
        <div className="flex flex-wrap justify-end gap-2">
          {puedeEditarExistencias && !editandoExistencias && !seleccionando && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditandoExistencias(true)}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Editar existencias · {sucursalFiltro?.nombre}
            </Button>
          )}
          {hayFiltrosActivos && (
            <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {seleccionando && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
          <span className="px-1 text-sm font-medium">
            {seleccion.size.toLocaleString("es-MX")}{" "}
            {seleccion.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={seleccionarFiltrados}
            disabled={resultados.length === 0}
          >
            Seleccionar los {resultados.length.toLocaleString("es-MX")} de este filtro
          </Button>
          {seleccion.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>
              Quitar selección
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" onClick={() => setAsignando(true)} disabled={seleccion.size === 0}>
            Asignar a {seleccion.size.toLocaleString("es-MX")}…
          </Button>
          <Button size="sm" variant="ghost" onClick={terminarSeleccion}>
            Terminar
          </Button>
        </div>
      )}

      {editandoExistencias &&
      negocioId &&
      sucursalFiltro &&
      ubicacionFiltro ? (
        <ExistenciasSucursalEditor
          key={filtroSucursal}
          negocioId={negocioId}
          articulos={resultados}
          ubicacion={ubicacionFiltro}
          sucursalNombre={sucursalFiltro.nombre}
          onCerrar={() => setEditandoExistencias(false)}
        />
      ) : loading ? (
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
                    clasificacion={textoClasificacion(a)}
                    seleccion={seleccionDe(a.id)}
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
                clasificacion={textoClasificacion(a)}
                seleccion={seleccionDe(a.id)}
              />
            ))}
        </div>
      )}

      {asignando && negocioId && (
        <AsignarEnBloqueDialog
          negocioId={negocioId}
          articulos={seleccionados}
          categorias={categorias}
          subcategorias={subcategorias}
          generos={generos}
          onCerrar={() => setAsignando(false)}
          onListo={(n) => {
            setAsignando(false);
            terminarSeleccion();
            setAviso(
              n === 1 ? "Listo: 1 artículo actualizado." : `Listo: ${n.toLocaleString("es-MX")} artículos actualizados.`,
            );
          }}
        />
      )}
    </div>
  );
}

/**
 * Enlace al artículo o, en modo selección, botón que lo marca/desmarca (con
 * una palomita arriba a la izquierda).
 */
function EnlaceOSeleccion({
  to,
  seleccion,
  className,
  children,
}: {
  to: string;
  seleccion?: Seleccion;
  className: string;
  children: ReactNode;
}) {
  if (!seleccion) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={seleccion.onToggle}
      aria-pressed={seleccion.activo}
      className={cn(
        className,
        "relative text-left",
        seleccion.activo && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <span
        className={cn(
          "absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border bg-background shadow-sm",
          seleccion.activo && "border-primary bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        {seleccion.activo && <Check className="h-3.5 w-3.5" />}
      </span>
      {children}
    </button>
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
  clasificacion,
  seleccion,
}: {
  articulo: Articulo;
  filtroSucursal: string;
  defaultSucursalId: string | undefined;
  clasificacion: string;
  seleccion?: Seleccion;
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
    <section
      className={cn(
        "rounded-lg border bg-card",
        seleccion?.activo && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <EnlaceOSeleccion
          to={`/articulos/${articulo.id}`}
          seleccion={seleccion}
          className={cn("min-w-0 flex-1 hover:underline", seleccion && "pl-8")}
        >
          <p className="truncate font-medium">{articulo.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">
            #{articulo.id} · {articulo.sigla} · ${articulo.precioVenta} ·{" "}
            {subs.length} {subs.length === 1 ? "variación" : "variaciones"}
            {clasificacion && ` · ${clasificacion}`}
          </p>
          <MarcasMayoreo articulo={articulo} />
        </EnlaceOSeleccion>
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
            onSeleccionar={seleccion?.onToggle}
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
  onSeleccionar,
}: {
  articulo: Articulo;
  sv: ArticuloSubvariacion;
  filtroSucursal: string;
  defaultSucursalId: string | undefined;
  /** En modo selección: tocar la variación marca a su padre. */
  onSeleccionar?: () => void;
}) {
  const trio = resolverTrios(sv, filtroSucursal, defaultSucursalId);
  const imagen = sv.imagenUrl ?? articulo.imagenUrl;
  const clase =
    "group flex flex-col overflow-hidden rounded-md border bg-background text-left transition-colors hover:bg-accent/50";
  const contenido = (
    <>
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
    </>
  );
  return onSeleccionar ? (
    <button type="button" onClick={onSeleccionar} className={clase}>
      {contenido}
    </button>
  ) : (
    <Link to={`/articulos/${articulo.id}`} className={clase}>
      {contenido}
    </Link>
  );
}

function ArticuloCard({
  articulo,
  filtroSucursal,
  defaultSucursalId,
  clasificacion,
  seleccion,
}: {
  articulo: Articulo;
  filtroSucursal: string;
  defaultSucursalId: string | undefined;
  /** "Llavero · Anime" (vacío si no tiene). */
  clasificacion: string;
  seleccion?: Seleccion;
}) {
  const trio = resolverTrios(articulo, filtroSucursal, defaultSucursalId);
  return (
    <EnlaceOSeleccion
      to={`/articulos/${articulo.id}`}
      seleccion={seleccion}
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
        {clasificacion && (
          <p className="truncate text-xs font-medium text-muted-foreground">{clasificacion}</p>
        )}
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
        <MarcasMayoreo articulo={articulo} />
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">
            ${articulo.precioVenta}
          </span>
          <StockTrio trio={trio} />
        </div>
      </div>
    </EnlaceOSeleccion>
  );
}

/** Marcas de fabricación / mayoreo: "Solo mayoreo", "Fabricado" y los
 *  escalones vigentes (incluido el mayoreo legacy de un escalón). */
function MarcasMayoreo({ articulo }: { articulo: Articulo }) {
  const escalones = resolverEscalones(articulo);
  if (!articulo.soloMayoreo && !articulo.fabricado && escalones.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1 text-[10px]">
      {articulo.soloMayoreo && (
        <span className="rounded-full bg-emerald-100 px-1.5 font-medium text-emerald-800">
          Solo mayoreo
        </span>
      )}
      {articulo.fabricado && (
        <span className="rounded-full bg-sky-100 px-1.5 font-medium text-sky-800">
          Fabricado
        </span>
      )}
      {escalones.length > 0 && (
        <span className="rounded-full bg-orange-100 px-1.5 text-orange-800">
          Mayoreo{" "}
          {escalones.map((e) => `${e.minPz}+ $${e.precio}`).join(" · ")}
        </span>
      )}
    </div>
  );
}


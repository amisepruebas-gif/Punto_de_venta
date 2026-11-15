import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { Layers, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useArticulos, type SearchEntry } from "@/features/articulos/useArticulos";
import { useCatalogoArticulos } from "@/features/articulos/useCatalogoArticulos";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { useUbicacionStock } from "@/features/sucursal/useUbicacionStock";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import { useCarrito } from "./carritoStore";
import { useFiltrosCaja } from "./filtrosCajaStore";
import { avisoNoVisible, resolverCodigoExacto, useElegirArticulo } from "./elegirArticulo";
import {
  articuloVisibleEnSucursal,
  clasificacionVigente,
  coincidePalabras,
  contarOpciones,
  hayFiltros,
  leerStockTienda,
  normalizarEtiqueta,
  normalizarTexto,
  palabrasDeConsulta,
  pasaFiltrosVigente,
  resolverEscalones,
  type Articulo,
  type ClasificacionVigente,
  type GrupoFiltro,
} from "@shared";

export type FiltrosPanelHandle = { focus: () => void };

/** Tarjetas por página: suficiente para hojear sin cargar cientos de fotos. */
const POR_PAGINA = 120;
/** Etiquetas a la vista (las más usadas); el texto encuentra las demás. */
const MAX_ETIQUETAS = 30;

type Props = {
  onCerrar: () => void;
  onPedirVariacion: (padre: Articulo) => void;
  onPedirSena: (padre: Articulo) => void;
};

type Item = { entry: SearchEntry; vigente: ClasificacionVigente; texto: string };
type Opcion = { id: string; nombre: string; n: number };

/**
 * Búsqueda por segmentos de la caja: filas de botones por categoría,
 * subcategoría, género y etiqueta (cada uno con cuántos artículos deja) y los
 * artículos en cuadrícula. Tocar uno lo agrega como el buscador normal. Solo
 * muestra lo que se vende en esta sucursal (mayoreo o no) y funciona sin
 * internet: todo sale de la caché de la tablet.
 */
export const FiltrosArticulosPanel = forwardRef<FiltrosPanelHandle, Props>(
  function FiltrosArticulosPanel({ onCerrar, onPedirVariacion, onPedirSena }, ref) {
    const { byId, bySigla, searchIndex, loading } = useArticulos();
    const catalogo = useCatalogoArticulos();
    const { sucursal, loading: cargandoSucursal } = useSucursal();
    const modoMayoreo = !!sucursal?.modoMayoreo;
    const ubicacion = useUbicacionStock();
    const hayTecladoFisico = useTecladoFisico();
    const { items } = useCarrito();
    const { filtros, texto, poner, setTexto, limpiar } = useFiltrosCaja();
    const { elegir, elegirVariacion } = useElegirArticulo({ onPedirVariacion, onPedirSena });
    const [limite, setLimite] = useState(POR_PAGINA);
    const [aviso, setAviso] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * El foco vive en el buscador del panel: ahí escribe el lector de códigos.
     * `seleccionar` marca el texto para que el siguiente escaneo lo reemplace
     * (en vez de pegarse a lo que ya había).
     */
    function enfocar(seleccionar = false) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (seleccionar) inputRef.current?.select();
      });
    }
    useImperativeHandle(ref, () => ({ focus: () => enfocar(true) }), []);
    // Al abrir: si quedó texto de antes, marcado (un escaneo lo reemplaza).
    useEffect(() => {
      enfocar(true);
      return () => {
        if (avisoTimer.current) clearTimeout(avisoTimer.current);
      };
    }, []);
    // Al cambiar filtros o texto se vuelve a la primera página.
    useEffect(() => setLimite(POR_PAGINA), [filtros, texto]);

    function avisar(t: string) {
      setAviso(t);
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
      avisoTimer.current = setTimeout(() => setAviso(null), 3000);
    }

    const entryPorId = useMemo(
      () => new Map(searchIndex.map((e) => [e.idPadre, e])),
      [searchIndex],
    );

    // Lo que se vende aquí, por nombre, con su clasificación vigente (ids
    // borrados = "sin …") y su texto de búsqueda (con nombres de catálogo).
    const { base, etiquetaVisible, hayClasificacion } = useMemo(() => {
      const etiquetaVisible = new Map<string, string>();
      let hayClasificacion = false;
      if (cargandoSucursal) return { base: [] as Item[], etiquetaVisible, hayClasificacion };
      const base: Item[] = [];
      for (const e of searchIndex) {
        if (!articuloVisibleEnSucursal(e, modoMayoreo)) continue;
        const c = e.clasificacion;
        for (const t of c.etiquetas ?? []) {
          const k = normalizarEtiqueta(t);
          if (k && !etiquetaVisible.has(k)) etiquetaVisible.set(k, t.replace(/^#+/, ""));
        }
        const extra = [
          c.categoriaId ? catalogo.nombreCategoria.get(c.categoriaId) : "",
          c.subcategoriaId ? catalogo.nombreSubcategoria.get(c.subcategoriaId) : "",
          c.generoId ? catalogo.nombreGenero.get(c.generoId) : "",
        ]
          .filter(Boolean)
          .join(" ");
        const vigente = clasificacionVigente(c, catalogo.vigentes);
        if (vigente.categoriaId || vigente.generoId || vigente.etiquetas.length) {
          hayClasificacion = true;
        }
        base.push({
          entry: e,
          vigente,
          texto: extra ? `${e.blob} ${normalizarTexto(extra)}` : e.blob,
        });
      }
      base.sort((a, b) => a.entry.titulo.localeCompare(b.entry.titulo, "es"));
      return { base, etiquetaVisible, hayClasificacion };
    }, [searchIndex, cargandoSucursal, modoMayoreo, catalogo]);

    const palabras = useMemo(() => palabrasDeConsulta(texto), [texto]);
    const conTexto = useMemo(
      () => (palabras.length ? base.filter((x) => coincidePalabras(x.texto, palabras)) : base),
      [base, palabras],
    );
    const conteo = useMemo(
      () => contarOpciones(conTexto.map((x) => x.vigente), filtros),
      [conTexto, filtros],
    );
    const resultados = useMemo(
      () => conTexto.filter((x) => pasaFiltrosVigente(x.vigente, filtros)),
      [conTexto, filtros],
    );

    /** Opciones con resultados, más la elegida aunque hoy dé 0. Si la
     *  elegida se borró del catálogo, sale como "(ya no existe)" para poder
     *  quitarla con un toque. */
    function opciones(
      lista: Array<{ id: string; nombre: string }>,
      cuenta: Map<string, number>,
      elegida: string | undefined,
    ): Opcion[] {
      const out = lista
        .map((o) => ({ ...o, n: cuenta.get(o.id) ?? 0 }))
        .filter((o) => o.n > 0 || o.id === elegida);
      if (elegida && !lista.some((o) => o.id === elegida)) {
        out.unshift({ id: elegida, nombre: "(ya no existe)", n: cuenta.get(elegida) ?? 0 });
      }
      return out;
    }
    const opcCategorias = opciones(
      catalogo.categorias.map((c) => ({ id: c.categoriaId, nombre: c.nombre })),
      conteo.categorias,
      filtros.categoriaId,
    );
    const opcSubcategorias = filtros.categoriaId
      ? opciones(
          catalogo.subcategorias
            .filter((s) => s.categoriaId === filtros.categoriaId)
            .map((s) => ({ id: s.subcategoriaId, nombre: s.nombre })),
          conteo.subcategorias,
          filtros.subcategoriaId,
        )
      : [];
    const opcGeneros = opciones(
      catalogo.generos.map((g) => ({ id: g.generoId, nombre: g.nombre })),
      conteo.generos,
      filtros.generoId,
    );
    const etiquetaElegida = filtros.etiqueta ? normalizarEtiqueta(filtros.etiqueta) : undefined;
    const opcEtiquetas: Opcion[] = [...conteo.etiquetas.entries()]
      .map(([k, n]) => ({ id: k, nombre: etiquetaVisible.get(k) ?? k, n }))
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, MAX_ETIQUETAS);
    if (etiquetaElegida && !opcEtiquetas.some((o) => o.id === etiquetaElegida)) {
      opcEtiquetas.unshift({
        id: etiquetaElegida,
        nombre: etiquetaVisible.get(etiquetaElegida) ?? etiquetaElegida,
        n: conteo.etiquetas.get(etiquetaElegida) ?? 0,
      });
    }
    // Ningún artículo de esta sucursal tiene categoría, género ni etiquetas
    // (no depende del texto escrito).
    const sinCatalogo =
      !catalogo.loading && !loading && !cargandoSucursal && !hayClasificacion && !hayFiltros(filtros);

    // Piezas de cada artículo que ya van en el carrito (insignia en la tarjeta).
    const enCarrito = useMemo(() => {
      const m = new Map<string, number>();
      for (const i of items) {
        if (!i.id) continue;
        m.set(i.id, (m.get(i.id) ?? 0) + (Number(i.cantidad) || 0));
      }
      return m;
    }, [items]);
    const piezasEnCarrito = [...enCarrito.values()].reduce((s, n) => s + n, 0);

    function alternar(grupo: GrupoFiltro, id: string, elegida: string | undefined) {
      poner(grupo, id === elegida ? undefined : id);
    }

    /** Agrega (o abre su ventana). Con modal, Ventas devuelve el foco al
     *  cerrarlo; sin modal, el foco sigue en el buscador del panel. */
    function tocar(entry: SearchEntry | undefined): boolean {
      const padre = entry ? byId.get(entry.idPadre) : undefined;
      if (!entry || !padre) return false;
      if (elegir(padre, entry.tieneVariaciones) === "agregado") {
        avisar(`Agregado: ${padre.nombre}`);
        enfocar();
      }
      return true;
    }

    /** Enter (o el lector de códigos): el código exacto se agrega; si solo
     *  queda un artículo, ese. Después el texto se limpia para el siguiente
     *  escaneo; si no hubo coincidencia, se avisa y el texto queda marcado. */
    function alEnter() {
      if (!texto.trim()) return;
      // Sin artículos ni sucursal aún no se sabe qué se vende aquí.
      if (loading || cargandoSucursal) {
        avisar("Cargando artículos…");
        return;
      }
      const r = resolverCodigoExacto(
        texto,
        byId,
        bySigla,
        (id) => !!entryPorId.get(id)?.tieneVariaciones,
      );
      if (r) {
        setTexto("");
        if (!articuloVisibleEnSucursal(r.padre, modoMayoreo)) {
          avisar(avisoNoVisible(r.padre, modoMayoreo));
          return;
        }
        if (r.sub) {
          if (elegirVariacion(r.padre, r.sub) === "agregado") avisar(`Agregado: ${r.padre.nombre}`);
          return;
        }
        tocar(entryPorId.get(r.padre.id));
        return;
      }
      if (resultados.length === 1) {
        setTexto("");
        tocar(resultados[0].entry);
        return;
      }
      if (resultados.length === 0) {
        avisar(`No se encontró "${texto.trim()}"`);
        enfocar(true);
      }
    }

    /** Botones del panel: no se quedan con el foco (el lector escribe en el
     *  buscador; si un botón lo tuviera, su Enter lo "tocaría" otra vez). */
    const sinFoco = (e: MouseEvent) => e.preventDefault();

    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-background"
        role="dialog"
        aria-modal
        aria-label="Buscar por filtros"
      >
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-3">
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <Input
              ref={inputRef}
              aria-label="Buscar dentro de los filtros"
              placeholder="Busca por nombre, o escanea"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  alEnter();
                }
              }}
              inputMode={hayTecladoFisico ? "none" : "search"}
              className="h-11 pr-11"
            />
            {texto && (
              <button
                type="button"
                onMouseDown={sinFoco}
                onClick={() => {
                  setTexto("");
                  enfocar();
                }}
                aria-label="Borrar texto"
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {(hayFiltros(filtros) || texto) && (
            <Button
              variant="ghost"
              className="h-11 shrink-0 px-3"
              onMouseDown={sinFoco}
              onClick={() => {
                limpiar();
                enfocar();
              }}
            >
              Limpiar
            </Button>
          )}
          <Button
            onClick={onCerrar}
            className="h-11 shrink-0 bg-marca px-4 font-semibold text-white hover:bg-marca/90"
          >
            Listo
            {piezasEnCarrito > 0 && (
              <span className="ml-1.5 rounded-full bg-white/25 px-2 text-xs">
                {piezasEnCarrito} en el carrito
              </span>
            )}
          </Button>
        </header>

        <div className="shrink-0 space-y-1 border-b bg-card px-3 py-1.5">
          {sinCatalogo ? (
            <p className="py-2 text-sm text-muted-foreground">
              Aún no hay categorías, géneros ni etiquetas en los artículos. Se ponen en admin →
              Artículos.
            </p>
          ) : (
            <>
              <FilaFiltro
                titulo="Categoría"
                opciones={opcCategorias}
                elegida={filtros.categoriaId}
                onElegir={(id) => alternar("categoriaId", id, filtros.categoriaId)}
              />
              {opcSubcategorias.length > 0 && (
                <FilaFiltro
                  titulo="Subcategoría"
                  opciones={opcSubcategorias}
                  elegida={filtros.subcategoriaId}
                  onElegir={(id) => alternar("subcategoriaId", id, filtros.subcategoriaId)}
                />
              )}
              <FilaFiltro
                titulo="Género"
                opciones={opcGeneros}
                elegida={filtros.generoId}
                onElegir={(id) => alternar("generoId", id, filtros.generoId)}
              />
              <FilaFiltro
                titulo="Etiqueta"
                opciones={opcEtiquetas}
                elegida={etiquetaElegida}
                onElegir={(id) => alternar("etiqueta", id, etiquetaElegida)}
              />
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <p
            className={cn(
              "mb-2 text-sm",
              aviso ? "font-medium text-emerald-700" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {aviso ??
              (loading || cargandoSucursal
                ? "Cargando artículos…"
                : `${resultados.length.toLocaleString("es-MX")} ${
                    resultados.length === 1 ? "artículo" : "artículos"
                  }`)}
          </p>
          {!loading && !cargandoSucursal && resultados.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin artículos con esos filtros.</p>
              {(hayFiltros(filtros) || texto) && (
                <Button
                  variant="outline"
                  className="mt-3 h-11"
                  onMouseDown={sinFoco}
                  onClick={() => {
                    limpiar();
                    enfocar();
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
              {resultados.slice(0, limite).map(({ entry }) => {
                const padre = byId.get(entry.idPadre);
                if (!padre) return null;
                const cantidad =
                  ubicacion && !entry.tieneVariaciones
                    ? leerStockTienda(padre, ubicacion.sucursalId, ubicacion.esDefault)
                    : null;
                const mayoreo = resolverEscalones(padre)[0];
                const n = enCarrito.get(entry.idPadre) ?? 0;
                return (
                  <li key={entry.idPadre}>
                    <button
                      type="button"
                      onMouseDown={sinFoco}
                      onClick={() => tocar(entry)}
                      className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-marca active:scale-[0.98]"
                    >
                      {padre.imagenUrl ? (
                        <img
                          src={padre.imagenUrl}
                          crossOrigin="anonymous"
                          alt=""
                          loading="lazy"
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                          {padre.sigla || "—"}
                        </div>
                      )}
                      {n > 0 && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-marca px-2 py-0.5 text-xs font-bold text-white shadow">
                          {n}
                        </span>
                      )}
                      <div className="flex flex-1 flex-col gap-0.5 p-2">
                        <p className="line-clamp-2 text-sm font-medium leading-tight">
                          {entry.titulo}
                          {entry.tieneVariaciones && (
                            <Layers
                              className="ml-1 inline h-3.5 w-3.5 text-muted-foreground"
                              aria-label="Tiene variaciones"
                            />
                          )}
                        </p>
                        <div className="mt-auto flex items-baseline justify-between gap-1 pt-1">
                          <span className="text-sm font-semibold">${padre.precioVenta}</span>
                          {cantidad !== null && (
                            <span className="text-[10px] text-muted-foreground">{cantidad} pz</span>
                          )}
                        </div>
                        {mayoreo && (
                          <p className="text-[10px] font-medium text-emerald-600">
                            {mayoreo.minPz}+ pz ${mayoreo.precio}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {resultados.length > limite && (
            <Button
              variant="outline"
              className="mt-3 h-12 w-full"
              onMouseDown={sinFoco}
              onClick={() => setLimite((l) => l + POR_PAGINA)}
            >
              Ver más ({(resultados.length - limite).toLocaleString("es-MX")} más)
            </Button>
          )}
        </div>
      </div>
    );
  },
);

/** Una fila de botones de un grupo (desliza de lado si no caben). */
function FilaFiltro({
  titulo,
  opciones,
  elegida,
  onElegir,
}: {
  titulo: string;
  opciones: Opcion[];
  elegida: string | undefined;
  onElegir: (id: string) => void;
}) {
  if (opciones.length === 0) return null;
  return (
    <div className="flex items-center gap-2" role="group" aria-label={titulo}>
      <span className="w-[5.5rem] shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
        {opciones.map((o) => {
          const activa = o.id === elegida;
          return (
            <button
              key={o.id}
              type="button"
              // Sin quedarse con el foco: el lector sigue escribiendo en el
              // buscador del panel (y su Enter no apaga este filtro).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onElegir(o.id)}
              aria-pressed={activa}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                activa
                  ? "border-marca bg-marca font-semibold text-white"
                  : "border-border bg-background hover:border-marca",
              )}
            >
              {o.nombre}
              <span className={activa ? "text-white/80" : "text-muted-foreground"}>{o.n}</span>
              {activa && <X className="h-3.5 w-3.5" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

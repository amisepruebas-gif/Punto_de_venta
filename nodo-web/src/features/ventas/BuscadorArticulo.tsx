import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Trash2, X, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useArticulos, type SearchEntry } from "@/features/articulos/useArticulos";
import { useCarrito } from "./carritoStore";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import type { Articulo } from "@shared";

/** Handle imperativo expuesto al padre para re-enfocar el input tras
 *  cerrar modales (VariacionPicker o SenaPicker). Sin esto, el scanner
 *  pierde el foco después de cada item escaneado que abrió un modal. */
export type BuscadorArticuloHandle = {
  focus: () => void;
};

// Tope alto solo por seguridad de render (evita pintar miles de nodos si el
// usuario escribe algo como "1" que matchea todo el catálogo). El dropdown
// es scrolleable a partir de la 6ta fila, así que en la práctica el usuario
// ve las primeras 6 y desliza para el resto.
const MAX_SUGERENCIAS = 200;

type Props = {
  /** Llamado cuando el usuario elige un padre con subvariaciones (V2). El
   *  contenedor abre el picker; el buscador se limpia/cierra solo. */
  onPedirVariacion: (padre: Articulo) => void;
  /** Llamado cuando el usuario elige un padre SIN subvariaciones que tiene
   *  el flag `seña`. El contenedor abre el modal de captura; el buscador
   *  se limpia/cierra solo. Replica el flujo de `popVariacion_venta` del
   *  nodo_1 Android para artículos seña-only. */
  onPedirSena: (padre: Articulo) => void;
};

/**
 * Buscador con autocomplete que filtra contra el `searchIndex` derivado en
 * `useArticulos`. En el flujo Fase 6 el index sólo contiene padres; cuando
 * el padre elegido tiene subvariaciones, el contenedor abre un picker.
 *
 * El padre puede llamar `ref.current.focus()` para devolverle el foco al
 * input — útil tras cerrar un modal que tomó el foco. Patrón crítico para
 * el scanner: cada escaneo termina con `Enter`, dispara la elección, y
 * si abre un modal el foco se pierde. Sin re-focus el siguiente escaneo
 * cae en el `body` y nunca llega al buscador.
 */
export const BuscadorArticulo = forwardRef<BuscadorArticuloHandle, Props>(
  function BuscadorArticulo({ onPedirVariacion, onPedirSena }, ref) {
  const { byId, searchIndex, loading } = useArticulos();
  const { agregar, items, limpiar } = useCarrito();
  const hayTecladoFisico = useTecladoFisico();
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-foco programático del input — usado tras `elegir` y expuesto al
  // padre via `useImperativeHandle` para que pueda restaurar el foco al
  // cerrar modales (VariacionPicker, SenaPicker).
  function reEnfocarInput() {
    // rAF para que respete el siguiente paint — sin esto, si React está
    // en medio de commit (limpieza de state tras elegir), el focus()
    // puede ejecutar sobre un DOM transitorio.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      focus: reEnfocarInput,
    }),
    // Sin deps — `reEnfocarInput` es estable (no captura state que cambie
    // su comportamiento), así que es seguro no re-crear el handle.
    [],
  );

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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  function elegir(idx: number) {
    const entry = sugerencias[idx];
    if (!entry) return;
    const padre = byId.get(entry.idPadre);
    if (!padre) return;
    if (entry.tieneVariaciones) {
      onPedirVariacion(padre);
      setQ("");
      setAbierto(false);
      // El padre se encarga de re-enfocar al cerrar el modal (vía
      // imperative handle). Aquí NO re-enfocamos porque el modal abre
      // inmediatamente y nos robaría el foco.
      return;
    }
    // Artículo sin variaciones con flag `seña` → abrir modal para capturar
    // la descripción antes de añadirlo. Replica el comportamiento del
    // popVariacion_venta del nodo_1 Android.
    if (padre.seña !== undefined) {
      onPedirSena(padre);
      setQ("");
      setAbierto(false);
      return;
    }
    const imagenUrl = padre.imagenUrl;
    agregar(padre, {
      ...(imagenUrl ? { imagenUrl } : {}),
    });
    setQ("");
    setAbierto(false);
    // Sin modal — re-enfocar inmediato para que el siguiente scan caiga
    // en el input. Aunque en teoría React preserva el foco al cambiar
    // `value` de un input controlado, navegadores móviles + IME pueden
    // hacer blur en ciertas combinaciones; un focus() explícito blinda.
    reEnfocarInput();
  }

  const carritoVacio = items.length === 0;

  return (
    <div ref={wrapRef} className="relative border-b bg-transparent">
      <div className="flex items-center gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            placeholder={
              loading ? "Cargando artículos…" : "Buscar por nombre, sigla, ID…"
            }
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onKeyDown={(e) => {
              if (!sugerencias.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(sugerencias.length - 1, h + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(0, h - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                elegir(highlight);
              } else if (e.key === "Escape") {
                setAbierto(false);
              }
            }}
            autoFocus
            inputMode={hayTecladoFisico ? "none" : "search"}
            className="rounded-full pl-4 pr-11"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setAbierto(false);
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {abierto && q.trim() && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[21rem] overflow-y-auto overscroll-contain rounded-md border bg-card shadow-lg">
              {sugerencias.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {loading ? "Cargando…" : "Sin resultados"}
                </p>
              ) : (
                <ul role="listbox">
                  {sugerencias.map((entry, idx) => {
                    const padre = byId.get(entry.idPadre);
                    const cantidad = Number(padre?.cantidad) || 0;
                    const imagen = padre?.imagenUrl;
                    return (
                      <li
                        key={entry.idPadre}
                        role="option"
                        aria-selected={idx === highlight}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          elegir(idx);
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
                          <p className="flex items-center gap-1 truncate font-medium">
                            <span className="truncate">{entry.titulo}</span>
                            {entry.tieneVariaciones && (
                              <Layers
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                aria-label="Tiene variaciones"
                              />
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {`${padre?.sigla ? padre.sigla + " · " : ""}#${entry.idPadre}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            ${padre?.precioVenta ?? "—"}
                          </p>
                          {!entry.tieneVariaciones && (
                            <p className="text-[10px] text-muted-foreground">
                              {cantidad} pz
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => limpiar()}
          disabled={carritoVacio}
          className="h-9 shrink-0 rounded-full"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Vaciar
        </Button>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {items.length}{" "}
          {items.length === 1 ? "artículo" : "artículos"}
        </span>
      </div>

    </div>
  );
});

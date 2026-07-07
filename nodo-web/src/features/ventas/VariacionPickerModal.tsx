import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import { useBackHandler } from "@/lib/back-handler";
import type { Articulo, ArticuloSubvariacion } from "@shared";

type Props = {
  /** Cuando es null, el modal está cerrado. */
  padre: Articulo | null;
  onClose: () => void;
  onSelect: (padre: Articulo, sv: ArticuloSubvariacion) => void;
  /** Llamado cuando el cajero usa el botón "Otro" para vender el padre con
   *  una variación NO documentada. `nombre` es el texto que escribió (puede
   *  ser vacío). El item resultante en el carrito lleva `variacionLibre:true`
   *  y `subvariacionNombre = nombre`, sin `subvariacionCodigo`. */
  onSelectOtro: (padre: Articulo, nombre: string) => void;
};

/**
 * Picker de subvariaciones. Se abre cuando el cajero elige un padre con
 * `subvariaciones`. Permite filtrar por nombre arriba y elegir por click
 * en una card de la grilla.
 *
 * UX:
 *   - Tipear filtra por nombre/referencia/código.
 *   - Enter selecciona el primer match.
 *   - Click en card selecciona esa.
 *   - Sin stock → card desaturada (no bloquea venta).
 *   - El backdrop NO cierra el modal — solo la X del header o seleccionar
 *     una variación / confirmar "Otro" lo cierran. Así el cajero no pierde
 *     el contexto si tira un click accidental.
 *   - Botón "Otro" abre un sub-modal para registrar la venta con una
 *     variación no documentada (texto libre, vacío permitido).
 */
export function VariacionPickerModal({
  padre,
  onClose,
  onSelect,
  onSelectOtro,
}: Props) {
  const [q, setQ] = useState("");
  const [otroOpen, setOtroOpen] = useState(false);
  const [otroTexto, setOtroTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const otroInputRef = useRef<HTMLInputElement>(null);
  const hayTecladoFisico = useTecladoFisico();

  useEffect(() => {
    if (padre) {
      setQ("");
      setOtroOpen(false);
      setOtroTexto("");
      // Pequeño delay para que el modal monte antes de enfocar.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [padre]);

  useEffect(() => {
    if (otroOpen) {
      requestAnimationFrame(() => otroInputRef.current?.focus());
    }
  }, [otroOpen]);

  // Back físico Android: cuando el sub-modal "Otro" está abierto, el back
  // debe cerrar SOLO el sub-modal (no el picker entero). El stack-based
  // back-handler procesa top-down, así que registrar este handler aquí lo
  // pone encima del de Ventas.tsx y consumimos primero.
  // Guarda defensiva: solo consumimos si el picker está realmente visible
  // (padre != null). Evita que un estado limbo (padre=null + otroOpen=true)
  // por algún edge-case absorba el back de algo que el usuario no ve.
  const padreVisible = padre !== null;
  useBackHandler(
    () => {
      if (padreVisible && otroOpen) {
        setOtroOpen(false);
        return true;
      }
      return false;
    },
    [padreVisible, otroOpen],
  );

  const subvariaciones = padre?.subvariaciones ?? [];

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return subvariaciones;
    return subvariaciones.filter((sv) => {
      const blob = [sv.nombre, sv.referencia ?? "", sv.codigo ?? ""]
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [q, subvariaciones]);

  if (!padre) return null;

  function elegir(sv: ArticuloSubvariacion) {
    if (!padre) return;
    onSelect(padre, sv);
  }

  function confirmarOtro() {
    if (!padre) return;
    onSelectOtro(padre, otroTexto);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label="Elegir variación"
    >
      <div
        className="flex w-full max-w-6xl flex-col gap-3 rounded-t-xl bg-card p-4 shadow-lg sm:max-h-[92vh] sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{padre.nombre}</h2>
            <p className="text-xs text-muted-foreground">
              Elige una variación · {subvariaciones.length}{" "}
              {subvariaciones.length === 1 ? "opción" : "opciones"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              ref={inputRef}
              placeholder="Filtrar por nombre, referencia o código…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const primera = filtradas[0];
                  if (primera) elegir(primera);
                }
                // Escape NO cierra: el usuario pidió que solo X del header
                // o seleccionar una card cierren el modal.
              }}
              inputMode={hayTecladoFisico ? "none" : "search"}
              className="rounded-full pr-10"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpiar filtro"
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Comodín: registrar venta con variación no documentada en el
              catálogo. Abre un sub-modal que captura un texto libre (puede
              ser vacío). El item resultante en la venta lleva la marca
              `variacionLibre: true` para que admin-web lo identifique. */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOtroTexto("");
              setOtroOpen(true);
            }}
            className="shrink-0 rounded-full"
          >
            Otro
          </Button>
        </div>

        <div className="-mx-1 mt-3 flex-1 overflow-y-auto px-1 pb-1">
          {filtradas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
              {filtradas.map((sv) => {
                const sinStock = (Number(sv.cantidad) || 0) === 0;
                return (
                  <li key={sv.codigo ?? sv.nombre}>
                    <button
                      type="button"
                      onClick={() => elegir(sv)}
                      className={`group flex w-full flex-col items-stretch overflow-hidden rounded-lg border bg-background text-left transition hover:border-primary hover:shadow ${
                        sinStock ? "opacity-50 saturate-0" : ""
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        {sv.imagenUrl ? (
                          <img
                            src={sv.imagenUrl}
                            crossOrigin="anonymous"
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                            decoding="async"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                            <ImageOff className="h-8 w-8" aria-hidden />
                          </div>
                        )}
                        {sinStock && (
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-white">
                            Sin stock
                          </span>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="line-clamp-2 text-xs font-medium leading-tight">
                          {sv.nombre}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Sub-modal "Otro": captura un texto libre para vender el padre con
          una variación no documentada. Texto vacío permitido (el usuario
          confirmó esa regla). Se monta encima del picker — al cerrar
          regresa al picker, no al carrito. */}
      {otroOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal
          aria-label="Variación no documentada"
        >
          <div className="flex w-full max-w-md flex-col gap-3 rounded-t-xl bg-card p-4 shadow-lg sm:rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">
                  {padre.nombre}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Variación no documentada (Otro). Escribe un nombre para el
                  registro o deja vacío.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOtroOpen(false)}
                aria-label="Cancelar"
                className="shrink-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="relative">
              <Input
                ref={otroInputRef}
                value={otroTexto}
                onChange={(e) => setOtroTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmarOtro();
                  }
                }}
                placeholder="Nombre de la variación (opcional)…"
                inputMode={hayTecladoFisico ? "none" : "text"}
                className="pr-9"
                aria-label="Nombre de la variación libre"
              />
              {otroTexto.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOtroTexto("");
                    otroInputRef.current?.focus();
                  }}
                  aria-label="Borrar texto"
                  className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOtroOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={confirmarOtro} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

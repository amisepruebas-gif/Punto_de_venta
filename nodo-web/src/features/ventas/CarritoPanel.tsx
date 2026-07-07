import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CheckCircle2, CircleDashed, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCarrito, subtotalItem } from "./carritoStore";

/**
 * Carrito compacto. Cada fila se elimina o desmarca por gesto:
 *   - Swipe a la IZQUIERDA → revela botón rojo "Eliminar".
 *   - Swipe a la DERECHA → revela botón azul "Desmarcar" (o "Marcar"
 *     si ya está desmarcado).
 *
 * Items "desmarcados" se mantienen visibles pero NO suman al total.
 * COBRAR queda bloqueado mientras haya algún desmarcado (la lógica de
 * bloqueo vive en PagoFooter).
 */
type Props = {
  /** Altura en px que ocupa el PagoFooter superpuesto. La pasa el padre
   *  midiéndolo con ResizeObserver — necesario para que la zona scrolleable
   *  reserve espacio inferior dinámico (transferencia + comisión + banner
   *  de error/desmarcado pueden hacer crecer el footer). Antes era un
   *  `pb-44` fijo (176px) que quedaba corto y "tragaba" los items últimos
   *  detrás del footer cuando el carrito tenía 4+ filas. */
  bottomPadding?: number;
};

const FALLBACK_PADDING = 280;

export function CarritoPanel({ bottomPadding }: Props) {
  const items = useCarrito((s) => s.items);
  const vacio = items.length === 0;

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-transparent">
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: (bottomPadding ?? FALLBACK_PADDING) + 16 }}
      >
        {vacio ? null : (
          <ul className="mx-auto w-full max-w-[25.6rem] list-none space-y-1 p-2">
            {items.map((it) => (
              <CarritoRow key={it.key} itemKey={it.key} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const SWIPE_OPEN_PX = 110; // distancia a la que la fila se queda "abierta"
const SWIPE_ACTIVATE = 55; // dx necesario para snap-open

/**
 * Estados de la fila:
 *  - "closed":  posición normal, acciones ocultas.
 *  - "openLeft":  fila desplazada a la izquierda, acción "Eliminar" visible
 *                 a la derecha esperando confirmación con tap.
 *  - "openRight": fila desplazada a la derecha, acción "Desmarcar" / "Marcar"
 *                 visible a la izquierda esperando confirmación con tap.
 *
 * El swipe NO ejecuta la acción — solo abre la fila. El usuario debe tocar
 * el botón revelado para confirmar. Swipe en sentido contrario cierra.
 */
type EstadoSwipe = "closed" | "openLeft" | "openRight";

function CarritoRow({ itemKey }: { itemKey: string }) {
  const it = useCarrito((s) => s.items.find((i) => i.key === itemKey));
  const incrementar = useCarrito((s) => s.incrementar);
  const decrementar = useCarrito((s) => s.decrementar);
  const quitar = useCarrito((s) => s.quitar);
  const toggleAply3x2 = useCarrito((s) => s.toggleAply3x2);
  const toggleDesmarcado = useCarrito((s) => s.toggleDesmarcado);

  const [estado, setEstado] = useState<EstadoSwipe>("closed");
  // dragX === null cuando NO se está arrastrando.
  const [dragX, setDragX] = useState<number | null>(null);
  const startClientX = useRef<number | null>(null);
  const startRestingX = useRef<number>(0);
  const startY = useRef<number | null>(null);
  const direccion = useRef<"x" | "y" | null>(null);

  if (!it) return null;

  const desmarcado = !!it.desmarcado;
  const subtotal = subtotalItem(it);
  const cantNum = Number(it.cantidad);
  const aply3x2Activo = !!it.aply_3x2;
  const tieneDescuento = !!it.descuento;
  const precioBase = Number(it.precio) || 0;
  const precioFinal = Number(it.descuento) || precioBase;

  // Posición visual = drag activo (si hay) o reposo según estado.
  const restingX =
    estado === "openRight"
      ? SWIPE_OPEN_PX
      : estado === "openLeft"
        ? -SWIPE_OPEN_PX
        : 0;
  const displayX = dragX !== null ? dragX : restingX;

  function onPointerDown(e: ReactPointerEvent<HTMLLIElement>) {
    if (e.pointerType !== "touch" && e.pointerType !== "mouse") return;
    startClientX.current = e.clientX;
    startRestingX.current = restingX;
    startY.current = e.clientY;
    direccion.current = null;
  }

  function onPointerMove(e: ReactPointerEvent<HTMLLIElement>) {
    if (startClientX.current == null) return;
    const dx = e.clientX - startClientX.current;
    const dy = e.clientY - (startY.current ?? 0);

    if (direccion.current == null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        direccion.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }

    if (direccion.current === "x") {
      e.preventDefault();
      const target = startRestingX.current + dx;
      // Limite suave: SWIPE_OPEN_PX × 1.3 a cada lado.
      const max = SWIPE_OPEN_PX * 1.3;
      setDragX(Math.max(-max, Math.min(max, target)));
    }
  }

  function onPointerUp() {
    if (direccion.current === "x" && dragX !== null) {
      // Decide nuevo estado por la posición final del drag.
      if (dragX <= -SWIPE_ACTIVATE) {
        setEstado("openLeft");
      } else if (dragX >= SWIPE_ACTIVATE) {
        setEstado("openRight");
      } else {
        setEstado("closed");
      }
    }
    setDragX(null);
    startClientX.current = null;
    startY.current = null;
    direccion.current = null;
  }

  // Acciones — se confirman con tap en los botones revelados.
  function onAccionEliminar() {
    setEstado("closed");
    quitar(itemKey);
  }
  function onAccionDesmarcar() {
    setEstado("closed");
    toggleDesmarcado(itemKey);
  }

  // Visibilidad de las acciones.
  const muestraIzq = displayX > 8;
  const muestraDer = displayX < -8;
  const izqEnReposo = estado === "openRight";
  const derEnReposo = estado === "openLeft";

  // Texto/ícono de la acción izquierda según marcado/desmarcado.
  const labelIzq = desmarcado ? "Marcar" : "Desmarcar";
  const IconIzq = desmarcado ? CheckCircle2 : CircleDashed;

  return (
    <li
      className="relative overflow-hidden rounded-md select-none touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Acción izquierda — botón "Desmarcar / Marcar". Clickable solo
          cuando la fila está abierta a la derecha (botón visible).
          Mientras se está arrastrando, se muestra como preview pero
          no responde al click hasta que la fila se queda en reposo. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAccionDesmarcar();
        }}
        disabled={!izqEnReposo}
        aria-label={labelIzq}
        className="absolute inset-y-0 left-0 flex items-center justify-start bg-blue-600 px-4 text-white transition-opacity disabled:cursor-default"
        style={{
          opacity: muestraIzq ? 1 : 0,
          width: SWIPE_OPEN_PX,
        }}
      >
        <IconIzq className="mr-2 h-5 w-5" />
        <span className="text-sm font-bold">{labelIzq}</span>
      </button>

      {/* Acción derecha — botón "Eliminar". Mismo patrón. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAccionEliminar();
        }}
        disabled={!derEnReposo}
        aria-label="Eliminar"
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-rose-600 px-4 text-white transition-opacity disabled:cursor-default"
        style={{
          opacity: muestraDer ? 1 : 0,
          width: SWIPE_OPEN_PX,
        }}
      >
        <Trash2 className="mr-2 h-5 w-5" />
        <span className="text-sm font-bold">Eliminar</span>
      </button>

      {/* Contenido — se desplaza con el gesto */}
      <div
        className={`relative flex items-center gap-2 rounded-md border bg-card px-2 py-3 shadow-sm ${
          it.no_registrado ? "border-rose-300 bg-rose-50/40" : ""
        } ${
          desmarcado ? "opacity-50 saturate-0" : ""
        }`}
        style={{
          transform: `translateX(${displayX}px)`,
          transition: dragX === null ? "transform 0.2s ease-out" : "none",
        }}
      >
        {/* Controles horizontales: [+] [-] [cantidad] */}
        <Button
          size="icon"
          variant="outline"
          onClick={() => incrementar(it.key)}
          aria-label="Más"
          className="h-9 w-9 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => decrementar(it.key)}
          aria-label="Menos"
          className="h-9 w-9 shrink-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="shrink-0 text-sm font-bold tabular-nums leading-none">
          {it.cantidad}
          <span className="ml-0.5 text-[9px] font-normal text-muted-foreground">
            pz
          </span>
        </span>

        {/* Miniatura */}
        {it.imagenUrl ? (
          <img
            src={it.imagenUrl}
            crossOrigin="anonymous"
            alt=""
            className="h-9 w-9 shrink-0 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">
            {it.no_registrado ? "NR" : it.descripcion || "—"}
          </div>
        )}

        {/* Centro: nombre + sigla + pills */}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-1">
            <p className="truncate text-xs font-semibold">
              {it.nombrePublico}
            </p>
            {desmarcado && (
              <span className="rounded bg-amber-500/15 px-1 py-0 text-[9px] font-bold text-amber-700">
                DESMARCADO
              </span>
            )}
            {it.no_registrado && (
              <span className="rounded bg-rose-500/15 px-1 py-0 text-[9px] font-bold text-rose-700">
                NR
              </span>
            )}
            {it.talla && (
              <span className="rounded bg-muted px-1 py-0 text-[9px] font-medium">
                T{it.talla}
              </span>
            )}
            {it.seña && (
              <span
                className="max-w-[16ch] truncate rounded bg-emerald-500/15 px-1 py-0 text-[9px] font-medium text-emerald-700"
                title={`Seña: ${it.seña}`}
              >
                SEÑA: {it.seña}
              </span>
            )}
            {tieneDescuento && (
              <span className="rounded bg-amber-500/15 px-1 py-0 text-[9px] font-medium text-amber-700">
                DESC
              </span>
            )}
            {aply3x2Activo && (
              <span className="rounded bg-violet-500/15 px-1 py-0 text-[9px] font-bold text-violet-700">
                3×2
              </span>
            )}
          </div>
          {(it.descripcion ||
            (it.id && it.id !== "00000000") ||
            it.subvariacionCodigo) && (
            <p className="truncate text-[10px] text-muted-foreground">
              {it.subvariacionCodigo ? (
                <span className="font-mono">{it.subvariacionCodigo}</span>
              ) : (
                <>
                  {it.descripcion}
                  {it.id && it.id !== "00000000" && ` · #${it.id}`}
                </>
              )}
            </p>
          )}
          {it.flag3x2 && (
            <button
              type="button"
              onClick={() => toggleAply3x2(it.key)}
              className={`mt-0.5 rounded px-1.5 py-0 text-[9px] font-bold ${
                aply3x2Activo
                  ? "bg-violet-600 text-white"
                  : "border border-violet-400 text-violet-700"
              }`}
            >
              {aply3x2Activo ? `3×2 ON (${it.aply_3x2}×)` : "3 X 2"}
            </button>
          )}
          {cantNum > 1 && cantNum < 3 && it.flag3x2 && !aply3x2Activo && (
            <p className="text-[9px] text-muted-foreground">
              mínimo 3 para 3×2
            </p>
          )}
        </div>

        {/* Derecha: precio unitario + subtotal */}
        <div className="shrink-0 text-right leading-tight">
          <p className="text-[10px] text-muted-foreground">
            {tieneDescuento ? (
              <>
                <span className="line-through">${precioBase}</span> $
                {precioFinal}
              </>
            ) : (
              <>${precioFinal}</>
            )}
            <span className="opacity-70"> c/u</span>
          </p>
          <p className="text-base font-bold tabular-nums">
            ${subtotal.toFixed(0)}
          </p>
        </div>
      </div>
    </li>
  );
}

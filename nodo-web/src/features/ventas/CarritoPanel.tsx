import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Gift,
  Minus,
  Plus,
  ScanBarcode,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCarrito, subtotalItem } from "./carritoStore";

/**
 * Lista de la venta actual, en su propia tarjeta (el cobro ya no flota
 * encima, así que no necesita reservar espacio abajo). Cada fila se elimina
 * o desmarca por gesto:
 *   - Swipe a la IZQUIERDA → revela botón rojo "Eliminar".
 *   - Swipe a la DERECHA → revela botón azul "Desmarcar" (o "Marcar"
 *     si ya está desmarcado).
 *
 * Items "desmarcados" se mantienen visibles pero NO suman al total.
 * COBRAR queda bloqueado mientras haya algún desmarcado (la lógica de
 * bloqueo vive en PagoFooter).
 */
export function CarritoPanel() {
  const items = useCarrito((s) => s.items);
  const vacio = items.length === 0;

  return (
    <section
      aria-label="Venta actual"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3.5">
        <span className="text-sm font-semibold">Venta actual</span>
        <span className="text-[13px] text-muted-foreground">
          {items.length} {items.length === 1 ? "artículo" : "artículos"}
        </span>
        {!vacio && (
          <span className="ml-auto hidden truncate text-xs text-muted-foreground min-[480px]:block">
            Desliza ← para quitar
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {vacio ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <ScanBarcode className="h-8 w-8" aria-hidden />
            <p className="text-sm">Escanea o busca un artículo para empezar.</p>
          </div>
        ) : (
          <ul className="list-none">
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
      className="relative overflow-hidden border-b select-none touch-pan-y last:border-b-0"
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
        className={`relative flex min-h-[3.625rem] items-center gap-2.5 px-3 py-1.5 ${
          it.no_registrado ? "bg-rose-50" : "bg-card"
        } ${
          desmarcado ? "opacity-50 saturate-0" : ""
        }`}
        style={{
          transform: `translateX(${displayX}px)`,
          transition: dragX === null ? "transform 0.2s ease-out" : "none",
        }}
      >
        {/* Miniatura */}
        {it.imagenUrl ? (
          <img
            src={it.imagenUrl}
            crossOrigin="anonymous"
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
            {it.no_registrado ? "NR" : it.descripcion || "—"}
          </div>
        )}

        {/* Centro: nombre + sigla + pills */}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-1">
            <p className="truncate text-[15px] font-semibold">
              {it.nombrePublico}
            </p>
            {desmarcado && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
                DESMARCADO
              </span>
            )}
            {it.no_registrado && (
              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-bold text-rose-800">
                NR
              </span>
            )}
            {it.talla && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                T{it.talla}
              </span>
            )}
            {it.seña && (
              <span
                className="max-w-[16ch] truncate rounded bg-cobro-suave px-1.5 py-0.5 text-[11px] font-medium text-cobro-texto"
                title={`Seña: ${it.seña}`}
              >
                SEÑA: {it.seña}
              </span>
            )}
            {tieneDescuento && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                DESC
              </span>
            )}
            {aply3x2Activo && (
              <span className="rounded bg-lealtad-suave px-1.5 py-0.5 text-[11px] font-bold text-lealtad-texto">
                3×2
              </span>
            )}
          </div>
          {(it.descripcion ||
            (it.id && it.id !== "00000000") ||
            it.subvariacionCodigo) && (
            <p className="truncate text-[13px] text-muted-foreground">
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
              className={`mt-1 h-7 rounded-md px-2 text-xs font-bold ${
                aply3x2Activo
                  ? "bg-lealtad text-white"
                  : "border border-lealtad-borde bg-lealtad-suave text-lealtad-texto"
              }`}
            >
              {aply3x2Activo ? `3×2 ON (${it.aply_3x2}×)` : "3 X 2"}
            </button>
          )}
          {cantNum > 1 && cantNum < 3 && it.flag3x2 && !aply3x2Activo && (
            <p className="text-[11px] text-muted-foreground">
              mínimo 3 para 3×2
            </p>
          )}
        </div>

        {/* Cantidad: [−] n [+], de 44 px para el dedo. La línea gift NO se
            puede multiplicar (una tarjeta física = una denominación) → sin
            +/−; se elimina deslizando. */}
        {it.giftCard ? (
          <span
            className="flex h-11 w-[8.25rem] shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-amber-50 text-[13px] font-semibold text-amber-800"
            title="Tarjeta de regalo"
          >
            <Gift className="h-[18px] w-[18px]" aria-hidden />
            Regalo
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              size="icon"
              variant="outline"
              onClick={() => decrementar(it.key)}
              aria-label="Una pieza menos"
              className="h-11 w-11 rounded-[10px]"
            >
              <Minus className="h-[18px] w-[18px]" />
            </Button>
            <span className="w-9 text-center text-[17px] font-bold tabular-nums">
              {it.cantidad}
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => incrementar(it.key)}
              aria-label="Una pieza más"
              className="h-11 w-11 rounded-[10px]"
            >
              <Plus className="h-[18px] w-[18px]" />
            </Button>
          </div>
        )}

        {/* Derecha: precio unitario + subtotal */}
        <div className="min-w-[4.75rem] shrink-0 text-right leading-tight">
          <p className="text-xs text-muted-foreground">
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
          {it.mayoreoAply && (
            <p className="text-[11px] font-bold uppercase text-cobro-texto">
              Mayoreo {it.escalonMinPz ? `${it.escalonMinPz}+ pz` : ""}
            </p>
          )}
          <p className="text-[17px] font-bold tabular-nums">
            ${subtotal.toFixed(0)}
          </p>
        </div>
      </div>
    </li>
  );
}

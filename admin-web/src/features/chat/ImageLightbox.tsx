import { useEffect, useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";

type Props = {
  src: string | null;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_TAP_MS = 280;

/**
 * Visor de imagen fullscreen con gestos táctiles:
 *   - Pinch (dos dedos) → zoom centrado entre los dedos.
 *   - Drag (un dedo, con zoom) → pan.
 *   - Doble-tap → alterna entre 1x y 2.5x centrado en el punto del tap.
 *   - Tap fuera o botón X → cierra.
 *
 * Usa Pointer Events (compatibles con touch + mouse + pen). El elemento
 * captura los punteros activos en un Map para soportar pinch
 * multi-touch sin librerías externas.
 *
 * `touchAction: "none"` es clave: evita que el navegador haga su propio
 * scroll/zoom y ahogue los gestos.
 */
export function ImageLightbox({ src, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const punteros = useRef<Map<number, { x: number; y: number }>>(new Map());
  const distInicial = useRef<number>(0);
  const escalaInicial = useRef<number>(1);
  const txInicial = useRef<number>(0);
  const tyInicial = useRef<number>(0);
  const ultimoTap = useRef<number>(0);

  // Reset cuando cambia la imagen o se cierra.
  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
    punteros.current.clear();
  }, [src]);

  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  if (!src) return null;

  function distancia(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function centro(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size === 2) {
      const [p1, p2] = Array.from(punteros.current.values());
      distInicial.current = distancia(p1, p2);
      escalaInicial.current = scale;
      txInicial.current = tx;
      tyInicial.current = ty;
    } else if (punteros.current.size === 1) {
      txInicial.current = tx;
      tyInicial.current = ty;

      // Detectar doble-tap.
      const ahora = Date.now();
      if (ahora - ultimoTap.current < DOUBLE_TAP_MS) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          if (scale > 1.05) {
            setScale(1);
            setTx(0);
            setTy(0);
          } else {
            // Zoom 2.5x centrado en el punto del tap.
            const objetivo = 2.5;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const px = e.clientX - rect.left - cx;
            const py = e.clientY - rect.top - cy;
            setScale(objetivo);
            setTx(-px * (objetivo - 1));
            setTy(-py * (objetivo - 1));
          }
        }
        ultimoTap.current = 0;
      } else {
        ultimoTap.current = ahora;
      }
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!punteros.current.has(e.pointerId)) return;
    const prev = punteros.current.get(e.pointerId)!;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size === 2) {
      // Pinch: actualizar escala basado en cambio de distancia entre los
      // dos punteros.
      const [p1, p2] = Array.from(punteros.current.values());
      const distActual = distancia(p1, p2);
      if (distInicial.current > 0) {
        const ratio = distActual / distInicial.current;
        const nuevaEscala = clamp(
          escalaInicial.current * ratio,
          MIN_SCALE,
          MAX_SCALE,
        );
        setScale(nuevaEscala);
        // Mantener el centro entre dedos como ancla.
        const c = centro(p1, p2);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const dx = c.x - rect.left - rect.width / 2;
          const dy = c.y - rect.top - rect.height / 2;
          const factor = nuevaEscala / escalaInicial.current;
          setTx(txInicial.current * factor + dx * (1 - factor));
          setTy(tyInicial.current * factor + dy * (1 - factor));
        }
      }
    } else if (punteros.current.size === 1 && scale > 1) {
      // Pan con un dedo cuando hay zoom.
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setTx((t) => t + dx);
      setTy((t) => t + dy);
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) {
      distInicial.current = 0;
    }
    if (punteros.current.size === 0) {
      // Si la escala bajó por debajo de 1 (rebote), regresa a 1.
      if (scale < MIN_SCALE) {
        setScale(MIN_SCALE);
        setTx(0);
        setTy(0);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Hint discreto solo en la primera apertura — no necesita estado
          adicional, simplemente se desvanece cuando hay zoom. */}
      {scale === 1 && (
        <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1 text-xs text-white/70 backdrop-blur-sm">
          Pellizca para hacer zoom · Doble toque para acercar
        </p>
      )}

      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="select-none"
          style={{
            maxHeight: "90vh",
            maxWidth: "95vw",
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: punteros.current.size === 0 ? "transform 0.18s ease-out" : "none",
            willChange: "transform",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

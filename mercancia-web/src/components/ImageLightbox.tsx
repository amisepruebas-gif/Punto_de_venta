import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  /** Cuando es null, el lightbox está cerrado. */
  src: string | null;
  onClose: () => void;
  alt?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;
const WHEEL_STEP = 0.0018;

/**
 * Visor full-screen con zoom y pan. Emula el gesto nativo de visor de
 * imagen: pinch en móvil (PointerEvents 2-touch), rueda en escritorio,
 * doble click/tap para alternar 1× ↔ 2.5×, click+drag para mover cuando
 * está zoomeado, Esc o click fuera para cerrar.
 *
 * Implementado con CSS transform (`translate` + `scale`) y PointerEvents
 * unificados para que toque y mouse usen el mismo código.
 */
export function ImageLightbox({ src, onClose, alt = "" }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(
    new Map<number, { x: number; y: number }>(),
  );
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialScale: number;
  } | null>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);
  const lastTapRef = useRef(0);

  // Reset al abrir.
  useEffect(() => {
    if (src) {
      setScale(1);
      setTx(0);
      setTy(0);
      pointersRef.current.clear();
      pinchStateRef.current = null;
      panStartRef.current = null;
    }
  }, [src]);

  // Esc para cerrar.
  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  const clampScale = useCallback(
    (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)),
    [],
  );

  const clampTranslate = useCallback(
    (s: number, txIn: number, tyIn: number) => {
      const el = containerRef.current;
      if (!el || s <= 1) return { tx: 0, ty: 0 };
      const w = el.clientWidth;
      const h = el.clientHeight;
      const maxX = (w * (s - 1)) / 2;
      const maxY = (h * (s - 1)) / 2;
      return {
        tx: Math.max(-maxX, Math.min(maxX, txIn)),
        ty: Math.max(-maxY, Math.min(maxY, tyIn)),
      };
    },
    [],
  );

  // Wheel listener manual (no-passive) para poder llamar preventDefault y
  // evitar que el scroll del documento se mueva al zoomear.
  useEffect(() => {
    if (!src) return;
    const el = containerRef.current;
    if (!el) return;
    function handler(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Punto del puntero relativo al centro del contenedor.
      const px = e.clientX - cx;
      const py = e.clientY - cy;
      const factor = Math.exp(-e.deltaY * WHEEL_STEP);
      setScale((prev) => {
        const next = clampScale(prev * factor);
        const ratio = next / prev;
        setTx((ptx) => {
          const nx = px - (px - ptx) * ratio;
          return clampTranslate(next, nx, 0).tx;
        });
        setTy((pty) => {
          const ny = py - (py - pty) * ratio;
          return clampTranslate(next, 0, ny).ty;
        });
        return next;
      });
    }
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [src, clampScale, clampTranslate]);

  if (!src) return null;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const a = pts[0]!;
      const b = pts[1]!;
      pinchStateRef.current = {
        initialDistance: Math.hypot(a.x - b.x, a.y - b.y),
        initialScale: scale,
      };
      panStartRef.current = null;
    } else if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStateRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const a = pts[0]!;
      const b = pts[1]!;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / pinchStateRef.current.initialDistance;
      const next = clampScale(pinchStateRef.current.initialScale * ratio);
      setScale(next);
      // Mantener pan dentro de los límites con la nueva escala.
      const c = clampTranslate(next, tx, ty);
      setTx(c.tx);
      setTy(c.ty);
    } else if (
      pointersRef.current.size === 1 &&
      panStartRef.current &&
      scale > 1
    ) {
      const start = panStartRef.current;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const c = clampTranslate(scale, start.tx + dx, start.ty + dy);
      setTx(c.tx);
      setTy(c.ty);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      panStartRef.current = null;
      const c = clampTranslate(scale, tx, ty);
      setTx(c.tx);
      setTy(c.ty);
    } else if (pointersRef.current.size === 1) {
      // Quedó un solo dedo tras pinch — re-iniciar pan desde aquí.
      const remaining = Array.from(pointersRef.current.values())[0]!;
      panStartRef.current = { x: remaining.x, y: remaining.y, tx, ty };
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (scale > 1) {
      setScale(1);
      setTx(0);
      setTy(0);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    const next = DOUBLE_TAP_SCALE;
    const newTx = -px * (next - 1);
    const newTy = -py * (next - 1);
    const c = clampTranslate(next, newTx, newTy);
    setScale(next);
    setTx(c.tx);
    setTy(c.ty);
  }

  function onClickContent(e: React.MouseEvent) {
    e.stopPropagation();
    // Detección manual de doble-tap para móvil (ondblclick no siempre
    // dispara con touch). Si dos taps caen en <300ms, alterna zoom.
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleClick(e);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  }

  function btnZoom(delta: number) {
    setScale((prev) => {
      const next = clampScale(prev * delta);
      const c = clampTranslate(next, tx, ty);
      setTx(c.tx);
      setTy(c.ty);
      return next;
    });
  }

  function btnReset() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Imagen ampliada"
    >
      {/* Toolbar superior */}
      <div
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => btnZoom(0.8)}
          aria-label="Reducir"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => btnZoom(1.25)}
          aria-label="Aumentar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={btnReset}
          aria-label="Ajustar a pantalla"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative h-full w-full touch-none select-none overflow-hidden"
        onClick={onClickContent}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none absolute inset-0 m-auto h-full w-full object-contain"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}

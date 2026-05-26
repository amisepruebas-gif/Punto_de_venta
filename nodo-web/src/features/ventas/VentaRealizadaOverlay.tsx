import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

type Props = {
  show: boolean;
  onDone: () => void;
};

/**
 * Replica `pop/ventaRealizada.java` + `venta_realizada.xml` del Android nodo_1:
 * overlay blanco fullscreen con texto "venta realizada" + palomita,
 * fade-in/fade-out (~1.4s total) y luego dispara `onDone` para abrir el ticket.
 *
 * `onDone` se mantiene en un ref para que cambios de identidad de la callback
 * (cuando el padre re-renderiza por subscripciones de Firestore) no reinicien
 * los timers — si los reiniciaran, `tEnd` nunca dispararía y el TicketModal
 * jamás se abriría.
 */
export function VentaRealizadaOverlay({ show, onDone }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!show) return;
    setMounted(true);
    setVisible(false);
    const tIn = window.setTimeout(() => setVisible(true), 20);
    const tOut = window.setTimeout(() => setVisible(false), 900);
    const tEnd = window.setTimeout(() => {
      setMounted(false);
      onDoneRef.current();
    }, 1400);
    return () => {
      window.clearTimeout(tIn);
      window.clearTimeout(tOut);
      window.clearTimeout(tEnd);
    };
  }, [show]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <p
        className="text-3xl font-medium tracking-wide"
        style={{ color: "#1d4ed8" }}
      >
        venta realizada
      </p>
      <div className="mt-4 flex h-32 w-32 items-center justify-center rounded-full border-4 border-current text-blue-700">
        <Check className="h-16 w-16" strokeWidth={3} />
      </div>
    </div>
  );
}

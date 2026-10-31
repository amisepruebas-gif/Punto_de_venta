import { Gift } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para VENDER una tarjeta de regalo (Feature 5, Fase 2).
 * El orden y la posición los da PilaBotonesFlotantes (Ventas.tsx).
 */
export function FloatingVenderRegaloButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vender tarjeta de regalo"
      className="pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-amber-600 active:scale-95"
    >
      <Gift className="h-6 w-6" />
    </button>
  );
}

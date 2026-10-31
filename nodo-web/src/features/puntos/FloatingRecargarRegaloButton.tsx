import { WalletCards } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para RECARGAR una tarjeta de regalo existente (Feature 5, Fase 2).
 * El orden y la posición los da PilaBotonesFlotantes (Ventas.tsx).
 */
export function FloatingRecargarRegaloButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Recargar tarjeta de regalo"
      className="pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-700 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-amber-800 active:scale-95"
    >
      <WalletCards className="h-6 w-6" />
    </button>
  );
}

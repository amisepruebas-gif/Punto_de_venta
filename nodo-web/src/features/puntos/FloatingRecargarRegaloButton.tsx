import { WalletCards } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para RECARGAR una tarjeta de regalo existente (Feature 5, Fase 2). Va ENCIMA
 * del FAB de vender regalo (`bottom-[33.2rem]`). Stack (abajo→arriba):
 * chat(8) → apartar(12.2) → no-reg(16.4) → reimprimir(20.6) → pre-registro(24.8)
 * → vender-regalo(29) → recargar-regalo(33.2).
 */
export function FloatingRecargarRegaloButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Recargar tarjeta de regalo"
      className="pointer-events-auto fixed bottom-[33.2rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-amber-800 active:scale-95"
    >
      <WalletCards className="h-6 w-6" />
    </button>
  );
}

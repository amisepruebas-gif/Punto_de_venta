import { Gift } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para VENDER una tarjeta de regalo (Feature 5, Fase 2). Va ENCIMA del FAB de
 * pre-registro (`bottom-[29rem]`). Stack (abajo→arriba):
 * chat(8) → apartar(12.2) → no-reg(16.4) → reimprimir(20.6) → pre-registro(24.8)
 * → regalo(29).
 */
export function FloatingVenderRegaloButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vender tarjeta de regalo"
      className="pointer-events-auto fixed bottom-[29rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-amber-600 active:scale-95"
    >
      <Gift className="h-6 w-6" />
    </button>
  );
}

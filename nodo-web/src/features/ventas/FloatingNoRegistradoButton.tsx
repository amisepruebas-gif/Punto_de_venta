import { PackagePlus } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para registrar venta NO REGISTRADA. El orden y la posición los da
 * PilaBotonesFlotantes (Ventas.tsx).
 */
export function FloatingNoRegistradoButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vender artículo no registrado"
      className="pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-rose-700 active:scale-95"
    >
      <PackagePlus className="h-6 w-6" />
    </button>
  );
}

import { Bookmark } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * Botón flotante para crear apartado. El orden y la posición los da
 * PilaBotonesFlotantes (Ventas.tsx).
 */
export function FloatingApartarButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Crear apartado"
      className="pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95"
    >
      <Bookmark className="h-6 w-6" />
    </button>
  );
}

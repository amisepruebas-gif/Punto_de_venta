import { Bookmark } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * Botón flotante para crear apartado, posicionado encima del FAB de chat
 * (que está en `bottom-[8rem] right-4`). Stack: chat abajo, apartar arriba.
 */
export function FloatingApartarButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Crear apartado"
      className="pointer-events-auto fixed bottom-[12.2rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95"
    >
      <Bookmark className="h-6 w-6" />
    </button>
  );
}

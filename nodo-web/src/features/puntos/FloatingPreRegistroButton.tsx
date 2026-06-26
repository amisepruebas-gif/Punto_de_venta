import { UserPlus } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para PRE-REGISTRAR un cliente al programa de puntos. Va encima del FAB de
 * "no registrado" (`bottom-[16.4rem]`). Stack (abajo→arriba):
 * chat → apartar → no-reg → pre-registro puntos.
 */
export function FloatingPreRegistroButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Pre-registrar cliente de puntos"
      className="pointer-events-auto fixed bottom-[20.6rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95"
    >
      <UserPlus className="h-6 w-6" />
    </button>
  );
}

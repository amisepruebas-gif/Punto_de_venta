import { UserPlus } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para PRE-REGISTRAR un cliente al programa de puntos. Va ENCIMA del FAB de
 * reimprimir (`bottom-[20.6rem]`). Stack (abajo→arriba):
 * chat(8) → apartar(12.2) → no-reg(16.4) → reimprimir(20.6) → pre-registro(24.8).
 */
export function FloatingPreRegistroButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Pre-registrar cliente de puntos"
      className="pointer-events-auto fixed bottom-[24.8rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95"
    >
      <UserPlus className="h-6 w-6" />
    </button>
  );
}

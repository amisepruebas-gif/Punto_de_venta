import { PackagePlus } from "lucide-react";

type Props = {
  onClick: () => void;
};

/**
 * FAB para registrar venta NO REGISTRADA. Vive arriba del FAB de
 * apartados (que está en `bottom-[12.2rem]`). Stack de FABs
 * (de abajo hacia arriba): chat → apartar → no-reg.
 */
export function FloatingNoRegistradoButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Vender artículo no registrado"
      className="pointer-events-auto fixed bottom-[16.4rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-rose-700 active:scale-95"
    >
      <PackagePlus className="h-6 w-6" />
    </button>
  );
}

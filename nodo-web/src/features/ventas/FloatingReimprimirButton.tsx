import { Printer } from "lucide-react";

type Props = {
  onClick: () => void;
  disabled: boolean;
  numeroDeVenta?: string | number;
};

/**
 * FAB para reimprimir el ticket de la última venta. El orden y la posición los da
 * PilaBotonesFlotantes (Ventas.tsx).
 *
 * Se deshabilita visualmente cuando aún no hay una venta en la sesión.
 */
export function FloatingReimprimirButton({
  onClick,
  disabled,
  numeroDeVenta,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        disabled
          ? "Sin ventas para reimprimir"
          : `Reimprimir ticket #${numeroDeVenta ?? ""}`.trim()
      }
      className={`pointer-events-auto relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-black/20 transition-transform ${
        disabled
          ? "cursor-not-allowed bg-slate-400/60 opacity-60"
          : "bg-sky-600 hover:scale-105 hover:bg-sky-700 active:scale-95"
      }`}
    >
      <Printer className="h-6 w-6" />
    </button>
  );
}

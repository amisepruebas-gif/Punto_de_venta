import { useEffect, useRef, useState } from "react";
import { Gift, UserPlus, WalletCards } from "lucide-react";

type Props = {
  onPreRegistro: () => void;
  onVenderRegalo: () => void;
  onRecargarRegalo: () => void;
};

/**
 * Botón flotante "Puntos y regalo". Junta en un menú las acciones de lealtad
 * que no se usan en cada venta (pre-registrar cliente, vender y recargar
 * tarjeta de regalo), para que la pila de Ventas quepa en tablets chicas.
 * El menú abre a la izquierda y hacia abajo del botón: hacia arriba lo
 * recortaría el área del carrito cuando el botón queda hasta arriba.
 */
export function MenuPuntosRegalo({
  onPreRegistro,
  onVenderRegalo,
  onRecargarRegalo,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const opciones = [
    {
      label: "Pre-registrar cliente de puntos",
      Icono: UserPlus,
      color: "bg-indigo-600",
      onClick: onPreRegistro,
    },
    {
      label: "Vender tarjeta de regalo",
      Icono: Gift,
      color: "bg-amber-500",
      onClick: onVenderRegalo,
    },
    {
      label: "Recargar tarjeta de regalo",
      Icono: WalletCards,
      color: "bg-amber-700",
      onClick: onRecargarRegalo,
    },
  ];

  return (
    <div ref={ref} className="pointer-events-auto relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Puntos y tarjetas de regalo"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 hover:bg-amber-600 active:scale-95"
      >
        <Gift className="h-6 w-6" />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-full top-0 mr-2 flex w-64 flex-col gap-1 rounded-lg border bg-card p-1.5 shadow-xl"
        >
          {opciones.map(({ label, Icono, color, onClick }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onClick();
              }}
              className="flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-accent active:bg-accent"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${color}`}
              >
                <Icono className="h-5 w-5" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Gift, UserPlus, UserX, WalletCards } from "lucide-react";
import { claseBotonAccion } from "@/features/ventas/BarraAcciones";
import { cn } from "@/lib/utils";

type Props = {
  onPreRegistro: () => void;
  onVenderRegalo: () => void;
  onRecargarRegalo: () => void;
  /** Correo del cliente pre-registrado en espera, si hay. */
  pendienteCorreo?: string | null;
  onQuitarPendiente?: () => void;
};

/**
 * Botón "Cashback y regalo" de la barra de acciones. Junta en un menú las
 * acciones de lealtad que no se usan en cada venta (pre-registrar cliente,
 * vender y recargar tarjeta de regalo). Con un cliente en espera lleva un
 * punto y permite quitarlo. El menú abre hacia arriba, sobre la lista.
 */
export function MenuPuntosRegalo({
  onPreRegistro,
  onVenderRegalo,
  onRecargarRegalo,
  pendienteCorreo,
  onQuitarPendiente,
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
      label: "Pre-registrar cliente de cashback",
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
    ...(pendienteCorreo && onQuitarPendiente
      ? [
          {
            label: `Quitar cliente en espera (${pendienteCorreo})`,
            Icono: UserX,
            color: "bg-rose-600",
            onClick: onQuitarPendiente,
          },
        ]
      : []),
  ];

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Cashback y tarjetas de regalo"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={cn(claseBotonAccion, "border-lealtad-borde text-lealtad-texto")}
      >
        <Gift className="h-5 w-5 shrink-0" aria-hidden />
        <span className="line-clamp-2">Cashback y regalo</span>
        {pendienteCorreo && (
          <span
            className="absolute right-2 top-1.5 h-3 w-3 rounded-full border-2 border-card bg-lealtad"
            aria-label="Hay un cliente en espera"
          />
        )}
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-40 mb-2 flex w-64 flex-col gap-1 rounded-lg border bg-card p-1.5 shadow-xl"
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

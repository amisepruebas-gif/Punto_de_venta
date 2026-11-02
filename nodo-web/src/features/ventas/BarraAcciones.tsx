import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Botón de la barra: ícono arriba, nombre abajo y 52 px de alto. */
export const claseBotonAccion =
  "relative flex h-[3.25rem] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card px-1 text-center text-[12.5px] font-semibold leading-tight text-foreground transition-colors hover:bg-muted active:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-card";

/**
 * Barra de acciones de Ventas, debajo de la lista. Reemplaza a los botones
 * flotantes: cada acción lleva su nombre y ninguna tapa artículos.
 */
export function BarraAcciones({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="Acciones rápidas"
      className="grid shrink-0 grid-cols-5 gap-2"
    >
      {children}
    </nav>
  );
}

type Props = {
  icono: LucideIcon;
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  /** Pendientes (ej. mensajes sin leer). Solo se muestra si > 0. */
  badge?: number;
  /** Nombre para lectores de pantalla cuando el visible no basta. */
  ariaLabel?: string;
};

export function BotonAccion({
  icono: Icono,
  etiqueta,
  onClick,
  disabled,
  badge = 0,
  ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={claseBotonAccion}
    >
      <Icono className="h-5 w-5 shrink-0" aria-hidden />
      <span className="line-clamp-2">{etiqueta}</span>
      {badge > 0 && (
        <span className="absolute right-2 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

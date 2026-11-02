import { Receipt, type LucideIcon } from "lucide-react";

/** En tablet parada el ícono va arriba del nombre; desde 1000 px, al lado. */
const base =
  "relative flex h-12 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[10px] text-xs font-semibold transition-colors min-[1000px]:h-11 min-[1000px]:w-auto min-[1000px]:flex-row min-[1000px]:gap-1.5 min-[1000px]:px-2.5 min-[1000px]:text-sm";

type Props = {
  icono: LucideIcon;
  etiqueta: string;
  onClick: () => void;
  /** Pendientes (ej. resurtidos por recibir). Solo se muestra si > 0. */
  badge?: number;
};

/** Botón de la cabecera de Ventas: cada ícono lleva su nombre. */
export function BotonCabecera({ icono: Icono, etiqueta, onClick, badge = 0 }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge > 0 ? `${etiqueta} (${badge})` : undefined}
      className={`${base} text-foreground hover:bg-muted active:bg-muted`}
    >
      <Icono className="h-5 w-5 shrink-0" aria-hidden />
      {etiqueta}
      {badge > 0 && (
        <span className="absolute right-1.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-aviso-badge px-1 text-[11px] font-bold text-aviso min-[1000px]:static min-[1000px]:h-5 min-[1000px]:min-w-5 min-[1000px]:text-xs">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Corte de caja: verde mientras hay un corte en curso. */
export function BotonCorte({ abierto, onClick }: { abierto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={abierto ? "Corte en curso" : "Iniciar corte"}
      className={`${base} min-[1000px]:rounded-full min-[1000px]:px-3.5 ${
        abierto
          ? "bg-cobro-suave text-cobro-texto"
          : "text-foreground hover:bg-muted active:bg-muted min-[1000px]:border min-[1000px]:border-border min-[1000px]:bg-card"
      }`}
    >
      <Receipt className="h-5 w-5 shrink-0 min-[1000px]:hidden" aria-hidden />
      <span
        className={`hidden h-2 w-2 shrink-0 rounded-full min-[1000px]:block ${
          abierto ? "bg-cobro" : "bg-muted-foreground"
        }`}
        aria-hidden
      />
      <span className="min-[1000px]:hidden">Corte</span>
      <span className="hidden min-[1000px]:inline">
        {abierto ? "Corte en curso" : "Iniciar corte"}
      </span>
    </button>
  );
}

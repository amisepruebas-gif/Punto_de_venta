import { UserRound } from "lucide-react";
import { useSession } from "@/hooks/useSession";

/**
 * Barra delgada con quién entró con su PIN y en qué sucursal. La pone
 * `Protected` (App.tsx) arriba de TODAS las páginas con PIN, así ninguna se
 * queda sin ella. Toma la zona segura de arriba; los encabezados fijos de
 * cada página se pegan debajo (`.con-barra-sesion` en globals.css).
 */
export function BarraSesion() {
  const { binding, auth } = useSession();
  return (
    <div className="sticky top-0 z-30 bg-primary pt-[env(safe-area-inset-top)] text-primary-foreground">
      <p className="mx-auto flex h-7 w-full max-w-md items-center gap-1.5 px-3 text-xs">
        <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate font-semibold">{auth?.nombre || "Sin nombre"}</span>
        <span className="shrink-0 opacity-60" aria-hidden>
          ·
        </span>
        <span className="truncate opacity-80">{binding?.sucursalNombre}</span>
      </p>
    </div>
  );
}

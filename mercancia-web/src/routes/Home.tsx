import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  FolderTree,
  LogOut,
  Package,
  Ruler,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout, useSession } from "@/hooks/useSession";

type Tile = {
  to: string;
  label: string;
  icon: LucideIcon;
  estado: "ok" | "proximo";
};

const TILES: Tile[] = [
  { to: "/articulos", label: "Artículos", icon: Package, estado: "ok" },
  {
    to: "/categorias",
    label: "Categorías",
    icon: FolderTree,
    estado: "ok",
  },
  { to: "/tallas", label: "Tallas", icon: Ruler, estado: "ok" },
  {
    to: "/ingreso",
    label: "Ingreso",
    icon: Truck,
    estado: "ok",
  },
  {
    to: "/resurtidos",
    label: "Resurtidos",
    icon: ArrowRightLeft,
    estado: "ok",
  },
];

export function Home() {
  const navigate = useNavigate();
  const { binding, auth } = useSession();

  function salir() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
            {binding?.sucursalNombre}
          </p>
          <h1 className="truncate text-base font-semibold">{auth?.nombre}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={salir}
          aria-label="Cerrar sesión"
        >
          <LogOut className="mr-1 h-4 w-4" /> Salir
        </Button>
      </header>

      <main className="grid flex-1 grid-cols-2 content-start gap-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {TILES.map(({ to, label, icon: Icon, estado }) => (
          <button
            key={to}
            type="button"
            onClick={() => estado === "ok" && navigate(to)}
            disabled={estado !== "ok"}
            className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
            <span className="text-sm font-medium">{label}</span>
            {estado !== "ok" && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                Próx.
              </span>
            )}
          </button>
        ))}
      </main>
    </div>
  );
}

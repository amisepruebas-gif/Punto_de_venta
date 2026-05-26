import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Package,
  LayoutDashboard,
  Users,
  Building2,
  MessageSquare,
  ShoppingBag,
  ScrollText,
  BarChart3,
  Settings,
  Menu,
  X,
  Smartphone,
  Ruler,
  Bookmark,
  FolderTree,
  Truck,
  Sparkles,
  KeyRound,
  ArrowRightLeft,
  MessagesSquare,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { useNegocio } from "@/hooks/useNegocio";
import { useChatNotifications } from "@/features/chat/useChatNotifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/articulos", label: "Artículos", icon: Package },
  { to: "/categorias", label: "Categorías", icon: FolderTree },
  { to: "/ingreso-mercancia", label: "Ingreso", icon: Truck },
  { to: "/resurtidos", label: "Resurtidos", icon: ArrowRightLeft },
  { to: "/ventas", label: "Ventas", icon: ShoppingBag },
  { to: "/cortes", label: "Cortes", icon: ScrollText },
  { to: "/apartados", label: "Apartados", icon: Bookmark },
  { to: "/reportes/mas-vendidos", label: "Más vendidos", icon: BarChart3 },
  { to: "/reportes/articulo", label: "Por artículo", icon: Package },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/gastos-firebase", label: "Gastos Firebase", icon: Sparkles },
  { to: "/tallas", label: "Tallas", icon: Ruler },
  { to: "/sucursales", label: "Sucursales", icon: Building2 },
  { to: "/nodos", label: "Nodos", icon: Smartphone },
  { to: "/equipo", label: "Equipo", icon: Users },
  { to: "/equipo-chat", label: "Equipo chat", icon: MessagesSquare },
  {
    to: "/usuarios-mercancia",
    label: "Usuarios mercancía",
    icon: KeyRound,
  },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

export function AppShell() {
  const { user } = useAuth();
  // Notificaciones de chat (sonido + Web Notification) — montado aquí
  // para que funcione en cualquier ruta admin, no solo `/chat`. Si la
  // pestaña no está visible y el user concedió permiso, dispara
  // notificación OS al llegar mensaje nuevo.
  useChatNotifications();
  const { negocio } = useNegocio();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();

  // Cerrar drawer al navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  const navContent = (
    <>
      <div className="flex h-14 items-center justify-between border-b px-4">
        <h1 className="text-base font-semibold">{negocio?.nombre ?? "Amise"}</h1>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon, disabled }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                disabled && "pointer-events-none opacity-50",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
            {disabled && (
              <span className="ml-auto text-[10px] uppercase">Próx.</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <p className="truncate text-xs text-muted-foreground">
          {user?.user.email}
        </p>
        <p className="text-xs text-muted-foreground">{user?.claims.role}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut(auth)}
          className="mt-2 w-full"
        >
          Cerrar sesión
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-background">
      {/* ---------- Sidebar desktop ---------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        {navContent}
      </aside>

      {/* ---------- Drawer móvil ---------- */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="flex h-full w-60 flex-col border-r bg-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </aside>
        </div>
      )}

      {/* ---------- Main area ---------- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b bg-card px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-sm font-semibold">
            {negocio?.nombre ?? "Amise"}
          </h1>
          <div className="w-10" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

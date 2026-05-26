import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirestoreStatsCard } from "@/features/ajustes/FirestoreStatsCard";
import { AppCard } from "@/features/ajustes/secciones/AppCard";
import { AparienciaCard } from "@/features/ajustes/secciones/AparienciaCard";
import { CacheStatsCard } from "@/features/ajustes/secciones/CacheStatsCard";
import { CuentaCard } from "@/features/ajustes/secciones/CuentaCard";
import { HardwareCard } from "@/features/ajustes/secciones/HardwareCard";
import { useNodoSession } from "@/hooks/useNodoSession";
import { logout } from "@/firebase/auth";

/**
 * Página de ajustes del nodo. Cada sección es un componente propio en
 * `features/ajustes/secciones/` para que crezca sin saturar este archivo.
 *
 * Convención: para añadir una sección nueva, crea el componente, impórtalo,
 * y agrégalo al render. Si la sección requiere bridge nativo (APK), usa
 * `posDisponible()` adentro y muestra un placeholder en navegador.
 */
export function Ajustes() {
  const navigate = useNavigate();
  const { setSession } = useNodoSession();

  async function onSalir() {
    if (
      !confirm(
        "¿Cerrar sesión del nodo? Tendrás que re-vincularlo con selector de sucursal.",
      )
    ) {
      return;
    }
    await logout();
    setSession(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Ventas
        </Button>
        <h1 className="text-base font-semibold">Ajustes</h1>
        <div className="w-10" />
      </header>

      <main className="container max-w-2xl space-y-4 p-4">
        <CuentaCard />
        <AparienciaCard />
        <HardwareCard />
        <AppCard />
        <CacheStatsCard />
        <FirestoreStatsCard />

        <Button variant="destructive" className="w-full" onClick={onSalir}>
          Cerrar sesión del nodo
        </Button>
      </main>
    </div>
  );
}

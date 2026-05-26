import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResurtidosSucursal } from "@/features/resurtidos/useResurtidos";
import { useBackHandler } from "@/lib/back-handler";
import type { ResurtidoEstado } from "@shared";

const ESTADOS: Array<{ key: ResurtidoEstado | "pendientes"; label: string }> = [
  { key: "pendientes", label: "Pendientes" },
  { key: "cerrado", label: "Cerrados" },
];

const ESTADO_LABEL: Record<ResurtidoEstado, string> = {
  creando: "Creando",
  en_transito: "En tránsito",
  recibido: "Recibido",
  cerrado: "Cerrado",
};

const ESTADO_COLOR: Record<ResurtidoEstado, string> = {
  creando: "bg-muted text-muted-foreground",
  en_transito: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  recibido: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  cerrado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

/**
 * Pantalla nodo-web: muestra los resurtidos cuyo destino ES esta sucursal.
 * El operador del piso aquí marca "recibido" y luego "cierra" con la
 * disposición pieza por pieza (tienda / dañado / perdido).
 *
 * Los estados `creando` y `en_transito` aparecen en "Pendientes" para que
 * el operador vea la caja antes de que llegue. `creando` significa "aún
 * lo está armando bodega"; `en_transito` significa "ya viene en camino".
 */
export function ResurtidosNodoPage() {
  const navigate = useNavigate();
  const { resurtidos, loading } = useResurtidosSucursal();
  const [filtro, setFiltro] = useState<ResurtidoEstado | "pendientes">(
    "pendientes",
  );

  useBackHandler(() => {
    navigate("/");
    return true;
  }, [navigate]);

  const filtrados = useMemo(() => {
    if (filtro === "pendientes") {
      return resurtidos.filter(
        (r) => r.estado !== "cerrado",
      );
    }
    return resurtidos.filter((r) => r.estado === filtro);
  }, [resurtidos, filtro]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 flex-col gap-2 border-b bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            aria-label="Volver"
            className="-ml-1"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 truncate text-base font-semibold">
            Resurtidos
          </h1>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {ESTADOS.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setFiltro(e.key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                filtro === e.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {loading && resurtidos.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {!loading && filtrados.length === 0 && (
          <p className="rounded-md border bg-muted py-8 text-center text-sm text-muted-foreground">
            {filtro === "pendientes"
              ? "Sin resurtidos pendientes para esta sucursal"
              : "Sin resurtidos cerrados"}
          </p>
        )}
        {filtrados.length > 0 && (
          <ul className="space-y-2">
            {filtrados.map((r) => {
              const totalPiezas = r.lineas.reduce(
                (acc, l) => acc + l.cantidadEnviada,
                0,
              );
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/resurtidos/${r.id}`)}
                    className="flex w-full items-start gap-3 rounded-md border bg-card p-3 text-left transition active:bg-accent"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                            ESTADO_COLOR[r.estado]
                          }`}
                        >
                          {ESTADO_LABEL[r.estado]}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {r.fechaCreacion.slice(0, 10)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {r.lineas.length} línea
                        {r.lineas.length === 1 ? "" : "s"} · {totalPiezas} pza
                        {totalPiezas === 1 ? "" : "s"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Empacó {r.responsableEmpaco}
                        {r.responsableTraslado &&
                          ` · trasladó ${r.responsableTraslado}`}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

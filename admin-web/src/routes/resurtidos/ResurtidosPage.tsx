import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResurtidos } from "@/features/resurtidos/useResurtidos";
import type { ResurtidoEstado } from "@shared";

const ESTADOS: Array<{ key: ResurtidoEstado | "todos"; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "creando", label: "Creando" },
  { key: "en_transito", label: "En tránsito" },
  { key: "recibido", label: "Recibido" },
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

export function ResurtidosPage() {
  const { resurtidos, loading } = useResurtidos();
  const [filtro, setFiltro] = useState<ResurtidoEstado | "todos">("todos");

  const filtrados = useMemo(() => {
    if (filtro === "todos") return resurtidos;
    return resurtidos.filter((r) => r.estado === filtro);
  }, [resurtidos, filtro]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Resurtidos</h1>
          <p className="text-xs text-muted-foreground">
            Transferencias bodega → sucursal.
          </p>
        </div>
        <Button asChild>
          <Link to="/resurtidos/nuevo">
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ESTADOS.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => setFiltro(e.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filtro === e.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {loading && resurtidos.length === 0 && (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}
      {!loading && filtrados.length === 0 && (
        <p className="rounded-md border bg-muted py-8 text-center text-sm text-muted-foreground">
          {resurtidos.length === 0
            ? "Aún no hay resurtidos. Crea el primero."
            : "Sin resurtidos en este estado"}
        </p>
      )}

      {filtrados.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Estado</th>
                <th className="p-2">Destino</th>
                <th className="p-2">Líneas</th>
                <th className="p-2">Empacó</th>
                <th className="p-2">Creado</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const totalPiezas = r.lineas.reduce(
                  (acc, l) => acc + l.cantidadEnviada,
                  0,
                );
                return (
                  <tr
                    key={r.id}
                    className="border-b transition last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="p-2">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          ESTADO_COLOR[r.estado]
                        }`}
                      >
                        {ESTADO_LABEL[r.estado]}
                      </span>
                    </td>
                    <td className="p-2 font-medium">
                      → {r.sucursalDestinoNombre}
                    </td>
                    <td className="p-2 text-xs">
                      {r.lineas.length} líneas · {totalPiezas} pzas
                    </td>
                    <td className="p-2 text-xs">{r.responsableEmpaco}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {r.fechaCreacion.slice(0, 10)}
                    </td>
                    <td className="p-2 text-right">
                      <Link
                        to={`/resurtidos/${r.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Abrir"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

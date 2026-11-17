import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResurtidos } from "@/features/resurtidos/useResurtidos";
import { esLote, totalesLote, type Resurtido, type ResurtidoEstado } from "@shared";

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
  enviado: "Enviado",
  parcial: "Recibido en parte",
};

/** Los estados de los lotes caen en el filtro equivalente del flujo viejo. */
const GRUPO_FILTRO: Partial<Record<ResurtidoEstado, ResurtidoEstado>> = {
  enviado: "en_transito",
  parcial: "recibido",
};

/** Un lote que se arma y ya está listo espera a que admin lo envíe. */
function etiquetaEstado(r: Resurtido): string {
  if (esLote(r) && r.estado === "creando") return r.listo ? "Lote listo" : "Lote armándose";
  return ESTADO_LABEL[r.estado];
}

const ESTADO_COLOR: Record<ResurtidoEstado, string> = {
  creando: "bg-muted text-muted-foreground",
  en_transito: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  recibido: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  cerrado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  enviado: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  parcial: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

export function ResurtidosListPage() {
  const navigate = useNavigate();
  const { resurtidos, loading } = useResurtidos();
  const [filtro, setFiltro] = useState<ResurtidoEstado | "todos">("todos");

  const filtrados = useMemo(() => {
    if (filtro === "todos") return resurtidos;
    return resurtidos.filter((r) => (GRUPO_FILTRO[r.estado] ?? r.estado) === filtro);
  }, [resurtidos, filtro]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex flex-col gap-2 border-b bg-card/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
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
          <h1 className="flex-1 truncate text-base font-semibold">Resurtidos</h1>
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

      <main className="flex-1 px-3 pb-32 pt-3">
        {loading && resurtidos.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
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
          <ul className="space-y-2">
            {filtrados.map((r) => {
              // Un lote que se arma todavía no tiene `lineas`: sus cuentas
              // salen de sus cajas y paquetes.
              const lote = esLote(r) ? totalesLote(r) : null;
              const totalPiezas = lote
                ? lote.piezas
                : r.lineas.reduce((acc, l) => acc + l.cantidadEnviada, 0);
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
                          {etiquetaEstado(r)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {lote ? (
                            <span className="font-mono">{r.folio ?? r.id}</span>
                          ) : (
                            r.fechaCreacion.slice(0, 10)
                          )}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        → {r.sucursalDestinoNombre}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lote ? (
                          <>
                            {lote.cajas} caja{lote.cajas === 1 ? "" : "s"} · {lote.paquetes} paquete
                            {lote.paquetes === 1 ? "" : "s"} · {totalPiezas} pza
                            {totalPiezas === 1 ? "" : "s"}
                          </>
                        ) : (
                          <>
                            {r.lineas.length} línea
                            {r.lineas.length === 1 ? "" : "s"} · {totalPiezas} pza
                            {totalPiezas === 1 ? "" : "s"} · empacó {r.responsableEmpaco}
                          </>
                        )}
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

      <Button
        type="button"
        onClick={() => navigate("/resurtidos/nuevo")}
        aria-label="Nuevo resurtido"
        className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+1rem))] right-4 z-30 h-14 w-14 rounded-full p-0 shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

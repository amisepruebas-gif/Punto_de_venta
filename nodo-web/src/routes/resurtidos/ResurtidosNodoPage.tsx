import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Loader2,
  Package,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResurtidosSucursal } from "@/features/resurtidos/useResurtidos";
import { llaveRecepcion, useRecepcionLotes } from "@/features/resurtidos/recepcionStore";
import { pzas } from "@/features/resurtidos/loteVista";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import { useBackHandler } from "@/lib/back-handler";
import {
  conteoLoteEstaVacio,
  esLote,
  llaveCajaLote,
  llavePaqueteLote,
  loteAbierto,
  resumenLote,
  type Resurtido,
  type ResurtidoEstado,
} from "@shared";

const ESTADOS: Array<{ key: ResurtidoEstado | "pendientes"; label: string }> = [
  { key: "pendientes", label: "Pendientes" },
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

const ESTADO_COLOR: Record<ResurtidoEstado, string> = {
  creando: "bg-muted text-muted-foreground",
  en_transito: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  recibido: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  cerrado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  enviado: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  parcial: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

/** Botones que no se quedan con el foco: el lector escribe en el campo de
 *  escaneo de arriba. */
const sinFoco = (e: MouseEvent) => e.preventDefault();

/**
 * Pantalla nodo-web: muestra los resurtidos cuyo destino ES esta sucursal.
 * El operador del piso aquí marca "recibido" y luego "cierra" con la
 * disposición pieza por pieza (tienda / dañado / perdido).
 *
 * Los estados `creando` y `en_transito` aparecen en "Pendientes" para que
 * el operador vea la caja antes de que llegue. `creando` significa "aún
 * lo está armando bodega"; `en_transito` significa "ya viene en camino".
 *
 * Los LOTES de envío (con `cajas`) solo salen ya enviados (mientras se arman
 * no le dicen nada a la caja), con su código y su avance. Escanear arriba
 * cualquier etiqueta de caja o paquete abre el lote que la trae.
 */
export function ResurtidosNodoPage() {
  const navigate = useNavigate();
  const { negocioId } = useNodoSession();
  const { resurtidos, loading } = useResurtidosSucursal();
  const enTablet = useRecepcionLotes((s) => s.lotes);
  const hayTecladoFisico = useTecladoFisico();
  const [filtro, setFiltro] = useState<ResurtidoEstado | "pendientes">(
    "pendientes",
  );
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useBackHandler(() => {
    navigate("/");
    return true;
  }, [navigate]);

  function enfocar() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  useEffect(() => enfocar(), []);

  // Un lote que se está armando todavía no es asunto de la caja.
  const visibles = useMemo(
    () => resurtidos.filter((r) => !(esLote(r) && r.estado === "creando")),
    [resurtidos],
  );

  const filtrados = useMemo(() => {
    if (filtro === "pendientes") {
      return visibles.filter(
        (r) => r.estado !== "cerrado",
      );
    }
    return visibles.filter((r) => r.estado === filtro);
  }, [visibles, filtro]);

  /** Etiqueta escaneada → el lote que la trae (los abiertos primero). Con el
   *  código del lote también lo abre. */
  function alEscanear(valor: string) {
    const c = valor.trim();
    setCodigo("");
    if (!c) return;
    const lotes = visibles.filter((r) => esLote(r));
    const conEtiqueta = (r: Resurtido) =>
      !!r.cajas?.[llaveCajaLote(c)] || !!r.paquetes?.[llavePaqueteLote(c)];
    const hallado =
      lotes.find((r) => loteAbierto(r) && conEtiqueta(r)) ?? lotes.find(conEtiqueta);
    if (hallado) {
      setAviso(null);
      // Si está abierto, la etiqueta también cuenta al entrar.
      navigate(`/resurtidos/${hallado.id}`, {
        state: loteAbierto(hallado) ? { escaneo: c } : null,
      });
      return;
    }
    const porCodigo = lotes.find((r) => r.id === c.toUpperCase() || r.folio === c.toUpperCase());
    if (porCodigo) {
      setAviso(null);
      navigate(`/resurtidos/${porCodigo.id}`);
      return;
    }
    setAviso(`"${c}" no es de ningún lote de esta sucursal`);
    enfocar();
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 flex-col gap-2 border-b bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={sinFoco}
            onClick={() => navigate("/")}
            aria-label="Volver"
            className="-ml-1"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="shrink-0 truncate text-base font-semibold">
            Resurtidos
          </h1>
          <div className="relative min-w-0 flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              aria-label="Escanear etiqueta"
              placeholder="Escanea una etiqueta de caja o paquete"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setAviso(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  alEscanear(e.currentTarget.value);
                }
              }}
              onBlur={() => enfocar()}
              inputMode={hayTecladoFisico ? "none" : "search"}
              autoComplete="off"
              spellCheck={false}
              className="h-11 pl-10"
            />
          </div>
        </div>
        {aviso && (
          <p role="alert" className="rounded-md bg-red-600/10 px-3 py-1.5 text-sm font-medium text-red-700">
            {aviso}
          </p>
        )}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {ESTADOS.map((e) => (
            <button
              key={e.key}
              type="button"
              onMouseDown={sinFoco}
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
              const local = negocioId ? enTablet[llaveRecepcion(negocioId, r.id)] : undefined;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={sinFoco}
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
                        {local && local.selladas.length > 0 && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                            <CloudOff className="h-3 w-3" />
                            Pendiente de subir
                          </span>
                        )}
                        {local && !conteoLoteEstaVacio(local.conteo) && (
                          <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                            Contando en esta tablet
                          </span>
                        )}
                      </div>
                      {esLote(r) ? <RenglonLote lote={r} /> : <RenglonSimple resurtido={r} />}
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

/** Resurtido simple: como siempre, líneas y piezas. */
function RenglonSimple({ resurtido: r }: { resurtido: Resurtido }) {
  const lineas = r.lineas ?? [];
  const totalPiezas = lineas.reduce((acc, l) => acc + l.cantidadEnviada, 0);
  return (
    <>
      <p className="mt-1 truncate text-sm font-medium">
        {lineas.length} línea
        {lineas.length === 1 ? "" : "s"} · {totalPiezas} pza
        {totalPiezas === 1 ? "" : "s"}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        Empacó {r.responsableEmpaco}
        {r.responsableTraslado &&
          ` · trasladó ${r.responsableTraslado}`}
      </p>
    </>
  );
}

/** Lote: su código y el avance (no se fía de `lineas`). */
function RenglonLote({ lote }: { lote: Resurtido }) {
  const r = useMemo(() => resumenLote(lote), [lote]);
  const recibidos = r.paquetesRecibidos + r.paquetesDanados;
  return (
    <>
      <p className="mt-1 truncate text-sm font-semibold">Lote {lote.folio ?? lote.id}</p>
      <p className="truncate text-xs text-muted-foreground">
        {r.paquetesTotal > 0
          ? `${recibidos} de ${r.paquetesTotal} paquetes`
          : `${r.cajasTotal} ${r.cajasTotal === 1 ? "caja" : "cajas"}`}
        {lote.estado !== "cerrado" && r.totales.pendiente > 0
          ? ` · faltan ${pzas(r.totales.pendiente)}`
          : ` · ${pzas(r.totales.declarado)}`}
        {lote.paqueteria ? ` · ${lote.paqueteria}` : ""}
      </p>
    </>
  );
}

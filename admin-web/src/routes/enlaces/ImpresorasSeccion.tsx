import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Pencil, Plus, Printer, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { prenderApagarEnlace } from "@/features/lotes/loteService";
import { fechaCorta } from "@/features/lotes/loteVista";
import type { EnlaceLoteConId } from "@/features/lotes/useEnlacesLote";
import {
  borrarImpresora,
  borrarTrabajo,
  cambiarSucursalImpresora,
  cancelarTrabajo,
  crearImpresora,
  reimprimirTrabajo,
  renombrarImpresora,
  renovarCodigoImpresora,
} from "@/features/impresoras/impresoraService";
import {
  useImpresoras,
  useTrabajosAbiertos,
  type ImpresoraConId,
  type TrabajoConId,
} from "@/features/impresoras/useImpresoras";
import {
  etiquetasDeTrabajo,
  fechaISO_MX,
  impresoraConectada,
  msDeMarca,
  textoEstadoTrabajo,
} from "@shared";
import { Apagador } from "./Apagador";

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function horaDeMs(ms: number | null | undefined): string | undefined {
  return ms ? fechaCorta(fechaISO_MX(new Date(ms))) : undefined;
}

function useAhora(cada: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(t);
  }, [cada]);
  return ahora;
}

/**
 * Impresoras de etiquetas: PCs con el programa "AMISE Impresora". Cada una se
 * vincula pegando un código (se muestra una sola vez) y tiene su apagador.
 */
export function ImpresorasSeccion({
  negocioId,
  accesos,
}: {
  negocioId: string;
  /** Los accesos `imprimir` (apagador, entradas). */
  accesos: EnlaceLoteConId[];
}) {
  const { impresoras, loading, error: errorLista } = useImpresoras();
  const { sucursales } = useSucursales();
  const trabajos = useTrabajosAbiertos();
  const ahora = useAhora(20_000);
  const [nombre, setNombre] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrado, setMostrado] = useState<{ titulo: string; codigo: string } | null>(null);

  function crear() {
    setTrabajando(true);
    setError(null);
    crearImpresora(negocioId, nombre, sucursalId || null)
      .then(({ codigo }) => {
        setMostrado({ titulo: `Código de «${nombre.trim()}»`, codigo });
        setNombre("");
        setSucursalId("");
      })
      .catch((e) => setError(mensaje(e)))
      .finally(() => setTrabajando(false));
  }

  const nombreDe = (id: string) => impresoras.find((i) => i.id === id)?.nombre ?? "Impresora borrada";

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Printer className="h-4 w-4 text-muted-foreground" /> Impresoras de etiquetas ({impresoras.length})
      </h2>
      <p className="text-xs text-muted-foreground">
        Una PC con el programa <b>AMISE Impresora</b> y una impresora de etiquetas por USB. Le llegan las
        etiquetas que piden el teléfono, admin y la caja de su sucursal.
      </p>

      {mostrado && <CodigoMostrado {...mostrado} onCerrar={() => setMostrado(null)} />}

      <form
        className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          crear();
        }}
      >
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label htmlFor="imp-nombre">Nueva impresora</Label>
          <Input
            id="imp-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Taller Puebla"
            maxLength={60}
          />
        </div>
        <div className="min-w-[180px] space-y-1.5">
          <Label htmlFor="imp-sucursal">Sucursal (para la caja)</Label>
          <select
            id="imp-sucursal"
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Ninguna (taller)</option>
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={trabajando || !nombre.trim()}>
          {trabajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Crear impresora
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {errorLista && <p className="text-sm text-destructive">No se pudieron leer las impresoras: {errorLista}</p>}
      {loading && impresoras.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}
      {!loading && impresoras.length === 0 && (
        <p className="rounded-md border bg-muted py-4 text-center text-sm text-muted-foreground">
          Aún no hay impresoras.
        </p>
      )}
      {impresoras.map((imp) => (
        <TarjetaImpresora
          key={imp.id}
          negocioId={negocioId}
          impresora={imp}
          acceso={accesos.find((a) => a.id === imp.id)}
          sucursales={sucursales.map((s) => ({ id: s.sucursalId, nombre: s.nombre }))}
          ahora={ahora}
          enCola={trabajos.filter((t) => t.impresoraId === imp.id && t.estado === "pendiente").length}
          onCodigo={(codigo) => setMostrado({ titulo: `Código nuevo de «${imp.nombre}»`, codigo })}
        />
      ))}

      <ColaConProblemas negocioId={negocioId} trabajos={trabajos} nombreDe={nombreDe} ahora={ahora} />
    </section>
  );
}

function CodigoMostrado({ titulo, codigo, onCerrar }: { titulo: string; codigo: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      (document.getElementById("codigo-impresora") as HTMLTextAreaElement | null)?.select();
    }
  }
  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/50 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{titulo}</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Cópialo ahora: <b>no se vuelve a mostrar</b>. Si lo pierdes, toca "Nuevo código".
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <textarea
        id="codigo-impresora"
        aria-label="Código de vinculación"
        readOnly
        value={codigo}
        rows={2}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-md border bg-muted p-2 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copiar}>
          {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar código"}
        </Button>
        <Button type="button" variant="outline" onClick={onCerrar}>
          Listo, ya lo pegué
        </Button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>En la PC de la impresora abre el programa AMISE Impresora (icono junto al reloj).</li>
        <li>Pega este código y toca "Vincular". Sirve para una sola PC.</li>
        <li>Elige la impresora de etiquetas y da "Imprimir prueba".</li>
      </ol>
    </div>
  );
}

function estadoConexion(imp: ImpresoraConId, ahora: number): { texto: string; clase: string } {
  if (impresoraConectada(imp, ahora)) {
    if (imp.pausada) return { texto: "Conectada · en pausa", clase: "bg-amber-500/15 text-amber-800 dark:text-amber-300" };
    if (!imp.windows) return { texto: "Conectada · falta elegir impresora", clase: "bg-amber-500/15 text-amber-800 dark:text-amber-300" };
    return { texto: "Conectada", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
  }
  const ultimo = horaDeMs(msDeMarca(imp.latidoEn));
  return {
    texto: ultimo ? `Sin conexión desde ${ultimo}` : "Nunca se ha conectado",
    clase: "bg-muted text-muted-foreground",
  };
}

function TarjetaImpresora({
  negocioId,
  impresora,
  acceso,
  sucursales,
  ahora,
  enCola,
  onCodigo,
}: {
  negocioId: string;
  impresora: ImpresoraConId;
  acceso: EnlaceLoteConId | undefined;
  sucursales: Array<{ id: string; nombre: string }>;
  ahora: number;
  enCola: number;
  onCodigo: (codigo: string) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(impresora.nombre);
  const activo = acceso?.activo === true;
  const conexion = estadoConexion(impresora, ahora);

  async function correr(fn: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className={`space-y-2 rounded-lg border bg-card p-4 ${activo ? "" : "opacity-70"}`} data-impresora={impresora.id}>
      <div className="flex flex-wrap items-center gap-3">
        <Printer className="h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          {editando ? (
            <form
              className="flex gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                void correr(async () => {
                  await renombrarImpresora(negocioId, impresora.id, nombre);
                  setEditando(false);
                });
              }}
            >
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoFocus className="h-9" />
              <Button type="submit" size="sm" disabled={trabajando || !nombre.trim()}>
                Guardar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <p className="truncate font-medium">{impresora.nombre}</p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 font-medium ${conexion.clase}`} data-conexion={conexion.texto}>
              {conexion.texto}
            </span>
            {impresora.windows && <span>Windows: {impresora.windows}</span>}
            {impresora.version && <span>v{impresora.version}</span>}
            {enCola > 0 && <span>{enCola} en cola</span>}
          </p>
        </div>
        <Apagador
          activo={activo}
          disabled={trabajando || !acceso}
          onCambiar={(a) => void correr(() => prenderApagarEnlace(negocioId, impresora.id, a))}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          aria-label={`Sucursal de ${impresora.nombre}`}
          value={impresora.sucursalId ?? ""}
          disabled={trabajando}
          onChange={(e) => void correr(() => cambiarSucursalImpresora(negocioId, impresora.id, e.target.value || null))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Sin sucursal (taller)</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={trabajando}
          onClick={() => {
            if (!confirm(`¿Código nuevo para «${impresora.nombre}»?\n\nLa PC vinculada deja de imprimir hasta que le pegues el código nuevo.`)) return;
            void correr(async () => onCodigo((await renovarCodigoImpresora(negocioId, impresora.id)).codigo));
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Nuevo código
        </Button>
        {!editando && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={trabajando}
            onClick={() => {
              setNombre(impresora.nombre);
              setEditando(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" /> Renombrar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={trabajando}
          onClick={() => {
            if (!confirm(`¿Borrar la impresora «${impresora.nombre}»?\n\nLa PC deja de imprimir y lo que esperaba en su cola se cancela.`)) return;
            void correr(() => borrarImpresora(negocioId, impresora.id));
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Borrar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ColaConProblemas({
  negocioId,
  trabajos,
  nombreDe,
  ahora,
}: {
  negocioId: string;
  trabajos: TrabajoConId[];
  nombreDe: (id: string) => string;
  ahora: number;
}) {
  const [error, setError] = useState<string | null>(null);
  // Lo que espera más de 2 minutos, lo que se quedó imprimiendo y lo que falló.
  const visibles = trabajos.filter((t) => {
    if (t.estado !== "pendiente") return true;
    const creado = msDeMarca(t.creadoEn);
    return creado !== null && ahora - creado > 120_000;
  });
  if (visibles.length === 0) return null;
  async function correr(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensaje(e));
    }
  }
  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-card p-4">
      <h3 className="text-sm font-semibold">Órdenes de impresión por revisar ({visibles.length})</h3>
      <ul className="divide-y text-sm">
        {visibles.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-2" data-trabajo={t.id} data-estado={t.estado}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {t.tipo === "etiquetas_lote" ? "Etiquetas de lote" : "Etiquetas de precio"} · {etiquetasDeTrabajo(t)} ·{" "}
                {nombreDe(t.impresoraId)}
                {t.quien ? ` · ${t.quien}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{textoEstadoTrabajo(t)}</p>
            </div>
            {t.estado === "error" && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => void correr(() => reimprimirTrabajo(negocioId, t.id))}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reimprimir
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void correr(() => borrarTrabajo(negocioId, t.id))}>
                  Quitar
                </Button>
              </>
            )}
            {t.estado === "imprimiendo" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!confirm("¿Liberar esta orden? Úsalo solo si la PC se apagó a media impresión.")) return;
                  void correr(() => cancelarTrabajo(negocioId, t.id, "liberada"));
                }}
              >
                Liberar
              </Button>
            )}
            {t.estado === "pendiente" && (
              <Button type="button" size="sm" variant="ghost" onClick={() => void correr(() => cancelarTrabajo(negocioId, t.id, "cancelada"))}>
                Cancelar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

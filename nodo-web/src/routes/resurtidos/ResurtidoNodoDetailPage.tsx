import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Package,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResurtido } from "@/features/resurtidos/useResurtidos";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useCarrito } from "@/features/ventas/carritoStore";
import { useBackHandler } from "@/lib/back-handler";
import {
  cerrarResurtido,
  marcarRecibido,
} from "@/features/resurtidos/resurtidoService";
import type {
  Resurtido,
  ResurtidoDisposicion,
  ResurtidoEstado,
} from "@shared";

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
 * Detalle del resurtido en nodo-web. El operador del piso usa esta pantalla
 * para:
 *   - `en_transito`  → marcar como recibido (sólo dice "llegó la caja").
 *   - `recibido`     → cerrar la entrega marcando pieza por pieza qué llegó
 *                       como Tienda, qué Dañado, qué Perdido.
 *
 * No permite avanzar `creando → en_transito` (eso lo hace bodega), ni
 * crear / cancelar resurtidos (sólo gestión del lado receptor).
 */
export function ResurtidoNodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { negocioId, sucursalId } = useNodoSession();
  const enTurno = useCarrito((s) => s.enTurno);
  const { resurtido, loading } = useResurtido(id ?? null);
  // Defensa-en-profundidad client-side: si el resurtido cargado NO tiene
  // como destino esta sucursal, lo tratamos como "no encontrado" para no
  // permitir que un operador de sucursal A altere el stock de sucursal B
  // navegando a `/resurtidos/<id>` directo. Las reglas Firestore están
  // abiertas mientras tanto — la validación real vendrá con la Fase 3B
  // del MD.
  const fueraDeSucursal =
    !!resurtido && resurtido.sucursalDestinoId !== sucursalId;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responsableInput, setResponsableInput] = useState("");
  const [disposiciones, setDisposiciones] = useState<ResurtidoDisposicion[]>(
    [],
  );

  const enTurnoStr = enTurno ?? "";

  useBackHandler(() => {
    navigate("/resurtidos");
    return true;
  }, [navigate]);

  // Ref para leer el `enTurno` más reciente al inicializar el form, sin
  // que entre en deps del effect (re-runs spurios cuando el vendedor cambia
  // mid-edit). La inicialización corre sólo cuando cambia id+estado.
  const enTurnoRef = useRef(enTurnoStr);
  useEffect(() => {
    enTurnoRef.current = enTurnoStr;
  }, [enTurnoStr]);

  const lastInitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resurtido) return;
    const initKey = `${resurtido.id}_${resurtido.estado}`;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;
    setResponsableInput(enTurnoRef.current);
    if (resurtido.estado === "recibido") {
      setDisposiciones(
        resurtido.lineas.map((l) => ({
          tienda: l.cantidadEnviada,
          dañado: 0,
          perdido: 0,
        })),
      );
    }
  }, [resurtido]);

  const sumasOk = useMemo(() => {
    if (!resurtido || resurtido.estado !== "recibido") return true;
    if (disposiciones.length !== resurtido.lineas.length) return false;
    return resurtido.lineas.every((l, i) => {
      const d = disposiciones[i];
      if (!d) return false;
      return d.tienda + d.dañado + d.perdido === l.cantidadEnviada;
    });
  }, [resurtido, disposiciones]);

  if (loading || !resurtido || fueraDeSucursal) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-background">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Resurtido no encontrado
            </p>
            <Button onClick={() => navigate("/resurtidos")}>Volver</Button>
          </div>
        )}
      </div>
    );
  }

  const puedeAccion =
    resurtido.estado === "en_transito" || resurtido.estado === "recibido";

  async function avanzar() {
    if (!negocioId || !id || !resurtido) return;
    if (!responsableInput.trim()) {
      setError("Falta el nombre del responsable");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (resurtido.estado === "en_transito") {
        await marcarRecibido(negocioId, id, responsableInput);
      } else if (resurtido.estado === "recibido") {
        await cerrarResurtido(negocioId, id, {
          responsableConfirma: responsableInput,
          disposiciones,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/resurtidos")}
          aria-label="Volver"
          className="-ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 truncate text-base font-semibold">Resurtido</h1>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${
            ESTADO_COLOR[resurtido.estado]
          }`}
        >
          {ESTADO_LABEL[resurtido.estado]}
        </span>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto px-3 pb-[max(7rem,calc(env(safe-area-inset-bottom)+6rem))] pt-3">
        <ResumenCard resurtido={resurtido} />
        <LineasCard
          resurtido={resurtido}
          disposiciones={disposiciones}
          onDisposicionChange={(idx, d) =>
            setDisposiciones((prev) =>
              prev.map((p, i) => (i === idx ? d : p)),
            )
          }
        />
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t bg-card/95 p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.25rem))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        {resurtido.estado === "cerrado" ? (
          <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Cerrado · {resurtido.fechaCerrado?.slice(0, 10)}
          </p>
        ) : !puedeAccion ? (
          <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            En preparación por bodega — espera a que entre en tránsito
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="responsable" className="text-xs">
                {resurtido.estado === "en_transito"
                  ? "Responsable que recibió *"
                  : "Responsable que confirmó *"}
              </Label>
              <Input
                id="responsable"
                value={responsableInput}
                onChange={(e) => setResponsableInput(e.target.value)}
                placeholder="Nombre"
                className="h-9"
              />
            </div>
            <Button
              type="button"
              onClick={avanzar}
              disabled={
                submitting ||
                (resurtido.estado === "recibido" && !sumasOk)
              }
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : resurtido.estado === "en_transito" ? (
                <Send className="mr-2 h-4 w-4" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {resurtido.estado === "en_transito"
                ? "Recibir"
                : "Cerrar resurtido"}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}

function ResumenCard({ resurtido }: { resurtido: Resurtido }) {
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <p className="flex-1 truncate font-semibold">
          → {resurtido.sucursalDestinoNombre}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Info label="Empacó" value={resurtido.responsableEmpaco} />
        <Info label="Trasladó" value={resurtido.responsableTraslado} />
        <Info label="Recibió" value={resurtido.responsableRecibe} />
        <Info label="Confirmó" value={resurtido.responsableConfirma} />
      </div>
      {resurtido.notas && (
        <p className="rounded-md bg-muted p-2 text-xs">{resurtido.notas}</p>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate">{value ?? "—"}</p>
    </div>
  );
}

function LineasCard({
  resurtido,
  disposiciones,
  onDisposicionChange,
}: {
  resurtido: Resurtido;
  disposiciones: ResurtidoDisposicion[];
  onDisposicionChange: (idx: number, d: ResurtidoDisposicion) => void;
}) {
  const editando = resurtido.estado === "recibido";
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">
        Líneas ({resurtido.lineas.length})
      </h3>
      <ul className="space-y-2">
        {resurtido.lineas.map((l, idx) => {
          const d = editando
            ? disposiciones[idx] ?? { tienda: 0, dañado: 0, perdido: 0 }
            : l.disposicion;
          const total = d ? d.tienda + d.dañado + d.perdido : 0;
          const okSuma = total === l.cantidadEnviada;
          return (
            <li
              key={`${l.articuloId}_${l.subvariacionCodigo ?? ""}_${idx}`}
              className="rounded-md border bg-background p-2"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {l.nombreSnapshot}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {l.subvariacionCodigo ?? l.articuloId}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">Enviadas</p>
                  <p className="text-sm font-bold tabular-nums">
                    {l.cantidadEnviada}
                  </p>
                </div>
              </div>
              {(editando || resurtido.estado === "cerrado") && d && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <NumField
                    label="Tienda"
                    value={d.tienda}
                    max={l.cantidadEnviada}
                    onChange={(n) =>
                      editando
                        ? onDisposicionChange(idx, { ...d, tienda: n })
                        : undefined
                    }
                    disabled={!editando}
                  />
                  <NumField
                    label="Dañado"
                    value={d.dañado}
                    max={l.cantidadEnviada}
                    onChange={(n) =>
                      editando
                        ? onDisposicionChange(idx, { ...d, dañado: n })
                        : undefined
                    }
                    disabled={!editando}
                    intent="warning"
                  />
                  <NumField
                    label="Perdido"
                    value={d.perdido}
                    max={l.cantidadEnviada}
                    onChange={(n) =>
                      editando
                        ? onDisposicionChange(idx, { ...d, perdido: n })
                        : undefined
                    }
                    disabled={!editando}
                    intent="danger"
                  />
                </div>
              )}
              {editando && !okSuma && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Suma {total} ≠ enviadas {l.cantidadEnviada}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NumField({
  label,
  value,
  max,
  onChange,
  disabled,
  intent,
}: {
  label: string;
  value: number;
  max: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
  intent?: "warning" | "danger";
}) {
  const color =
    intent === "danger"
      ? "border-destructive/30"
      : intent === "warning"
        ? "border-amber-500/30"
        : "";
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        min={0}
        max={max}
        onChange={(e) =>
          onChange?.(
            Math.min(max, Math.max(0, Number(e.target.value) || 0)),
          )
        }
        disabled={disabled}
        className={`h-8 text-sm ${color}`}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Package,
  Send,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResurtido } from "@/features/resurtidos/useResurtidos";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelarResurtidoCreando,
  cerrarResurtido,
  marcarEnTransito,
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

export function ResurtidoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { resurtido, loading } = useResurtido(id ?? null);
  // Primitiva — evita re-runs del effect cuando Firebase Auth re-emite el
  // objeto user sin cambios reales (refresh de token, etc.).
  const userPrefill = user?.user.email ?? user?.user.uid ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responsableInput, setResponsableInput] = useState("");
  const [disposiciones, setDisposiciones] = useState<ResurtidoDisposicion[]>(
    [],
  );

  const lastInitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resurtido) return;
    const initKey = `${resurtido.id}_${resurtido.estado}`;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;
    setResponsableInput(userPrefill);
    if (resurtido.estado === "recibido") {
      setDisposiciones(
        resurtido.lineas.map((l) => ({
          tienda: l.cantidadEnviada,
          dañado: 0,
          perdido: 0,
        })),
      );
    }
  }, [resurtido, userPrefill]);

  const sumasOk = useMemo(() => {
    if (!resurtido || resurtido.estado !== "recibido") return true;
    if (disposiciones.length !== resurtido.lineas.length) return false;
    return resurtido.lineas.every((l, i) => {
      const d = disposiciones[i];
      if (!d) return false;
      return d.tienda + d.dañado + d.perdido === l.cantidadEnviada;
    });
  }, [resurtido, disposiciones]);

  if (loading || !resurtido) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center py-10">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Resurtido no encontrado
            </p>
            <Button onClick={() => navigate("/resurtidos")}>Volver</Button>
          </div>
        )}
      </div>
    );
  }

  async function avanzar() {
    if (!negocioId || !id || !resurtido) return;
    if (!responsableInput.trim()) {
      setError("Falta el nombre del responsable");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (resurtido.estado === "creando") {
        await marcarEnTransito(negocioId, id, responsableInput);
      } else if (resurtido.estado === "en_transito") {
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

  async function cancelar() {
    if (!negocioId || !id || !resurtido) return;
    if (!confirm("¿Cancelar este resurtido? El registro se elimina.")) return;
    setSubmitting(true);
    try {
      await cancelarResurtidoCreando(negocioId, id);
      navigate("/resurtidos", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/resurtidos")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Resurtidos
          </Button>
          <h1 className="text-xl font-semibold">Resurtido</h1>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
            ESTADO_COLOR[resurtido.estado]
          }`}
        >
          {ESTADO_LABEL[resurtido.estado]}
        </span>
      </div>

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

      {resurtido.estado === "cerrado" ? (
        <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
          Cerrado el {resurtido.fechaCerrado?.slice(0, 16).replace("T", " ")}
        </div>
      ) : (
        <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
          <div className="space-y-1.5">
            <Label htmlFor="responsable">
              {resurtido.estado === "creando"
                ? "Responsable que trasladó *"
                : resurtido.estado === "en_transito"
                  ? "Responsable que recibió *"
                  : "Responsable que confirmó *"}
            </Label>
            <Input
              id="responsable"
              value={responsableInput}
              onChange={(e) => setResponsableInput(e.target.value)}
              placeholder="Nombre"
            />
          </div>
          <div className="flex justify-end gap-2">
            {resurtido.estado === "creando" && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={cancelar}
                disabled={submitting}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Cancelar resurtido
              </Button>
            )}
            <Button
              type="button"
              onClick={avanzar}
              disabled={
                submitting ||
                (resurtido.estado === "recibido" && !sumasOk)
              }
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : resurtido.estado === "creando" ? (
                <Truck className="mr-2 h-4 w-4" />
              ) : resurtido.estado === "en_transito" ? (
                <Send className="mr-2 h-4 w-4" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {resurtido.estado === "creando"
                ? "Marcar en tránsito"
                : resurtido.estado === "en_transito"
                  ? "Recibir"
                  : "Cerrar resurtido"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function ResumenCard({ resurtido }: { resurtido: Resurtido }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <p className="font-semibold">→ {resurtido.sucursalDestinoNombre}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Info label="Empacó" value={resurtido.responsableEmpaco} />
        <Info label="Trasladó" value={resurtido.responsableTraslado} />
        <Info label="Recibió" value={resurtido.responsableRecibe} />
        <Info label="Confirmó" value={resurtido.responsableConfirma} />
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-4">
        <Info
          label="Creado"
          value={resurtido.fechaCreacion.slice(0, 16).replace("T", " ")}
        />
        <Info
          label="En tránsito"
          value={resurtido.fechaEnTransito?.slice(0, 16).replace("T", " ")}
        />
        <Info
          label="Recibido"
          value={resurtido.fechaRecibido?.slice(0, 16).replace("T", " ")}
        />
        <Info
          label="Cerrado"
          value={resurtido.fechaCerrado?.slice(0, 16).replace("T", " ")}
        />
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
      <p className="truncate text-sm">{value ?? "—"}</p>
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
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="text-base font-semibold">
        Líneas ({resurtido.lineas.length})
      </h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Artículo</th>
              <th className="p-2">Código</th>
              <th className="p-2 text-center">Enviadas</th>
              {(editando || resurtido.estado === "cerrado") && (
                <>
                  <th className="p-2 text-center">Tienda</th>
                  <th className="p-2 text-center">Dañado</th>
                  <th className="p-2 text-center">Perdido</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {resurtido.lineas.map((l, idx) => {
              const d = editando
                ? disposiciones[idx] ?? { tienda: 0, dañado: 0, perdido: 0 }
                : l.disposicion;
              const total = d ? d.tienda + d.dañado + d.perdido : 0;
              const okSuma = total === l.cantidadEnviada;
              return (
                <tr
                  key={`${l.articuloId}_${l.subvariacionCodigo ?? ""}_${idx}`}
                  className="border-b last:border-b-0"
                >
                  <td className="p-2 font-medium">{l.nombreSnapshot}</td>
                  <td className="p-2 font-mono text-xs text-muted-foreground">
                    {l.subvariacionCodigo ?? l.articuloId}
                  </td>
                  <td className="p-2 text-center font-bold tabular-nums">
                    {l.cantidadEnviada}
                  </td>
                  {(editando || resurtido.estado === "cerrado") && d && (
                    <>
                      <td className="p-2">
                        <NumField
                          value={d.tienda}
                          max={l.cantidadEnviada}
                          onChange={(n) =>
                            editando &&
                            onDisposicionChange(idx, { ...d, tienda: n })
                          }
                          disabled={!editando}
                        />
                      </td>
                      <td className="p-2">
                        <NumField
                          value={d.dañado}
                          max={l.cantidadEnviada}
                          onChange={(n) =>
                            editando &&
                            onDisposicionChange(idx, { ...d, dañado: n })
                          }
                          disabled={!editando}
                          intent="warning"
                        />
                      </td>
                      <td className="p-2">
                        <NumField
                          value={d.perdido}
                          max={l.cantidadEnviada}
                          onChange={(n) =>
                            editando &&
                            onDisposicionChange(idx, { ...d, perdido: n })
                          }
                          disabled={!editando}
                          intent="danger"
                        />
                        {editando && !okSuma && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Σ {total} ≠ {l.cantidadEnviada}
                          </p>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NumField({
  value,
  max,
  onChange,
  disabled,
  intent,
}: {
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
    <Input
      type="number"
      inputMode="numeric"
      value={value}
      min={0}
      max={max}
      onChange={(e) => onChange?.(Math.max(0, Number(e.target.value) || 0))}
      disabled={disabled}
      className={`mx-auto h-8 w-20 text-center text-sm ${color}`}
    />
  );
}

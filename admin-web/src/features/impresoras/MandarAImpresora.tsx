import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { impresoraConectada, textoEstadoTrabajo } from "@shared";
import { MAX_ETIQUETAS_IMPRESORA, mandarEtiquetasLote, reimprimirTrabajo } from "./impresoraService";
import { useImpresoras, useTrabajoImpresion } from "./useImpresoras";

const LS_IMPRESORA = "admin.etiquetas.impresora";

function guardada(): string {
  try {
    return localStorage.getItem(LS_IMPRESORA) ?? "";
  } catch {
    return "";
  }
}

/**
 * Manda etiquetas numeradas de lote a una impresora de etiquetas (programa
 * "AMISE Impresora"). Los números los aparta la impresora al imprimir, del
 * mismo contador que los PDF: nunca se repiten.
 */
export function MandarAImpresora({ negocioId }: { negocioId: string }) {
  const { impresoras, loading } = useImpresoras();
  const { user } = useAuth();
  const quien = user?.user.email ?? "";
  const [ahora, setAhora] = useState(() => Date.now());
  const [impresoraId, setImpresoraId] = useState(guardada);
  const [cantidad, setCantidad] = useState("30");
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trabajoId, setTrabajoId] = useState<string | null>(null);
  const trabajo = useTrabajoImpresion(trabajoId);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  // Si solo hay una, esa.
  useEffect(() => {
    if (!impresoraId && impresoras.length === 1) setImpresoraId(impresoras[0]!.id);
  }, [impresoras, impresoraId]);

  const n = Number(cantidad);
  const valida = Number.isInteger(n) && n >= 1 && n <= MAX_ETIQUETAS_IMPRESORA;
  const elegida = impresoras.find((i) => i.id === impresoraId);

  async function mandar() {
    if (!elegida || !valida) return;
    setMandando(true);
    setError(null);
    try {
      try {
        localStorage.setItem(LS_IMPRESORA, elegida.id);
      } catch {
        /* sin almacenamiento */
      }
      setTrabajoId(await mandarEtiquetasLote(negocioId, elegida.id, n, quien));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMandando(false);
    }
  }

  if (!loading && impresoras.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay impresoras de etiquetas. Créala en{" "}
        <Link to="/enlaces-lote" className="underline">
          Accesos → Impresoras
        </Link>
        .
      </p>
    );
  }

  const tono =
    trabajo?.estado === "impreso"
      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
      : trabajo?.estado === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-foreground";

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="etl-impresora">Impresora</Label>
          <select
            id="etl-impresora"
            value={impresoraId}
            onChange={(e) => setImpresoraId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">— Elige —</option>
            {impresoras.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} · {impresoraConectada(i, ahora) ? (i.pausada ? "en pausa" : "conectada") : "sin conexión"}
              </option>
            ))}
          </select>
          {elegida && !impresoraConectada(elegida, ahora) && (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Esa impresora no está conectada ahora: la orden espera en la cola y sale cuando se conecte.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="etl-cantidad-imp">Cuántas etiquetas</Label>
          <Input
            id="etl-cantidad-imp"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_ETIQUETAS_IMPRESORA}
            step={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">De 1 a {MAX_ETIQUETAS_IMPRESORA}. Etiqueta de 29 × 14 mm.</p>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {trabajo && (
        <div className={`flex flex-wrap items-center gap-2 rounded-md p-2 text-sm ${tono}`} data-estado-impresion={trabajo.estado}>
          {(trabajo.estado === "pendiente" || trabajo.estado === "imprimiendo") && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <span className="flex-1">{textoEstadoTrabajo(trabajo)}</span>
          {(trabajo.estado === "error" || trabajo.estado === "impreso") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (trabajo.estado === "impreso" && !confirm("¿Reimprimir los mismos números? Solo si no salieron bien.")) return;
                void reimprimirTrabajo(negocioId, trabajo.id).catch((e) => setError(String(e?.message ?? e)));
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reimprimir
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={() => void mandar()} disabled={mandando || !valida || !elegida}>
          <Printer className="mr-2 h-4 w-4" />
          {mandando ? "Mandando…" : "Mandar a la impresora"}
        </Button>
      </div>
    </div>
  );
}

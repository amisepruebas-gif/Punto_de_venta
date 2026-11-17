import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNegocio } from "@/hooks/useNegocio";
import { FORMATOS_ETIQUETA, type FormatoEtiqueta } from "@/features/etiquetas/etiquetasPdf";
import {
  descargarEtiquetasNumeradas,
  prepararEtiquetasNumeradas,
} from "@/features/etiquetas/etiquetasNumeradasPdf";
import { MAX_ETIQUETAS_POR_PDF, reservarEtiquetasLote } from "@/features/lotes/loteService";
import { MandarAImpresora } from "@/features/impresoras/MandarAImpresora";
import { codigoEtiquetaLote, etiquetaLoteLegible } from "@shared";

// Misma preferencia que las etiquetas de artículo (Fabricación): casi
// siempre se imprime en la misma impresora.
const LS_FORMATO = "admin.etiquetas.formato";

function formatoGuardado(): FormatoEtiqueta {
  try {
    const f = localStorage.getItem(LS_FORMATO);
    return f === "rollo-50x25" ? f : "carta-3x10";
  } catch {
    return "carta-3x10";
  }
}

/**
 * Etiquetas numeradas para cajas y paquetes de los lotes de envío. Cada PDF
 * aparta números nuevos del contador: no hay dos etiquetas iguales, aunque
 * se impriman en dos computadoras a la vez.
 */
export function EtiquetasLotePage() {
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const [cantidad, setCantidad] = useState("30");
  const [formato, setFormato] = useState<FormatoEtiqueta>(formatoGuardado);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ desde: number; hasta: number } | null>(null);

  const n = Number(cantidad);
  const valida = Number.isInteger(n) && n >= 1 && n <= MAX_ETIQUETAS_POR_PDF;

  async function generar() {
    if (!negocioId) return;
    if (!valida) {
      setError(`Indica de 1 a ${MAX_ETIQUETAS_POR_PDF} etiquetas`);
      return;
    }
    setGenerando(true);
    setError(null);
    setHecho(null);
    try {
      try {
        localStorage.setItem(LS_FORMATO, formato);
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      // Primero lo que puede fallar sin internet; luego se apartan números.
      await prepararEtiquetasNumeradas();
      const rango = await reservarEtiquetasLote(negocioId, n);
      await descargarEtiquetasNumeradas(rango.desde, rango.hasta, formato);
      setHecho(rango);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/resurtidos")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Resurtidos
        </Button>
        <h1 className="text-xl font-semibold">Etiquetas de lote</h1>
      </div>

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Se pegan en cada caja y en cada paquete de un lote. El teléfono las escanea al armar y
          la sucursal al recibir.
        </p>
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Cada PDF trae códigos nuevos. <b>No imprimas dos veces el mismo archivo</b>: dos
            etiquetas iguales no pueden ir en dos lotes. Si necesitas más, genera otro PDF.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="etl-cantidad">Cuántas etiquetas</Label>
            <Input
              id="etl-cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_ETIQUETAS_POR_PDF}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">De 1 a {MAX_ETIQUETAS_POR_PDF}.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etl-formato">Formato</Label>
            <select
              id="etl-formato"
              value={formato}
              onChange={(e) => setFormato(e.target.value as FormatoEtiqueta)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {(Object.keys(FORMATOS_ETIQUETA) as FormatoEtiqueta[]).map((f) => (
                <option key={f} value={f}>
                  {FORMATOS_ETIQUETA[f]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-md border border-dashed p-3 text-center text-sm">
          <p className="text-[10px] tracking-widest text-muted-foreground">AMISE · LOTE</p>
          <p className="font-mono text-xs tracking-widest">║║│║║│║│║║│║</p>
          <p className="font-mono font-semibold">{etiquetaLoteLegible(codigoEtiquetaLote(1))}</p>
          <p className="mt-1 text-xs text-muted-foreground">Así se ve cada etiqueta (con su propio número).</p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {hecho && (
          <p className="rounded-md bg-emerald-500/10 p-2 text-sm text-emerald-800 dark:text-emerald-300">
            Listo: etiquetas {etiquetaLoteLegible(codigoEtiquetaLote(hecho.desde))} a{" "}
            {etiquetaLoteLegible(codigoEtiquetaLote(hecho.hasta))} ({hecho.hasta - hecho.desde + 1}).
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={generar} disabled={generando || !valida || !negocioId}>
            <Printer className="mr-2 h-4 w-4" />
            {generando ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
      </section>

      {negocioId && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">O mándalas a una impresora de etiquetas</h2>
          <p className="text-sm text-muted-foreground">
            Salen directo en la impresora de etiquetas de una PC con el programa AMISE Impresora. Los números
            salen del mismo contador que los PDF.
          </p>
          <MandarAImpresora negocioId={negocioId} />
        </section>
      )}
    </div>
  );
}

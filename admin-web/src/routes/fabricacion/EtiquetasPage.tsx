import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useArticulos } from "@/features/articulos/useArticulos";
import {
  FORMATOS_ETIQUETA,
  descargarEtiquetas,
  type FormatoEtiqueta,
} from "@/features/etiquetas/etiquetasPdf";
import { resolverEscalones } from "@shared";

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
 * Etiquetas PDF de un artículo: nombre, precio, mayoreo y código de barras
 * de su id (el lector de la tablet lo agrega al carrito). Llega desde un
 * lote (`?articuloId=…&cantidad=…`) o desde el detalle del fabricado.
 */
export function EtiquetasPage() {
  const [params] = useSearchParams();
  const { articulos, loading } = useArticulos();
  const [articuloId, setArticuloId] = useState(params.get("articuloId") ?? "");
  const [cantidad, setCantidad] = useState(params.get("cantidad") ?? "30");
  const [formato, setFormato] = useState<FormatoEtiqueta>(formatoGuardado);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fabricados = useMemo(
    () =>
      articulos
        .filter((a) => a.fabricado || a.id === articuloId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [articulos, articuloId],
  );
  const art = articulos.find((a) => a.id === articuloId) ?? null;
  const mayoreo = art ? resolverEscalones(art)[0] : undefined;

  async function generar() {
    if (!art) {
      setError("Elige el artículo");
      return;
    }
    setGenerando(true);
    setError(null);
    try {
      try {
        localStorage.setItem(LS_FORMATO, formato);
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      await descargarEtiquetas(art, Number(cantidad), formato);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">Etiquetas con código de barras</h2>
        <div className="space-y-1.5">
          <Label htmlFor="et-articulo">Artículo</Label>
          <select
            id="et-articulo"
            value={articuloId}
            onChange={(e) => setArticuloId(e.target.value)}
            disabled={loading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">— Elige un artículo fabricado —</option>
            {fabricados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} · #{a.id}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="et-cantidad">Cantidad de etiquetas</Label>
            <Input
              id="et-cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et-formato">Formato</Label>
            <select
              id="et-formato"
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

        {art && (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="text-xs text-muted-foreground">Cada etiqueta lleva:</p>
            <p className="font-semibold">
              {art.nombre} <span className="float-right">${art.precioVenta}</span>
            </p>
            {mayoreo && (
              <p className="text-xs">
                Mayoreo {mayoreo.minPz}+ pz: ${mayoreo.precio} c/u
              </p>
            )}
            <p className="mt-1 font-mono text-xs tracking-widest">
              ║║│║║│║│║ {art.id}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={generar} disabled={generando || !art}>
            <Printer className="mr-2 h-4 w-4" />
            {generando ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
      </section>
    </div>
  );
}

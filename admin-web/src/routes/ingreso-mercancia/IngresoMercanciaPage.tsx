import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Layers,
  Package,
  PlusCircle,
  ScanLine,
} from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "@/features/ingreso-mercancia/BarcodeScanner";
import {
  useResolverCodigo,
  type ResolveResult,
} from "@/features/ingreso-mercancia/useResolverCodigo";
import {
  sumarStock,
  type IngresoResult,
} from "@/features/ingreso-mercancia/ingresoService";
import type { ArticuloSubvariacion } from "@shared";

type ResueltoOk = Extract<ResolveResult, { ok: true }>;

type Toast = {
  tipo: "ok" | "err";
  texto: string;
  detalle?: string;
};

export function IngresoMercanciaPage() {
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { resolver } = useResolverCodigo();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [resuelto, setResuelto] = useState<ResueltoOk | null>(null);
  const [delta, setDelta] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [historial, setHistorial] = useState<IngresoResult[]>([]);
  const manualRef = useRef<HTMLInputElement>(null);

  // Auto-clear del toast a los 4s.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  function manejarCodigo(codigo: string) {
    const r = resolver(codigo);
    if (r.ok) {
      setResuelto(r);
      setDelta("1");
      return;
    }
    const mensajes: Record<typeof r.razon, string> = {
      "no-encontrado": `Código no encontrado: ${r.codigo}`,
      "padre-con-variaciones":
        "Este artículo tiene variaciones. Escanea el código v-NN-XXX de la específica.",
      "subvariacion-no-encontrada": `Subvariación no existe en el padre`,
    };
    setToast({ tipo: "err", texto: mensajes[r.razon] });
  }

  function onScannerDetected(codigo: string) {
    setScannerOpen(false);
    manejarCodigo(codigo);
  }

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const c = manualInput.trim();
    if (!c) return;
    setManualInput("");
    manejarCodigo(c);
  }

  async function confirmar() {
    if (!resuelto || !negocioId) return;
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) {
      setToast({ tipo: "err", texto: "La cantidad debe ser distinta de cero" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await sumarStock(
        negocioId,
        resuelto.articulo.id,
        n,
        {
          ...(resuelto.subvariacion?.codigo
            ? { subvariacionCodigo: resuelto.subvariacion.codigo }
            : {}),
          motivo: "ingreso_mercancia",
          usuario: user?.user.email ?? user?.user.uid ?? "?",
        },
      );
      setHistorial((h) => [res, ...h].slice(0, 8));
      setToast({
        tipo: "ok",
        texto: `${n > 0 ? "+" : ""}${n} a ${
          resuelto.subvariacion?.nombre ?? resuelto.articulo.nombre
        }`,
        detalle: `${res.cantidadAnterior} → ${res.cantidadNueva}`,
      });
      // Kiosk-mode: limpiar selección y volver a enfocar el input para
      // recibir el siguiente escaneo o entrada manual.
      setResuelto(null);
      setDelta("1");
      window.setTimeout(() => manualRef.current?.focus(), 50);
    } catch (err) {
      setToast({ tipo: "err", texto: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container max-w-3xl space-y-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ingreso de mercancía
          </h1>
          <p className="text-sm text-muted-foreground">
            Escanea el código del artículo o de la variación{" "}
            <code className="font-mono">v-NN-XXX</code> y suma stock al
            inventario.
          </p>
        </div>
        <Button onClick={() => setScannerOpen(true)} className="shrink-0">
          <ScanLine className="mr-2 h-4 w-4" /> Escanear
        </Button>
      </div>

      {/* Entrada manual (siempre visible — útil cuando no hay cámara o se
          usa lector USB que inyecta el código como teclado) */}
      <form
        onSubmit={onManualSubmit}
        className="flex gap-2 rounded-lg border bg-card p-3"
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="manual" className="text-xs">
            Código (manual o lector USB)
          </Label>
          <Input
            id="manual"
            ref={manualRef}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="12300011 ó v-11-aBc"
            autoFocus
          />
        </div>
        <div className="self-end">
          <Button type="submit" disabled={!manualInput.trim()}>
            Buscar
          </Button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
            toast.tipo === "ok"
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
          role={toast.tipo === "err" ? "alert" : "status"}
        >
          {toast.tipo === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p>{toast.texto}</p>
            {toast.detalle && (
              <p className="text-xs opacity-70">{toast.detalle}</p>
            )}
          </div>
        </div>
      )}

      {/* Panel de confirmación */}
      {resuelto && (
        <PanelConfirmar
          resuelto={resuelto}
          delta={delta}
          onDelta={setDelta}
          onCancelar={() => setResuelto(null)}
          onConfirmar={confirmar}
          submitting={submitting}
        />
      )}

      {/* Historial breve */}
      {historial.length > 0 && (
        <section className="rounded-lg border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">
            Últimos ingresos en esta sesión
          </h3>
          <ul className="space-y-1 text-xs">
            {historial.map((h, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="font-mono">
                  {h.subvariacionCodigo ?? h.articuloId}
                </span>
                <span>
                  <span
                    className={
                      h.delta > 0 ? "text-emerald-600" : "text-destructive"
                    }
                  >
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {h.cantidadAnterior} → {h.cantidadNueva}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={onScannerDetected}
      />
    </div>
  );
}

function PanelConfirmar({
  resuelto,
  delta,
  onDelta,
  onCancelar,
  onConfirmar,
  submitting,
}: {
  resuelto: ResueltoOk;
  delta: string;
  onDelta: (v: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
  submitting: boolean;
}) {
  const { articulo, subvariacion } = resuelto;
  const cantidadActual = subvariacion
    ? Number(subvariacion.cantidad) || 0
    : Number(articulo.cantidad) || 0;
  const cantidadProyectada = cantidadActual + (Number(delta) || 0);
  const titulo = subvariacion
    ? `${articulo.nombre} — ${subvariacion.nombre}`
    : articulo.nombre;
  const codigo = subvariacion?.codigo ?? articulo.id;
  const imagen = subvariacion?.imagenUrl ?? articulo.imagenUrl;

  return (
    <section className="rounded-lg border-2 border-primary/30 bg-card p-4">
      <header className="flex items-start gap-3">
        <Avatar imagen={imagen} alt={titulo} subvariacion={subvariacion} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{titulo}</p>
          <p className="truncate text-xs font-mono text-muted-foreground">
            {codigo}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Stock actual: </span>
            <span className="font-bold tabular-nums">{cantidadActual}</span>
          </p>
        </div>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="delta">Sumar al stock</Label>
          <Input
            id="delta"
            type="number"
            inputMode="numeric"
            value={delta}
            onChange={(e) => onDelta(e.target.value)}
            placeholder="Acepta negativos para corregir"
          />
          <p className="text-[11px] text-muted-foreground">
            Tras confirmar, el stock será{" "}
            <span className="font-semibold tabular-nums">
              {cantidadProyectada}
            </span>
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            onClick={onCancelar}
            disabled={submitting}
            className="h-10 flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={submitting || !delta || Number(delta) === 0}
            className="h-10 flex-1"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {submitting ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Avatar({
  imagen,
  alt,
  subvariacion,
}: {
  imagen?: string;
  alt: string;
  subvariacion?: ArticuloSubvariacion;
}) {
  if (imagen) {
    return (
      <img
        src={imagen}
        alt={alt}
        className="h-16 w-16 rounded-md object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-muted-foreground">
      {subvariacion ? <Layers className="h-6 w-6" /> : <Package className="h-6 w-6" />}
    </div>
  );
}


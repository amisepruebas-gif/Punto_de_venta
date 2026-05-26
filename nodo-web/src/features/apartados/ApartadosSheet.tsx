import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useApartadosPendientes } from "./useApartados";
import { agregarAbono, cancelarApartado, saldoApartado } from "./apartadoService";
import type { Apartado } from "@shared";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ApartadosSheet({ open, onClose }: Props) {
  const { negocioId, sucursalId } = useNodoSession();
  const { apartados, loading } = useApartadosPendientes();
  const [detalle, setDetalle] = useState<Apartado | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b p-3">
          <div>
            <h2 className="font-semibold">Apartados pendientes</h2>
            <p className="text-xs text-muted-foreground">
              {apartados.length} en esta sucursal
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (detalle ? setDetalle(null) : onClose())}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : detalle && negocioId && sucursalId ? (
            <DetalleApartado
              apartado={detalle}
              negocioId={negocioId}
              sucursalId={sucursalId}
              onChange={(actualizado) => setDetalle(actualizado)}
              onDone={() => setDetalle(null)}
            />
          ) : apartados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin apartados pendientes.
            </p>
          ) : (
            <ul className="space-y-2">
              {apartados.map((a) => {
                const saldo = saldoApartado(a);
                const pagado = a.totalApartado - saldo;
                return (
                  <li key={a.apartadoId}>
                    <button
                      onClick={() => setDetalle(a)}
                      className="flex w-full flex-col items-start rounded-md border bg-card p-3 text-left hover:bg-accent"
                    >
                      <div className="flex w-full items-start justify-between">
                        <span className="font-medium">{a.cliente}</span>
                        <span className="text-sm font-semibold">
                          ${saldo.toFixed(0)}
                        </span>
                      </div>
                      <div className="mt-1 flex w-full items-center justify-between text-xs text-muted-foreground">
                        <span>
                          pagado ${pagado.toFixed(0)} / ${a.totalApartado.toFixed(0)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {a.estado}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetalleApartado({
  apartado,
  negocioId,
  sucursalId,
  onChange,
  onDone,
}: {
  apartado: Apartado;
  negocioId: string;
  sucursalId: string;
  onChange: (a: Apartado) => void;
  onDone: () => void;
}) {
  const saldo = saldoApartado(apartado);
  const [monto, setMonto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAbonar(tipo: "abono" | "saldo") {
    const m = Number(monto);
    if (!m || m <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const actualizado = await agregarAbono({
        negocioId,
        sucursalId,
        apartado,
        monto: m,
        tipo,
      });
      onChange(actualizado);
      setMonto("");
      if (actualizado.estado === "completo") onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancelar() {
    if (!confirm(`¿Cancelar apartado de ${apartado.cliente}?`)) return;
    setSubmitting(true);
    try {
      await cancelarApartado(negocioId, sucursalId, apartado.apartadoId);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{apartado.cliente}</h3>
        {apartado.telefonoCliente && (
          <p className="text-sm text-muted-foreground">
            Tel: {apartado.telefonoCliente}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {apartado.fechaCreacion}
        </p>
      </div>

      <div className="rounded-md border bg-card p-3 text-sm">
        <Row label="Total apartado" value={apartado.totalApartado} />
        <Row
          label="Pagado"
          value={apartado.totalApartado - saldo}
        />
        <div className="mt-2 border-t pt-2">
          <Row label="Saldo" value={saldo} strong />
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-medium">Artículos</h4>
        <ul className="space-y-1 rounded-md border bg-card p-3 text-sm">
          {apartado.articulos.map((art, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {art.cantidad}× {art.nombre}
              </span>
              <span>${(art.precio * art.cantidad).toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-1 text-sm font-medium">Abonos</h4>
        <ul className="space-y-1 rounded-md border bg-card p-3 text-sm">
          {apartado.abonos.map((ab, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-muted-foreground">
                {ab.tipo} · {ab.fecha}
              </span>
              <span>${ab.monto.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </div>

      {saldo > 0 && (
        <div className="space-y-2 rounded-md border border-dashed bg-background p-3">
          <label className="text-sm font-medium">Agregar abono</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={`Máx ${saldo.toFixed(0)}`}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => onAbonar("abono")}
              disabled={submitting || !monto || Number(monto) > saldo}
            >
              Abonar
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                setMonto(String(saldo));
                void onAbonar("saldo");
              }}
              disabled={submitting}
            >
              Liquidar (${saldo.toFixed(0)})
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        variant="destructive"
        className="w-full"
        onClick={onCancelar}
        disabled={submitting}
      >
        Cancelar apartado
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>${value.toFixed(0)}</span>
    </div>
  );
}

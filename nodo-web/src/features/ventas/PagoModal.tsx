import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCarrito } from "./carritoStore";
import { useNodoSession } from "@/hooks/useNodoSession";
import { crearVenta, totalCarrito } from "./ventaService";
import type { MovimientoPago, Venta } from "@shared";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (venta: Venta, offline: boolean) => void;
};

type Divisiones = {
  efectivo: string;
  transferencia: string;
  tarjeta: string;
};

export function PagoModal({ open, onClose, onSuccess }: Props) {
  const { items, enTurno, vendedorIdUsuario, limpiar } = useCarrito();
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const total = useMemo(() => totalCarrito(items), [items]);

  const [metodo, setMetodo] = useState<MovimientoPago>("pagoEfectivo");
  const [recibido, setRecibido] = useState("");
  const [div, setDiv] = useState<Divisiones>({
    efectivo: "",
    transferencia: "",
    tarjeta: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const cambio = Math.max(0, Number(recibido || "0") - total);
  const sumaDiv =
    (Number(div.efectivo) || 0) +
    (Number(div.transferencia) || 0) +
    (Number(div.tarjeta) || 0);
  const cambioDiv = Math.max(0, sumaDiv - total);

  const puedeCobrar =
    !submitting &&
    items.length > 0 &&
    !!enTurno &&
    !!negocioId &&
    !!sucursalId &&
    !!nodoId &&
    (metodo === "pagoEfectivo"
      ? Number(recibido || "0") >= total
      : metodo === "pagoDividido"
        ? sumaDiv >= total
        : true);

  async function onConfirmar() {
    if (!negocioId || !sucursalId || !nodoId || !enTurno) return;
    setSubmitting(true);
    setError(null);
    try {
      const datosPagoDividido =
        metodo === "pagoDividido"
          ? {
              efectivo: div.efectivo || "0",
              transferencia: div.transferencia || "0",
              tarjeta: div.tarjeta || "0",
            }
          : undefined;

      const montoPago =
        metodo === "pagoEfectivo"
          ? recibido
          : metodo === "pagoDividido"
            ? String(sumaDiv)
            : String(total);

      const cambioVenta =
        metodo === "pagoEfectivo"
          ? String(cambio)
          : metodo === "pagoDividido"
            ? String(cambioDiv)
            : "0";

      const result = await crearVenta({
        negocioId,
        sucursalId,
        nodoId,
        enTurno,
        vendedorIdUsuario: vendedorIdUsuario ?? undefined,
        articulos: items.map(({ key: _k, ...rest }) => rest),
        movimiento: metodo,
        montoCobro: String(total),
        montoPago,
        cambio: cambioVenta,
        datosPagoDividido,
      });
      limpiar();
      setRecibido("");
      setDiv({ efectivo: "", transferencia: "", tarjeta: "" });
      onSuccess(result.venta, result.offline);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold">Cobrar ${total.toFixed(0)}</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "artículo" : "artículos"} · {enTurno}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["pagoEfectivo", "pagoTransferencia", "pagoTarjeta", "pagoDividido"] as MovimientoPago[]).map((m) => (
            <Button
              key={m}
              variant={metodo === m ? "default" : "outline"}
              onClick={() => setMetodo(m)}
              className="h-12"
            >
              {m === "pagoEfectivo" && "Efectivo"}
              {m === "pagoTransferencia" && "Transferencia"}
              {m === "pagoTarjeta" && "Tarjeta"}
              {m === "pagoDividido" && "Dividido"}
            </Button>
          ))}
        </div>

        {metodo === "pagoEfectivo" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Recibido</label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              autoFocus
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cambio</span>
              <span className="font-semibold">${cambio.toFixed(0)}</span>
            </div>
          </div>
        )}

        {metodo === "pagoDividido" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Montos por forma de pago</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-xs text-muted-foreground">Efectivo</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={div.efectivo}
                  onChange={(e) => setDiv({ ...div, efectivo: e.target.value })}
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Transf.</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={div.transferencia}
                  onChange={(e) =>
                    setDiv({ ...div, transferencia: e.target.value })
                  }
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Tarjeta</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={div.tarjeta}
                  onChange={(e) => setDiv({ ...div, tarjeta: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Suma (${sumaDiv.toFixed(0)} / ${total.toFixed(0)})
              </span>
              {sumaDiv >= total && (
                <span className="font-semibold">
                  Cambio ${cambioDiv.toFixed(0)}
                </span>
              )}
            </div>
            {sumaDiv > 0 && sumaDiv < total && (
              <p className="text-xs text-destructive">
                Falta ${(total - sumaDiv).toFixed(0)}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirmar}
            disabled={!puedeCobrar}
          >
            {submitting ? "Cobrando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCarrito } from "@/features/ventas/carritoStore";
import { useNodoSession } from "@/hooks/useNodoSession";
import { totalCarrito } from "@/features/ventas/ventaService";
import { crearApartado } from "./apartadoService";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (apartadoId: string) => void;
};

export function ApartadoModal({ open, onClose, onSuccess }: Props) {
  const { items, limpiar } = useCarrito();
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const total = useMemo(() => totalCarrito(items), [items]);

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [seña, setSeña] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const señaNum = Number(seña) || 0;
  const puedeCrear =
    !submitting &&
    items.length > 0 &&
    cliente.trim().length > 0 &&
    señaNum >= 0 &&
    señaNum <= total &&
    !!negocioId &&
    !!sucursalId &&
    !!nodoId;

  async function onConfirmar() {
    if (!negocioId || !sucursalId || !nodoId) return;
    setSubmitting(true);
    setError(null);
    try {
      const apartado = await crearApartado({
        negocioId,
        sucursalId,
        nodoId,
        cliente: cliente.trim(),
        ...(telefono.trim() ? { telefonoCliente: telefono.trim() } : {}),
        articulos: items.map(({ key: _k, ...rest }) => rest),
        totalApartado: total,
        señaInicial: señaNum,
      });
      limpiar();
      setCliente("");
      setTelefono("");
      setSeña("");
      onSuccess(apartado.apartadoId);
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
          <h2 className="text-lg font-semibold">Apartar ${total.toFixed(0)}</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "artículo" : "artículos"}
          </p>
        </div>
        <Input
          placeholder="Cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          autoFocus
        />
        <Input
          placeholder="Teléfono (opcional)"
          inputMode="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <div className="space-y-1">
          <label className="text-sm font-medium">Seña / primer abono</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={seña}
            onChange={(e) => setSeña(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Saldo: ${(total - señaNum).toFixed(0)}
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
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
            disabled={!puedeCrear}
          >
            {submitting ? "Creando…" : "Apartar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import type { ClientePendiente } from "./clientePuntosStore";

type Props = {
  open: boolean;
  cliente: ClientePendiente | null;
  /** Sí: acreditar el cashback de esta venta al cliente. */
  onSi: () => void;
  /** No es este cliente: no acreditar esta venta (el pendiente se mantiene). */
  onNo: () => void;
  /** Quitar el pre-registro de la espera (ya no se preguntará). */
  onQuitar: () => void;
};

function antiguedad(creadoEn: number | undefined): string {
  if (!creadoEn) return "";
  const min = Math.max(0, Math.floor((Date.now() - creadoEn) / 60000));
  return min < 1 ? "hace un momento" : `hace ${min} min`;
}

/**
 * Modal que aparece al COBRAR cuando hay un cliente pre-registrado en espera.
 * Pregunta si esta venta le suma cashback (Sí imprime la contraseña temporal).
 * Antes solo había "No" y "Sí": el pendiente se quedaba pegado hasta que otra
 * venta dijera "Sí". Ahora vence a la hora y se puede quitar aquí.
 */
export function VinculacionClienteModal({ open, cliente, onSi, onNo, onQuitar }: Props) {
  if (!open) return null;
  const tel = (cliente?.telefono ?? "").replace(/\D/g, "").slice(-4);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl">
        <div>
          <h2 className="text-lg font-semibold">¿Sumar cashback a este cliente?</h2>
          <p className="text-sm text-muted-foreground">
            Cliente en espera:{" "}
            <span className="font-medium">{cliente?.nombre || cliente?.correo || "—"}</span>
          </p>
          <p className="text-[12px] text-muted-foreground">
            {cliente?.nombre ? `${cliente.correo} · ` : ""}
            {tel ? `tel ••••${tel}` : ""}
            {cliente?.creadoEn ? ` · registrado ${antiguedad(cliente.creadoEn)}` : ""}
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onNo}>
            No, es otro cliente
          </Button>
          <Button type="button" className="flex-1" onClick={onSi}>
            Sí, sumar cashback
          </Button>
        </div>
        <Button type="button" variant="ghost" className="w-full" onClick={onQuitar}>
          Quitar pre-registro de la espera
        </Button>
      </div>
    </div>
  );
}

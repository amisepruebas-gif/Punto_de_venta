import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  correo: string;
  /** Sí: acreditar los puntos de esta venta al cliente. */
  onSi: () => void;
  /** No: no acreditar esta venta (el pendiente se mantiene). */
  onNo: () => void;
};

/**
 * Modal que aparece al COBRAR cuando hay un cliente pre-registrado pendiente.
 * Pregunta si esta venta le suma puntos. (Sí imprime la contraseña temporal.)
 */
export function VinculacionClienteModal({ open, correo, onSi, onNo }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
    >
      <div className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl">
        <div>
          <h2 className="text-lg font-semibold">¿Sumar puntos a este cliente?</h2>
          <p className="text-sm text-muted-foreground">
            Cliente registrado: <span className="font-medium">{correo}</span>
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onNo}>
            No
          </Button>
          <Button type="button" className="flex-1" onClick={onSi}>
            Sí, sumar puntos
          </Button>
        </div>
      </div>
    </div>
  );
}

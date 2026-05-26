import { Button } from "@/components/ui/button";
import { cerrarApp, posDisponible } from "@/lib/pos-bridge";

type Props = {
  open: boolean;
  onCancel: () => void;
};

/**
 * Popup de confirmación para salir de la app desde la vista principal.
 * Replica el patrón de `pop.preguntar_salir_app` del Android nodo_1: el
 * back físico/gesto en la vista de cobro NO cierra la app directamente,
 * sino que muestra este popup. Solo "Salir" finaliza la activity vía
 * `POS.cerrarApp()`.
 *
 * En navegador normal (sin APK) este modal no debería aparecer porque el
 * back-handler solo se invoca desde el bridge nativo. Aún así, "Salir"
 * cae en un fallback inocuo (cierra el modal) para no dejar al usuario
 * atrapado si por algún motivo se abriera en web.
 */
export function ConfirmarSalidaModal({ open, onCancel }: Props) {
  if (!open) return null;

  function handleSalir() {
    if (posDisponible()) {
      cerrarApp();
      // Si el bridge responde, la activity se cierra y el modal se va con ella.
    } else {
      onCancel();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal
      aria-label="Salir de la aplicación"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-5 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold">¿Salir de la aplicación?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Se cerrará la app. Los datos del carrito en curso se perderán.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSalir}>
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
}

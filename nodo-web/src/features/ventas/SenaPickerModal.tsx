import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import type { Articulo } from "@shared";

type Props = {
  /** Cuando es null, el modal está cerrado. */
  padre: Articulo | null;
  onClose: () => void;
  /** Llamado al confirmar — `descripcion` está garantizada no-vacía. */
  onConfirm: (padre: Articulo, descripcion: string) => void;
};

/**
 * Modal de captura de seña. Replica el comportamiento del
 * `popVariacion_venta` del nodo_1 Android cuando un artículo tiene la flag
 * `seña` y NO tiene subvariaciones. El cajero captura una breve descripción
 * (apartado de cliente, anticipo, observación) que queda almacenada en el
 * item del carrito.
 *
 * UX:
 *   - Al abrir, el input toma foco automáticamente.
 *   - El botón Confirmar queda deshabilitado hasta que el texto sea no-vacío.
 *   - Enter confirma; Escape cierra (manejado por back-handler en Ventas).
 *   - Una "X" interna limpia el campo sin cerrar el modal.
 */
export function SenaPickerModal({ padre, onClose, onConfirm }: Props) {
  const [descripcion, setDescripcion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hayTecladoFisico = useTecladoFisico();

  useEffect(() => {
    if (padre) {
      setDescripcion("");
      // Pequeño delay para que el modal monte antes de enfocar.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [padre]);

  if (!padre) return null;

  const trimmed = descripcion.trim();
  const puedeConfirmar = trimmed.length > 0;

  function confirmar() {
    if (!padre || !puedeConfirmar) return;
    onConfirm(padre, trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Captura de seña"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-t-xl bg-card p-4 shadow-lg sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{padre.nombre}</h2>
            <p className="text-xs text-muted-foreground">
              Captura una breve descripción para esta seña.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Input
            ref={inputRef}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmar();
              }
            }}
            placeholder="Cliente, anticipo, observación…"
            // Solo `inputMode="none"` cuando hay teclado físico — evita que
            // el IME virtual aparezca y consuma espacio en tablets con USB.
            inputMode={hayTecladoFisico ? "none" : "text"}
            className="pr-9"
            aria-label="Descripción de la seña"
          />
          {descripcion.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDescripcion("");
                inputRef.current?.focus();
              }}
              aria-label="Borrar descripción"
              className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="flex-1"
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

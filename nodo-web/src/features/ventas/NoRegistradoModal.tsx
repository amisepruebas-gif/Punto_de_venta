import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCarrito } from "./carritoStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Modal para agregar un item manualmente al carrito (sin estar en el
 * catálogo). Replica `producto_noRegistrado` del Android nodo_1.
 * El item resultante lleva id="00000000" + flag no_registrado.
 */
export function NoRegistradoModal({ open, onClose }: Props) {
  const { agregarManual } = useCarrito();
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState("1");

  if (!open) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !precio || Number(precio) <= 0) return;
    const cant = Math.max(1, Number(cantidad) || 1);
    agregarManual({ nombre: nombre.trim(), precio, cantidad: cant });
    setNombre("");
    setPrecio("");
    setCantidad("1");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Artículo no registrado</h2>
          <p className="text-sm text-muted-foreground">
            Para venta manual sin que esté en el catálogo
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción</label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Pluma azul, Servicio extra"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Precio</label>
            <Input
              type="number"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cantidad</label>
            <Input
              type="number"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1">
            Agregar al carrito
          </Button>
        </div>
      </form>
    </div>
  );
}

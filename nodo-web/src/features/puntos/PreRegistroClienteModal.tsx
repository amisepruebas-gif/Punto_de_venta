import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PreRegistroData = {
  correo: string;
  telefono: string;
  nombre?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** El caller genera el código, guarda el pendiente y llama a la CF. */
  onRegistrar: (data: PreRegistroData) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Modal de PRE-REGISTRO al programa de puntos. Captura correo + teléfono (ambos
 * requeridos) y nombre (opcional). Tras guardar, la siguiente venta ofrecerá
 * vincular a este cliente.
 */
export function PreRegistroClienteModal({ open, onClose, onRegistrar }: Props) {
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const mail = correo.trim().toLowerCase();
    const tel = telefono.trim();
    const digitos = tel.replace(/\D/g, "");
    if (!EMAIL_RE.test(mail)) {
      setError("Correo inválido.");
      return;
    }
    if (digitos.length < 10) {
      setError("Teléfono inválido (mínimo 10 dígitos).");
      return;
    }
    onRegistrar({ correo: mail, telefono: tel, nombre: nombre.trim() || undefined });
    setCorreo("");
    setTelefono("");
    setNombre("");
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
          <h2 className="text-lg font-semibold">Registrar cliente · Puntos</h2>
          <p className="text-sm text-muted-foreground">
            En su siguiente compra se le acreditarán los puntos. Se le dará un código
            en el ticket para activar su cuenta en amise.mx.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Correo</label>
          <Input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="cliente@correo.com"
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Teléfono</label>
          <Input
            type="tel"
            inputMode="numeric"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="55 1234 5678"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre (opcional)</label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del cliente"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1">
            Registrar
          </Button>
        </div>
      </form>
    </div>
  );
}

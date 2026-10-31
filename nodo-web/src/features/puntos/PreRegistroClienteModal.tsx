import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { correoValido, ean13Ok } from "@shared";

export type PreRegistroData = {
  correo: string;
  telefono: string;
  nombre?: string;
  /** F5: barcode (EAN-13) si el cliente adquiere tarjeta física al registrarse. */
  cardBarcode?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** El caller valida la tarjeta, registra y deja al cliente en espera.
   *  Devuelve el error a mostrar, o null si quedó registrado. */
  onRegistrar: (data: PreRegistroData) => Promise<string | null>;
  /** Correo del cliente que ya está en espera (se reemplazaría). */
  pendienteCorreo?: string | null;
};

/**
 * Modal de PRE-REGISTRO al programa de cashback. Captura correo + teléfono
 * (ambos requeridos) y nombre (opcional). Tras guardar, la siguiente venta
 * ofrecerá vincular a este cliente. Con red espera la respuesta del servidor:
 * un "ya existe" se muestra aquí (antes se reportaba como "sin conexión" e
 * imprimía una contraseña que no servía).
 */
export function PreRegistroClienteModal({
  open,
  onClose,
  onRegistrar,
  pendienteCorreo,
}: Props) {
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [quiereTarjeta, setQuiereTarjeta] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!open) return null;

  function cerrar() {
    if (enviando) return;
    setError(null);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    const mail = correo.trim().toLowerCase();
    const tel = telefono.trim();
    const digitos = tel.replace(/\D/g, "");
    if (!correoValido(mail)) {
      setError("Correo inválido.");
      return;
    }
    if (digitos.length < 10) {
      setError("Teléfono inválido (mínimo 10 dígitos).");
      return;
    }
    let cardBarcode: string | undefined;
    if (quiereTarjeta) {
      const bc = barcode.replace(/\D/g, "");
      if (!ean13Ok(bc)) {
        setError("Escanea una tarjeta válida (13 dígitos) o desmarca la opción.");
        return;
      }
      cardBarcode = bc;
    }
    setEnviando(true);
    let err: string | null;
    try {
      err = await onRegistrar({
        correo: mail,
        telefono: tel,
        nombre: nombre.trim() || undefined,
        cardBarcode,
      });
    } catch {
      err = "No se pudo registrar. Reintenta.";
    } finally {
      setEnviando(false);
    }
    if (err) {
      setError(err);
      return;
    }
    setCorreo("");
    setTelefono("");
    setNombre("");
    setQuiereTarjeta(false);
    setBarcode("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={cerrar}
      role="dialog"
      aria-modal
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Registrar cliente · Cashback</h2>
          <p className="text-sm text-muted-foreground">
            En su siguiente compra se le acreditará el cashback. Se le dará un código
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

        <div className="space-y-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={quiereTarjeta}
              onChange={(e) => setQuiereTarjeta(e.target.checked)}
            />
            <span>
              El cliente quiere <strong>tarjeta física</strong> (se cobra al pagar)
            </span>
          </label>
          {quiereTarjeta && (
            <Input
              inputMode="numeric"
              placeholder="Escanea la tarjeta…"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
          )}
        </div>

        {pendienteCorreo && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
            Ya hay un cliente en espera ({pendienteCorreo}). Si registras a este,
            ese deja de estar en espera.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={enviando}>
            {enviando ? "Registrando…" : pendienteCorreo ? "Reemplazar y registrar" : "Registrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type VenderRegaloData = {
  email: string;
  phone?: string;
  nombre?: string;
  /** Denominación a cargar como crédito (pesos). */
  denominacion: number;
  /** Barcode EAN-13 de la tarjeta física (D2: siempre física). */
  barcode: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** El caller agrega la línea gift al carrito y deja el pendiente de emisión. */
  onVender: (data: VenderRegaloData) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRESETS = [200, 300, 500];

/** Valida EAN-13 con dígito verificador (mismo criterio que amise validarEAN13). */
function ean13Ok(c: string): boolean {
  if (!/^\d{13}$/.test(c)) return false;
  const n = c.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += n[i] * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === n[12];
}

/**
 * Modal para VENDER/activar una tarjeta de regalo (Feature 5, Fase 2). Captura el
 * email del DESTINATARIO (llave del monedero), la denominación ($200/$300/$500 o
 * custom >$500) y el barcode de la tarjeta física. Al confirmar, el caller agrega
 * la denominación como línea de venta y, al cobrar, emite el crédito.
 */
export function VenderRegaloModal({ open, onClose, onVender }: Props) {
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [preset, setPreset] = useState<number | "custom">(500);
  const [custom, setCustom] = useState("");
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function limpiar() {
    setCorreo("");
    setTelefono("");
    setNombre("");
    setPreset(500);
    setCustom("");
    setBarcode("");
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const mail = correo.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) {
      setError("Correo del destinatario inválido.");
      return;
    }
    const tel = telefono.trim();
    const digitos = tel.replace(/\D/g, "");
    if (tel && digitos.length < 10) {
      setError("Teléfono inválido (mínimo 10 dígitos) o déjalo vacío.");
      return;
    }
    // Denominación: preset $200/$300/$500 o custom SOLO > $500 (decisión §0).
    let denom: number;
    if (preset === "custom") {
      denom = Math.round(Number(custom));
      if (!Number.isFinite(denom) || denom <= 500) {
        setError("El monto personalizado debe ser mayor a $500.");
        return;
      }
    } else {
      denom = preset;
    }
    const bc = barcode.replace(/\D/g, "");
    if (!ean13Ok(bc)) {
      setError("Escanea una tarjeta física válida (código de barras EAN-13).");
      return;
    }
    onVender({
      email: mail,
      phone: tel || undefined,
      nombre: nombre.trim() || undefined,
      denominacion: denom,
      barcode: bc,
    });
    limpiar();
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
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Vender tarjeta de regalo</h2>
          <p className="text-sm text-muted-foreground">
            Se carga el crédito al monedero del destinatario (vence en 6 meses) y se
            le da un código para usarlo también en amise.mx. Se cobra al pagar.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Correo del destinatario</label>
          <Input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="cliente@correo.com"
            autoFocus
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Teléfono (opcional)</label>
            <Input
              type="tel"
              inputMode="numeric"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="55 1234 5678"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre (opcional)</label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Denominación</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-md border px-4 py-2 text-sm font-semibold ${
                  preset === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
              >
                ${p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={`rounded-md border px-4 py-2 text-sm font-semibold ${
                preset === "custom"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent"
              }`}
            >
              Otro
            </button>
          </div>
          {preset === "custom" && (
            <Input
              type="number"
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Monto mayor a $500"
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tarjeta física (código de barras)</label>
          <Input
            inputMode="numeric"
            placeholder="Escanea la tarjeta…"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1">
            Agregar al cobro
          </Button>
        </div>
      </form>
    </div>
  );
}

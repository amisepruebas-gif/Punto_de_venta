import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RecargarRegaloData = {
  /** Barcode EAN-13 de la tarjeta (identificador primario). */
  codigo?: string;
  phone?: string;
  /** Monto a recargar (pesos). */
  monto: number;
};

export type RecargaLookup = {
  saldo: number;
  expiraAt: number | null;
  vencido: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Consulta el saldo de la tarjeta (el caller llama a la CF). Devuelve null si
   *  falla la red. */
  onLookup: (id: { codigo?: string; phone?: string }) => Promise<RecargaLookup | null>;
  /** El caller agrega la línea de recarga al carrito y deja el pendiente. */
  onRecargar: (data: RecargarRegaloData) => void;
};

const PRESETS = [200, 300, 500];

function ean13Ok(c: string): boolean {
  if (!/^\d{13}$/.test(c)) return false;
  const n = c.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += n[i] * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === n[12];
}

const money = (n: number) => "$" + n.toLocaleString("es-MX");
const fmtFecha = (ms: number) =>
  new Date(ms).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Modal para RECARGAR una tarjeta de regalo existente (Feature 5, Fase 2). Primero
 * IDENTIFICA la tarjeta (escaneo del barcode o teléfono) y consulta su saldo/
 * vigencia; solo si es una tarjeta de regalo válida permite capturar el monto y
 * agregarlo al cobro. La recarga suma crédito y reinicia la vigencia a +6 meses.
 */
export function RecargarRegaloModal({ open, onClose, onLookup, onRecargar }: Props) {
  const [barcode, setBarcode] = useState("");
  const [telefono, setTelefono] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [lookup, setLookup] = useState<RecargaLookup | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [preset, setPreset] = useState<number | "custom">(500);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function limpiar() {
    setBarcode("");
    setTelefono("");
    setBuscando(false);
    setLookup(null);
    setLookupMsg(null);
    setPreset(500);
    setCustom("");
    setError(null);
  }

  function identificador(): { codigo?: string; phone?: string } | null {
    const bc = barcode.replace(/\D/g, "");
    if (bc) {
      if (!ean13Ok(bc)) return null;
      return { codigo: bc };
    }
    const tel = telefono.trim();
    const digitos = tel.replace(/\D/g, "");
    if (digitos.length >= 10) return { phone: tel };
    return null;
  }

  async function buscar() {
    setError(null);
    setLookup(null);
    setLookupMsg(null);
    const id = identificador();
    if (!id) {
      setError("Escanea la tarjeta (código válido) o escribe un teléfono de 10 dígitos.");
      return;
    }
    setBuscando(true);
    try {
      const res = await onLookup(id);
      if (!res) {
        setLookupMsg("No se pudo consultar (sin conexión). Intenta de nuevo.");
        return;
      }
      // `expiraAt !== null` marca que ES una tarjeta de regalo (tiene registro de
      // crédito, aunque esté en 0 o vencido). Sin fecha ⇒ no es una gift card.
      if (res.expiraAt === null && res.saldo === 0) {
        setLookupMsg("No se encontró una tarjeta de regalo con ese dato. Verifícalo.");
        return;
      }
      setLookup(res);
    } finally {
      setBuscando(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!lookup) {
      setError("Primero busca y verifica la tarjeta.");
      return;
    }
    let monto: number;
    if (preset === "custom") {
      monto = Math.round(Number(custom));
      if (!Number.isFinite(monto) || monto <= 500) {
        setError("El monto personalizado debe ser mayor a $500.");
        return;
      }
    } else {
      monto = preset;
    }
    const id = identificador();
    if (!id) {
      setError("El identificador de la tarjeta cambió. Búscala de nuevo.");
      return;
    }
    onRecargar({ codigo: id.codigo, phone: id.phone, monto });
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
          <h2 className="text-lg font-semibold">Recargar tarjeta de regalo</h2>
          <p className="text-sm text-muted-foreground">
            Suma crédito a una tarjeta existente y reinicia su vigencia a 6 meses. Se
            cobra al pagar.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tarjeta (código de barras)</label>
          <Input
            inputMode="numeric"
            placeholder="Escanea la tarjeta…"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setLookup(null);
              setLookupMsg(null);
            }}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            ¿Sin tarjeta física? Usa el teléfono del cliente:
          </p>
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="Teléfono (10 dígitos)"
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value);
              setLookup(null);
              setLookupMsg(null);
            }}
          />
          <Button type="button" variant="outline" onClick={buscar} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar tarjeta"}
          </Button>
        </div>

        {lookupMsg && <p className="text-sm text-destructive">{lookupMsg}</p>}
        {lookup && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              Crédito actual: <strong>{money(lookup.saldo)}</strong>
              {lookup.vencido && (
                <span className="ml-1 font-semibold text-orange-700">(vencido)</span>
              )}
            </p>
            {lookup.expiraAt !== null && (
              <p className="text-[12px]">Vence: {fmtFecha(lookup.expiraAt)}</p>
            )}
            <p className="mt-1 text-[12px] text-amber-700">
              La recarga reinicia la vigencia a 6 meses desde hoy.
            </p>
          </div>
        )}

        {lookup && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Monto a recargar</label>
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
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={!lookup}>
            Agregar al cobro
          </Button>
        </div>
      </form>
    </div>
  );
}

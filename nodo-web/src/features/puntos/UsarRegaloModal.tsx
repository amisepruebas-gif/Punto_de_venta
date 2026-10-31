import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { correoValido, ean13Ok, telefonosIguales } from "@shared";
import {
  fnConsultarSaldoPuntos,
  fnConsultarSaldoTarjetaRegalo,
} from "@/firebase/callable";

export type AplicarRegalo = {
  /** La tarjeta escaneada, o teléfono + correo del cliente. */
  codigo?: string;
  phone?: string;
  email?: string;
  /** Crédito de regalo (pesos) a usar como descuento. */
  monto: number;
};

type Props = {
  open: boolean;
  /** Tope: subtotal de PRODUCTOS reales disponible para crédito (sin líneas de
   *  venta de gift card ni lo ya cubierto por cashback). */
  maxTotal: number;
  onClose: () => void;
  onAplicar: (data: AplicarRegalo) => void;
};

const money = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (ms: number) =>
  new Date(ms).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Modal para PAGAR con crédito de regalo en el POS (Feature 5, Fase 3). El cajero
 * identifica la tarjeta (escaneo del barcode o teléfono), ve el crédito disponible
 * y elige cuánto usar en esta venta. El crédito se aplica como DESCUENTO (reduce
 * el total a cobrar; NO es ingreso — ya se contó al vender la tarjeta).
 * Con la tarjeta se usa directo; por teléfono, el cliente da su correo completo
 * y debe ser del mismo monedero (si perdió la tarjeta no pierde su crédito).
 */
export function UsarRegaloModal({ open, maxTotal, onClose, onAplicar }: Props) {
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [consultando, setConsultando] = useState(false);
  // Identificador con el que se consultó (para pasar el MISMO a la redención).
  const [ident, setIdent] = useState<{ codigo?: string; phone?: string } | null>(null);
  const [saldo, setSaldo] = useState<{ saldo: number; expiraAt: number | null; vencido: boolean } | null>(
    null,
  );
  const [monto, setMonto] = useState("");
  const [correo, setCorreo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTelefono("");
      setCodigo("");
      setIdent(null);
      setSaldo(null);
      setMonto("");
      setCorreo("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  // Pesos enteros, igual que el cashback: los totales no llevan centavos.
  const tope = saldo ? Math.floor(Math.min(maxTotal, saldo.saldo)) : 0;
  const pedido = Math.floor(Math.min(Number(monto) || 0, tope));

  // Mismo criterio que UsarPuntosModal: con tope 0 el botón NO puede prosperar
  // (`aplicar` saldría por un `return` silencioso y el error se pintaría arriba
  // del modal, lejos de donde mira el cajero) → deshabilitado + motivo al lado.
  const puedeUsar = tope > 0;

  async function consultar(id: { codigo?: string; phone?: string }) {
    setError(null);
    setSaldo(null);
    setIdent(null);
    setConsultando(true);
    try {
      const res = await fnConsultarSaldoTarjetaRegalo(id);
      const s = {
        saldo: Number(res.data.saldo) || 0,
        expiraAt: res.data.expiraAt ?? null,
        vencido: Boolean(res.data.vencido),
      };
      if (s.vencido) {
        setError("El crédito de regalo de esta tarjeta venció.");
        return;
      }
      if (s.expiraAt === null && s.saldo === 0) {
        setError("No se encontró crédito de regalo con ese dato.");
        return;
      }
      if (s.saldo <= 0) {
        setError("Esta tarjeta no tiene crédito de regalo disponible.");
        return;
      }
      setSaldo(s);
      setIdent(id);
    } catch {
      setError("No se pudo consultar. Revisa la conexión.");
    } finally {
      setConsultando(false);
    }
  }

  function consultarPorTelefono(e: FormEvent) {
    e.preventDefault();
    const tel = telefono.trim();
    if (tel.replace(/\D/g, "").length < 10) {
      setError("Teléfono inválido.");
      return;
    }
    void consultar({ phone: tel });
  }

  function consultarPorCodigo(e: FormEvent) {
    e.preventDefault();
    const c = codigo.replace(/\D/g, "");
    if (!ean13Ok(c)) {
      setError("Código de tarjeta inválido (EAN-13).");
      return;
    }
    void consultar({ codigo: c });
  }

  async function aplicar() {
    if (!saldo || !ident) return;
    if (pedido <= 0) {
      setError("Indica cuánto usar (mayor a 0).");
      return;
    }
    if (ident.codigo) {
      onAplicar({ codigo: ident.codigo, monto: pedido });
      onClose();
      return;
    }
    // Sin tarjeta: el correo debe ser del monedero de ese teléfono. El
    // servidor lo vuelve a comprobar antes de debitar.
    const mail = correo.trim().toLowerCase();
    if (!correoValido(mail)) {
      setError("Sin tarjeta, escribe el correo completo del cliente.");
      return;
    }
    setError(null);
    setVerificando(true);
    try {
      const r = await fnConsultarSaldoPuntos({ email: mail });
      if (!r.data.exists || !telefonosIguales(r.data.telefono, ident.phone)) {
        setError("El correo no corresponde a este cliente.");
        return;
      }
    } catch {
      setError("No se pudo verificar el correo (sin conexión).");
      return;
    } finally {
      setVerificando(false);
    }
    onAplicar({ phone: ident.phone, email: mail, monto: pedido });
    onClose();
  }

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Pagar con crédito de regalo</h2>
          <p className="text-sm text-muted-foreground">
            El crédito se descuenta del total. No genera cashback (eso es sobre el pago
            real). El envío/artículos de tarjeta se pagan con dinero real.
          </p>
        </div>

        <form onSubmit={consultarPorCodigo} className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="Escanea la tarjeta…"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoFocus
          />
          <Button type="submit" variant="secondary" disabled={consultando}>
            {consultando ? "…" : "Tarjeta"}
          </Button>
        </form>
        <form onSubmit={consultarPorTelefono} className="flex gap-2">
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="o teléfono del cliente"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={consultando}>
            {consultando ? "…" : "Consultar"}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {saldo && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Crédito disponible: <strong className="text-base">{money(saldo.saldo)}</strong>
              {saldo.expiraAt !== null && (
                <span className="block text-[12px]">Vence: {fmtFecha(saldo.expiraAt)}</span>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">¿Cuánto usar en esta venta?</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={`Máximo ${money(tope)}`}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <p className="text-[12px] text-text-soft">
                Tope: {money(tope)} (lo menor entre el total de productos y su crédito).
              </p>
              {pedido > 0 && (
                <p className="text-[13px] font-semibold text-amber-700">
                  Se aplicarán: {money(pedido)}
                </p>
              )}
            </div>
            {!ident?.codigo && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo completo del cliente</label>
                <Input
                  type="email"
                  placeholder="cliente@correo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                <p className="text-[12px] text-text-soft">
                  Sin la tarjeta, el crédito se usa con su teléfono y su correo.
                </p>
              </div>
            )}
            {!puedeUsar && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                Tope disponible {money(tope)}: esta venta no tiene subtotal de
                productos al que aplicar el crédito. Las tarjetas de regalo se
                pagan con dinero real.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!puedeUsar || verificando}
                onClick={() => void aplicar()}
              >
                {verificando ? "Verificando…" : "Usar crédito"}
              </Button>
            </div>
          </div>
        )}

        {!saldo && (
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}

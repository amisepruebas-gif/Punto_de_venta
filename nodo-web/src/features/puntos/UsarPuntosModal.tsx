import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fnConsultarSaldoPuntos, fnRecuperarCodigoPuntos } from "@/firebase/callable";
import { posDisponible, imprimirTicket } from "@/lib/pos-bridge";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { formatearTicketRecuperacion } from "./ticketRecuperacion";

export type AplicarPuntos = {
  telefono: string;
  /** Descuento en pesos a aplicar a la venta (0 = solo acumular). */
  descuento: number;
  /** Puntos a debitar (0 = solo acumular). */
  puntos: number;
};

type Props = {
  open: boolean;
  /** Tope: total bruto de la venta. */
  maxTotal: number;
  onClose: () => void;
  onAplicar: (data: AplicarPuntos) => void;
};

const money = (n: number) =>
  "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Modal de canje en el POS. El cajero ingresa el teléfono del cliente, consulta
 * su saldo (siempre se muestra el EQUIVALENTE EN DINERO, redondeado a $0.50 desde
 * el server) y decide cuánto usar en esta venta o solo acumular.
 */
export function UsarPuntosModal({ open, maxTotal, onClose, onAplicar }: Props) {
  const [telefono, setTelefono] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [saldo, setSaldo] = useState<{
    saldoUsable: number;
    valorPunto: number;
  } | null>(null);
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Recuperación de contraseña (re-emite una nueva; la vieja va hasheada).
  const { sucursal } = useSucursal();
  const [recuperando, setRecuperando] = useState(false);
  const [recovered, setRecovered] = useState<{ email: string; code: string } | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  if (!open) return null;

  const tope = saldo ? Math.min(maxTotal, saldo.saldoUsable) : 0;
  // Descuento REAL que se aplicará (puntos enteros): puede ser ≤ lo pedido si el
  // punto vale más de $1. Se muestra en vivo para que no haya sorpresas.
  const pedido = Math.min(Number(monto) || 0, tope);
  // Defensa: el server garantiza valorPunto > 0, pero evitamos dividir por 0/NaN.
  const vp = saldo && saldo.valorPunto > 0 ? saldo.valorPunto : 1;
  const puntosPreview = saldo ? Math.floor(pedido / vp) : 0;
  const descuentoPreview = puntosPreview * vp;

  async function consultar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaldo(null);
    const tel = telefono.trim();
    if (tel.replace(/\D/g, "").length < 10) {
      setError("Teléfono inválido.");
      return;
    }
    setConsultando(true);
    try {
      const res = await fnConsultarSaldoPuntos({ phone: tel });
      const d = res.data;
      if (!d.exists || (d.saldoUsable ?? 0) <= 0) {
        setError("Este cliente no tiene puntos disponibles.");
        setSaldo(null);
      } else {
        setSaldo({ saldoUsable: d.saldoUsable ?? 0, valorPunto: d.valorPunto ?? 1 });
      }
    } catch {
      setError("No se pudo consultar el saldo. Revisa la conexión.");
    } finally {
      setConsultando(false);
    }
  }

  function aplicarUsar() {
    if (!saldo) return;
    if (pedido <= 0) {
      setError("Indica cuánto usar (mayor a 0).");
      return;
    }
    if (puntosPreview <= 0) {
      setError("Monto demasiado bajo para usar puntos.");
      return;
    }
    onAplicar({
      telefono: telefono.trim(),
      descuento: descuentoPreview,
      puntos: puntosPreview
    });
    reset();
  }

  function soloAcumular() {
    onAplicar({ telefono: telefono.trim(), descuento: 0, puntos: 0 });
    reset();
  }

  async function recuperar() {
    setError(null);
    setRecovered(null);
    setPrintMsg(null);
    const tel = telefono.trim();
    if (tel.replace(/\D/g, "").length < 10) {
      setError("Teléfono inválido.");
      return;
    }
    setRecuperando(true);
    try {
      const res = await fnRecuperarCodigoPuntos({ phone: tel });
      setRecovered({ email: res.data.email, code: res.data.code });
      setSaldo(null);
    } catch (e) {
      setError((e as Error)?.message || "No se pudo recuperar la contraseña.");
    } finally {
      setRecuperando(false);
    }
  }

  function imprimirRecuperacion() {
    if (!recovered) return;
    const formato = formatearTicketRecuperacion({
      email: recovered.email,
      code: recovered.code,
      fecha: new Date().toLocaleString("es-MX"),
      sucursalNombre: sucursal?.nombre
    });
    if (!posDisponible()) {
      setPrintMsg("Sin impresora conectada. La contraseña está visible arriba.");
      return;
    }
    imprimirTicket({ formato }).then((r) => {
      setPrintMsg(r.ok ? "Ticket enviado a la impresora." : `No se pudo imprimir: ${r.error}`);
    });
  }

  function reset() {
    setTelefono("");
    setSaldo(null);
    setMonto("");
    setError(null);
    setRecovered(null);
    setPrintMsg(null);
    onClose();
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <h2 className="text-lg font-semibold">Puntos del cliente</h2>

        <form onSubmit={consultar} className="flex gap-2">
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="Teléfono del cliente"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            autoFocus
          />
          <Button type="submit" variant="secondary" disabled={consultando}>
            {consultando ? "…" : "Consultar"}
          </Button>
        </form>

        {!recovered && (
          <button
            type="button"
            onClick={recuperar}
            disabled={recuperando}
            className="text-sm font-semibold text-indigo-600 underline disabled:opacity-50"
          >
            {recuperando ? "Recuperando…" : "Recuperar contraseña"}
          </button>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {recovered && (
          <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-sm">
              Contraseña nueva para <strong>{recovered.email}</strong>:
            </p>
            <p className="text-center text-3xl font-bold tracking-[0.3em]">
              {recovered.code}
            </p>
            {printMsg && <p className="text-[12px] text-text-soft">{printMsg}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={reset}>
                Listo
              </Button>
              <Button type="button" className="flex-1" onClick={imprimirRecuperacion}>
                Imprimir
              </Button>
            </div>
          </div>
        )}

        {saldo && !recovered && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
              Disponible para usar:{" "}
              <strong className="text-base">{money(saldo.saldoUsable)}</strong>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">¿Cuánto usar en esta venta?</label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={`Máximo ${money(tope)}`}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <p className="text-[12px] text-text-soft">
                Tope: {money(tope)} (lo menor entre el total y su saldo).
              </p>
              {pedido > 0 && (
                <p className="text-[13px] font-semibold text-indigo-600">
                  Se aplicarán: {money(descuentoPreview)}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={soloAcumular}>
                Solo acumular
              </Button>
              <Button type="button" className="flex-1" onClick={aplicarUsar}>
                Usar puntos
              </Button>
            </div>
          </div>
        )}

        {!saldo && !recovered && (
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

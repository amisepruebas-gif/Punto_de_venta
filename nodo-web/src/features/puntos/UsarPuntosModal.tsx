import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fnConsultarSaldoPuntos, fnRecuperarCodigoPuntos } from "@/firebase/callable";
import { posDisponible, imprimirTicket } from "@/lib/pos-bridge";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { formatearTicketRecuperacion } from "./ticketRecuperacion";

export type AplicarPuntos = {
  telefono: string;
  /** Cashback en pesos a usar como descuento (0 = solo acumular). */
  descuento: number;
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
    saldoDinero: number;
  } | null>(null);
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Recuperación de contraseña (re-emite una nueva; la vieja va hasheada).
  const { sucursal } = useSucursal();
  const [recuperando, setRecuperando] = useState(false);
  const [recovered, setRecovered] = useState<{ email: string; code: string } | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  // El componente queda montado (return null abajo) → el estado local persiste.
  // Limpiar al ABRIR para no arrastrar el teléfono/saldo del cliente anterior.
  useEffect(() => {
    if (open) {
      setTelefono("");
      setSaldo(null);
      setMonto("");
      setError(null);
      setRecovered(null);
      setPrintMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const tope = saldo ? Math.min(maxTotal, saldo.saldoUsable) : 0;
  // Cashback 1:1 en $: el descuento es el monto pedido (a centavos), tope incluido.
  const pedido = Math.round(Math.min(Number(monto) || 0, tope) * 100) / 100;

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
      if (!d.exists) {
        setError("Este cliente no tiene monedero. Regístralo primero.");
        setSaldo(null);
      } else {
        // Existe: se puede ACUMULAR aunque tenga 0 puntos. "Usar" se habilita en
        // el render solo si saldoUsable > 0.
        setSaldo({
          saldoUsable: d.saldoUsable ?? 0,
          saldoDinero: d.saldoDinero ?? 0,
        });
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
    onAplicar({ telefono: telefono.trim(), descuento: pedido });
    reset();
  }

  function soloAcumular() {
    onAplicar({ telefono: telefono.trim(), descuento: 0 });
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

  // Portal a document.body: el modal se renderiza dentro de PagoFooter (bloque
  // `z-10`), y sin portal su `z-[60]` queda ATRAPADO bajo el buscador (`z-30`,
  // contexto de apilamiento hermano). El portal lo saca al body → sobre todo.
  return createPortal(
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
            {saldo.saldoUsable > 0 ? (
              <>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                  Saldo de cashback:{" "}
                  <strong className="text-base">{money(saldo.saldoDinero)}</strong>
                  <span className="block text-[12px] text-text-soft">
                    Disponible para usar (en múltiplos de $0.50):{" "}
                    <strong>{money(saldo.saldoUsable)}</strong>
                  </span>
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
                      Se aplicarán: {money(pedido)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                Saldo de cashback: <strong>{money(saldo.saldoDinero)}</strong> — aún no
                alcanza el mínimo para usar ($0.50). Puedes <strong>acumular</strong> en
                esta venta.
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={soloAcumular}>
                Acumular en esta venta
              </Button>
              {saldo.saldoUsable > 0 && (
                <Button type="button" className="flex-1" onClick={aplicarUsar}>
                  Usar cashback
                </Button>
              )}
            </div>
          </div>
        )}

        {!saldo && !recovered && (
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}

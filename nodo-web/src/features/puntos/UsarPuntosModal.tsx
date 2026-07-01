import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fnConsultarSaldoPuntos,
  fnRecuperarCodigoPuntos,
  type ConsultarSaldoOutput,
  type TarjetaInfo,
} from "@/firebase/callable";
import { posDisponible, imprimirTicket } from "@/lib/pos-bridge";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCarrito } from "@/features/ventas/carritoStore";
import { useClientePuntos } from "./clientePuntosStore";
import { CARD_ARTICLE_ID } from "./tarjeta";
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
  const { byId } = useArticulos();
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState(""); // barcode de tarjeta (escaneo)
  const [consultando, setConsultando] = useState(false);
  const [saldo, setSaldo] = useState<{
    saldoUsable: number;
    saldoDinero: number;
    tarjeta: TarjetaInfo | null;
  } | null>(null);
  // Activar/reponer tarjeta física.
  const [modoTarjeta, setModoTarjeta] = useState(false);
  const [nuevoBarcode, setNuevoBarcode] = useState("");
  const [tarjetaMsg, setTarjetaMsg] = useState<string | null>(null);
  const [procesandoTarjeta, setProcesandoTarjeta] = useState(false);
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
      setCodigo("");
      setSaldo(null);
      setMonto("");
      setError(null);
      setRecovered(null);
      setPrintMsg(null);
      setModoTarjeta(false);
      setNuevoBarcode("");
      setTarjetaMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const tope = saldo ? Math.min(maxTotal, saldo.saldoUsable) : 0;
  // Cashback 1:1 en $: el descuento es el monto pedido (a centavos), tope incluido.
  const pedido = Math.round(Math.min(Number(monto) || 0, tope) * 100) / 100;

  // Aplica la respuesta de saldo (compartido por teléfono y por barcode). Al
  // consultar por barcode, toma el teléfono del monedero para operar (earn/canje
  // en el POS trabajan por teléfono). Existe: se puede ACUMULAR aunque tenga 0.
  function aplicarSaldoResp(d: ConsultarSaldoOutput, telFallback: string) {
    const tel = d.telefono || telFallback;
    if (tel) setTelefono(tel);
    else setError("El cliente no tiene teléfono; usa teléfono o correo para operar.");
    setSaldo({
      saldoUsable: d.saldoUsable ?? 0,
      saldoDinero: d.saldoDinero ?? 0,
      tarjeta: d.tarjeta ?? null,
    });
  }

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
      if (!res.data.exists) {
        setError("Este cliente no tiene monedero. Regístralo primero.");
        setSaldo(null);
      } else {
        aplicarSaldoResp(res.data, tel);
      }
    } catch {
      setError("No se pudo consultar el saldo. Revisa la conexión.");
    } finally {
      setConsultando(false);
    }
  }

  // Consulta por barcode de tarjeta (el lector teclea los dígitos + Enter).
  async function consultarPorCodigo() {
    const c = codigo.replace(/\D/g, "");
    if (c.length !== 13) {
      setError("Código de tarjeta inválido (13 dígitos).");
      return;
    }
    setError(null);
    setSaldo(null);
    setConsultando(true);
    try {
      const res = await fnConsultarSaldoPuntos({ codigo: c });
      if (!res.data.exists) {
        // Una tarjeta bloqueada/repuesta no resuelve (solo 'activa').
        setError("Tarjeta no encontrada, bloqueada o dada de baja.");
        setSaldo(null);
      } else {
        aplicarSaldoResp(res.data, "");
      }
    } catch {
      setError("No se pudo consultar la tarjeta. Revisa la conexión.");
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

  // Activar (o reponer) una tarjeta física: valida, verifica que el barcode NO esté
  // en uso, agrega el ARTÍCULO tarjeta al carrito y deja el barcode PENDIENTE de
  // vincular al cobrar (pagó → se vincula). Si el cliente ya tiene tarjeta activa,
  // es reposición (deshabilita la anterior).
  async function agregarTarjeta() {
    const nuevo = nuevoBarcode.replace(/\D/g, "");
    if (nuevo.length !== 13) {
      setTarjetaMsg("Código inválido (13 dígitos).");
      return;
    }
    const tel = telefono.trim();
    if (!tel) {
      setTarjetaMsg("Primero consulta al cliente.");
      return;
    }
    const art = byId.get(CARD_ARTICLE_ID);
    if (!art) {
      setTarjetaMsg("No se encontró el artículo de la tarjeta. Avisa al admin.");
      return;
    }
    setTarjetaMsg(null);
    setProcesandoTarjeta(true);
    try {
      // El barcode no debe estar ya en uso (activo en otra cuenta).
      const chk = await fnConsultarSaldoPuntos({ codigo: nuevo });
      if (chk.data.exists) {
        setTarjetaMsg("Esa tarjeta ya está en uso.");
        return;
      }
    } catch {
      setTarjetaMsg("No se pudo validar la tarjeta (sin conexión).");
      return;
    } finally {
      setProcesandoTarjeta(false);
    }
    const esReposicion = !!(saldo?.tarjeta && saldo.tarjeta.estado === "activa");
    useCarrito.getState().agregar(art);
    useClientePuntos.getState().setTarjetaPendiente({
      codigo: nuevo,
      telefono: tel,
      ...(esReposicion && saldo?.tarjeta ? { codigoAnterior: saldo.tarjeta.codigo } : {}),
    });
    reset(); // cierra el modal; se cobra + vincula al pagar
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
    setCodigo("");
    setSaldo(null);
    setMonto("");
    setError(null);
    setRecovered(null);
    setPrintMsg(null);
    setModoTarjeta(false);
    setNuevoBarcode("");
    setTarjetaMsg(null);
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            consultarPorCodigo();
          }}
          className="flex gap-2"
        >
          <Input
            inputMode="numeric"
            placeholder="o escanea la tarjeta…"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={consultando}>
            {consultando ? "…" : "Tarjeta"}
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

            {/* Tarjeta física: activar (sin tarjeta) o reponer (con tarjeta activa) */}
            <div className="rounded-md border border-border px-3 py-2.5 text-sm">
              {saldo.tarjeta && saldo.tarjeta.estado === "activa" ? (
                <p className="mb-2">
                  Tarjeta activa:{" "}
                  <strong>••••{saldo.tarjeta.codigo.slice(-4)}</strong>
                </p>
              ) : (
                <p className="mb-2 text-text-soft">Sin tarjeta física.</p>
              )}
              {!modoTarjeta ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setModoTarjeta(true);
                    setNuevoBarcode("");
                    setTarjetaMsg(null);
                  }}
                >
                  {saldo.tarjeta && saldo.tarjeta.estado === "activa"
                    ? "Reponer tarjeta"
                    : "Activar tarjeta"}
                </Button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    agregarTarjeta();
                  }}
                  className="space-y-2"
                >
                  <Input
                    inputMode="numeric"
                    placeholder="Escanea la tarjeta nueva…"
                    value={nuevoBarcode}
                    onChange={(e) => setNuevoBarcode(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[12px] text-text-soft">
                    Se cobra el artículo de la tarjeta y se vincula al pagar.
                  </p>
                  <Button type="submit" className="w-full" disabled={procesandoTarjeta}>
                    {procesandoTarjeta ? "Validando…" : "Agregar tarjeta a la venta"}
                  </Button>
                </form>
              )}
              {tarjetaMsg && (
                <p className="mt-1 text-[13px] text-destructive">{tarjetaMsg}</p>
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

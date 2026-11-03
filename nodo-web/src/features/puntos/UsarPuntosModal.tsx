import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  codigoErrorPuntos,
  correoValido,
  ean13Ok,
  enmascararCorreo,
  telefonosIguales,
} from "@shared";
import {
  fnConsultarSaldoPuntos,
  fnDesbloquearTarjeta,
  fnRecuperarCodigoPuntos,
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
  /** Usar saldo pide la tarjeta escaneada con la que se consultó o, sin ella,
   *  el correo completo del cliente (ya comprobado contra su teléfono). */
  codigo?: string;
  email?: string;
  /** Cashback en pesos a usar como descuento (0 = solo acumular). */
  descuento: number;
  /** Solo ligar al cliente a la venta (al activar o reponer su tarjeta): si ya
   *  era el cliente de la venta, su descuento se conserva. */
  soloLigar?: boolean;
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
const digitos = (s: string) => s.replace(/\D/g, "");

/**
 * Cliente consultado. TODAS las acciones operan sobre esto y no sobre lo que
 * diga la casilla: antes se podía corregir el teléfono después de consultar y
 * se operaba otro número con el saldo del primero.
 */
type Consultado = {
  telefono: string;
  /** Por dónde se consultó: sin la tarjeta, usar el saldo pide el correo. */
  via: "telefono" | "tarjeta";
  /** Tarjeta escaneada (solo si via === "tarjeta"). */
  codigo?: string;
  saldoUsable: number;
  saldoDinero: number;
  /** Con el servidor exigiendo, por teléfono llega solo con sus últimos 4. */
  tarjeta: TarjetaInfo | null;
};

/**
 * Cashback en el POS. El cajero consulta al cliente por teléfono o escaneando
 * su tarjeta (siempre se muestra el EQUIVALENTE EN DINERO).
 *  - Usar saldo pide la tarjeta escaneada o, si se consultó por teléfono, el
 *    correo completo del cliente (la tarjeta es opcional). El correo debe ser
 *    del mismo monedero que el teléfono; el servidor lo vuelve a comprobar.
 *  - Activar, reponer o desbloquear la tarjeta y recuperar la contraseña piden
 *    el correo completo del cliente: debe ser del mismo monedero que el
 *    teléfono (para recuperar también basta la tarjeta escaneada).
 */
export function UsarPuntosModal({ open, maxTotal, onClose, onAplicar }: Props) {
  const { byId } = useArticulos();
  const { sucursal } = useSucursal();
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState(""); // barcode de tarjeta (escaneo)
  const [consultando, setConsultando] = useState(false);
  const [consultado, setConsultado] = useState<Consultado | null>(null);
  // Cada consulta lleva un número: la respuesta de una consulta anterior (o de
  // antes de editar la casilla) se ignora.
  const consultaId = useRef(0);
  const [monto, setMonto] = useState("");
  // Usar el saldo sin la tarjeta: el correo del cliente, comprobado al aplicar.
  const [correoUsar, setCorreoUsar] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [usarMsg, setUsarMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  // Activar/reponer tarjeta física.
  const [modoTarjeta, setModoTarjeta] = useState(false);
  const [nuevoBarcode, setNuevoBarcode] = useState("");
  const [correoTarjeta, setCorreoTarjeta] = useState("");
  const [tarjetaMsg, setTarjetaMsg] = useState<string | null>(null);
  const [procesandoTarjeta, setProcesandoTarjeta] = useState(false);
  // Desbloquear tarjeta.
  const [modoDesbloqueo, setModoDesbloqueo] = useState(false);
  const [codigoDesbloqueo, setCodigoDesbloqueo] = useState("");
  const [correoDesbloqueo, setCorreoDesbloqueo] = useState("");
  const [desbloqueoMsg, setDesbloqueoMsg] = useState<string | null>(null);
  const [desbloqueando, setDesbloqueando] = useState(false);
  // Recuperación de contraseña (re-emite una nueva; la vieja va hasheada).
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [correoRecuperar, setCorreoRecuperar] = useState("");
  const [recuperando, setRecuperando] = useState(false);
  const [recovered, setRecovered] = useState<{ email: string; code: string } | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);

  function limpiarConsulta() {
    consultaId.current += 1;
    setConsultando(false);
    setConsultado(null);
    setMonto("");
    setCorreoUsar("");
    setVerificando(false);
    setUsarMsg(null);
    setExito(null);
    setModoTarjeta(false);
    setNuevoBarcode("");
    setCorreoTarjeta("");
    setTarjetaMsg(null);
    setModoDesbloqueo(false);
    setCodigoDesbloqueo("");
    setCorreoDesbloqueo("");
    setDesbloqueoMsg(null);
    setModoRecuperar(false);
    setCorreoRecuperar("");
  }

  // El componente queda montado (return null abajo) → el estado local persiste.
  // Limpiar al ABRIR para no arrastrar el teléfono/saldo del cliente anterior.
  // Al CERRAR se descarta lo que siga en curso: un correo que termina de
  // verificarse con el modal ya cerrado no aplica el descuento.
  useEffect(() => {
    if (open) {
      setTelefono("");
      setCodigo("");
      setError(null);
      setRecovered(null);
      setPrintMsg(null);
      limpiarConsulta();
    } else {
      consultaId.current += 1;
    }
  }, [open]);

  if (!open) return null;

  // Pesos enteros: los totales de la caja y del ticket no llevan centavos (los
  // centavos del saldo quedan para después).
  const usable = consultado ? Math.floor(consultado.saldoUsable) : 0;
  const tope = consultado ? Math.floor(Math.min(maxTotal, consultado.saldoUsable)) : 0;
  // Cashback 1:1 en $: el descuento es el monto pedido, tope incluido.
  const pedido = Math.floor(Math.min(Number(monto) || 0, tope));
  const porTarjeta = consultado?.via === "tarjeta" && !!consultado.codigo;
  // Sin la tarjeta también se puede: al aplicar se pide el correo del cliente.
  const puedeUsar = tope > 0;
  // Motivo JUNTO a los botones (no arriba del modal): si algo impide usar el
  // saldo, el cajero lo lee donde está mirando.
  const motivoBloqueo =
    !consultado || usable < 1 || tope > 0
      ? null
      : `Tope disponible ${money(tope)}: esta venta no tiene subtotal de productos al que aplicar el descuento. Las tarjetas de regalo se pagan con dinero real.`;

  async function consultarTelefono(tel: string) {
    limpiarConsulta();
    const id = consultaId.current;
    setConsultando(true);
    try {
      const res = await fnConsultarSaldoPuntos({ phone: tel });
      if (id !== consultaId.current) return;
      if (!res.data.exists) {
        setError("Este cliente no tiene monedero. Regístralo primero.");
        return;
      }
      setConsultado({
        telefono: res.data.telefono || tel,
        via: "telefono",
        saldoUsable: res.data.saldoUsable ?? 0,
        saldoDinero: res.data.saldoDinero ?? 0,
        tarjeta: res.data.tarjeta ?? null,
      });
    } catch {
      if (id === consultaId.current) setError("No se pudo consultar el saldo. Revisa la conexión.");
    } finally {
      if (id === consultaId.current) setConsultando(false);
    }
  }

  async function consultarCodigo(c: string) {
    limpiarConsulta();
    const id = consultaId.current;
    setConsultando(true);
    try {
      const res = await fnConsultarSaldoPuntos({ codigo: c });
      if (id !== consultaId.current) return;
      if (!res.data.exists) {
        // Una tarjeta bloqueada/repuesta no resuelve (solo 'activa').
        setError("Tarjeta no encontrada, bloqueada o dada de baja. Consulta por teléfono.");
        return;
      }
      if (!res.data.telefono) {
        // earn y redeem van por teléfono: sin él no se puede operar en caja.
        setError("Este monedero no trae teléfono; no se puede operar en caja.");
        return;
      }
      setTelefono(res.data.telefono);
      setConsultado({
        telefono: res.data.telefono,
        via: "tarjeta",
        codigo: c,
        saldoUsable: res.data.saldoUsable ?? 0,
        saldoDinero: res.data.saldoDinero ?? 0,
        tarjeta: res.data.tarjeta ?? null,
      });
    } catch {
      if (id === consultaId.current) setError("No se pudo consultar la tarjeta. Revisa la conexión.");
    } finally {
      if (id === consultaId.current) setConsultando(false);
    }
  }

  function consultar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tel = telefono.trim();
    if (digitos(tel).length < 10) {
      setError("Teléfono inválido.");
      return;
    }
    void consultarTelefono(tel);
  }

  // Consulta por barcode de tarjeta (el lector teclea los dígitos + Enter).
  function consultarPorCodigo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const c = digitos(codigo);
    if (!ean13Ok(c)) {
      setError("Código de tarjeta inválido (13 dígitos).");
      return;
    }
    void consultarCodigo(c);
  }

  /** ¿El correo que da el cliente es del monedero de este teléfono? */
  async function correoDelCliente(correo: string, tel: string): Promise<boolean> {
    const r = await fnConsultarSaldoPuntos({ email: correo });
    return Boolean(r.data.exists) && telefonosIguales(r.data.telefono, tel);
  }

  async function aplicarUsar() {
    if (!consultado) return;
    if (pedido <= 0) {
      setUsarMsg("Indica cuánto usar (mayor a 0).");
      return;
    }
    if (porTarjeta && consultado.codigo) {
      onAplicar({ telefono: consultado.telefono, codigo: consultado.codigo, descuento: pedido });
      reset();
      return;
    }
    // Sin la tarjeta: el correo completo del cliente, del monedero de este
    // teléfono. El servidor lo vuelve a comprobar antes de debitar.
    const tel = consultado.telefono;
    const correo = correoUsar.trim().toLowerCase();
    if (!correoValido(correo)) {
      setUsarMsg("Sin la tarjeta, escribe el correo completo del cliente.");
      return;
    }
    const id = consultaId.current;
    setUsarMsg(null);
    setVerificando(true);
    try {
      const esSuyo = await correoDelCliente(correo, tel);
      if (id !== consultaId.current) return;
      if (!esSuyo) {
        setUsarMsg("El correo no corresponde a este cliente.");
        return;
      }
    } catch {
      if (id === consultaId.current) setUsarMsg("No se pudo verificar el correo (sin conexión).");
      return;
    } finally {
      if (id === consultaId.current) setVerificando(false);
    }
    onAplicar({ telefono: tel, email: correo, descuento: pedido });
    reset();
  }

  function soloAcumular() {
    if (!consultado) return;
    onAplicar({ telefono: consultado.telefono, descuento: 0 });
    reset();
  }

  // Activar (o reponer) una tarjeta física. Todo se valida ANTES de agregar la
  // tarjeta al carrito (no se cobra una tarjeta que luego no se puede ligar):
  // el correo debe ser del cliente y el barcode no debe estar en uso. Luego la
  // venta queda ligada al cliente, así acumula (antes no).
  async function agregarTarjeta() {
    if (!consultado) return;
    const cliente = consultado;
    const nuevo = digitos(nuevoBarcode);
    if (!ean13Ok(nuevo)) {
      setTarjetaMsg("Código inválido. Revisa el barcode (13 dígitos).");
      return;
    }
    const correo = correoTarjeta.trim().toLowerCase();
    if (!correoValido(correo)) {
      setTarjetaMsg("Escribe el correo completo del cliente.");
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
      if (!(await correoDelCliente(correo, cliente.telefono))) {
        setTarjetaMsg("El correo no corresponde a este cliente.");
        return;
      }
      const chk = await fnConsultarSaldoPuntos({ codigo: nuevo });
      if (chk.data.exists) {
        setTarjetaMsg("Esa tarjeta ya está en uso.");
        return;
      }
    } catch {
      setTarjetaMsg("No se pudo validar (sin conexión).");
      return;
    } finally {
      setProcesandoTarjeta(false);
    }
    // Tiene tarjeta (activa o bloqueada) → reposición: la anterior se marca
    // 'repuesta'. El código anterior solo marca que es reposición: el
    // servidor busca la tarjeta real (aquí puede venir con sus últimos 4).
    useCarrito.getState().agregar(art);
    useClientePuntos.getState().setTarjetaPendiente({
      codigo: nuevo,
      telefono: cliente.telefono,
      correo,
      ...(cliente.tarjeta ? { codigoAnterior: cliente.tarjeta.codigo } : {}),
    });
    onAplicar({ telefono: cliente.telefono, descuento: 0, soloLigar: true });
    reset(); // cierra el modal; se cobra + vincula al pagar
  }

  // Desbloquear: la tarjeta bloqueada escaneada + el correo del cliente. El
  // servidor vuelve a comprobar ambos.
  async function desbloquear() {
    if (!consultado?.tarjeta) return;
    const tel = consultado.telefono;
    const c = digitos(codigoDesbloqueo);
    if (!ean13Ok(c)) {
      setDesbloqueoMsg("Código inválido (13 dígitos).");
      return;
    }
    const fin = consultado.tarjeta.codigo.slice(-4);
    if (c.slice(-4) !== fin) {
      setDesbloqueoMsg(`Esa no es la tarjeta del cliente (la suya termina en ${fin}).`);
      return;
    }
    const correo = correoDesbloqueo.trim().toLowerCase();
    if (!correoValido(correo)) {
      setDesbloqueoMsg("Escribe el correo completo del cliente.");
      return;
    }
    setDesbloqueoMsg(null);
    setDesbloqueando(true);
    try {
      if (!(await correoDelCliente(correo, tel))) {
        setDesbloqueoMsg("El correo no corresponde a este cliente.");
        return;
      }
      await fnDesbloquearTarjeta({ phone: tel, codigo: c, email: correo });
    } catch (e) {
      const code = codigoErrorPuntos(e);
      setDesbloqueoMsg(
        code === "permission-denied"
          ? "El correo o la tarjeta no corresponden a este cliente."
          : code === "failed-precondition"
            ? "La tarjeta no está bloqueada."
            : "No se pudo desbloquear (sin conexión).",
      );
      return;
    } finally {
      setDesbloqueando(false);
    }
    // Ya activa: se vuelve a consultar con la tarjeta escaneada, así ya puede
    // usar su saldo.
    setCodigo(c);
    await consultarCodigo(c);
    setExito("Tarjeta desbloqueada.");
  }

  async function recuperar() {
    if (!consultado) return;
    const tel = consultado.telefono;
    const correo = correoRecuperar.trim().toLowerCase();
    if (!porTarjeta && !correoValido(correo)) {
      setError("Escribe el correo completo del cliente.");
      return;
    }
    setError(null);
    setRecovered(null);
    setPrintMsg(null);
    setRecuperando(true);
    try {
      if (!porTarjeta && !(await correoDelCliente(correo, tel))) {
        setError("El correo no corresponde a este cliente.");
        return;
      }
      const res = await fnRecuperarCodigoPuntos(
        porTarjeta ? { phone: tel, codigo: consultado.codigo } : { phone: tel, email: correo },
      );
      // Oculto también aquí: un servidor sin actualizar lo manda completo.
      setRecovered({ email: enmascararCorreo(res.data.email), code: res.data.code });
    } catch (e) {
      setError(
        codigoErrorPuntos(e) === "permission-denied"
          ? "La tarjeta o el correo no corresponden a este cliente."
          : (e as Error)?.message || "No se pudo recuperar la contraseña.",
      );
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
    setError(null);
    setRecovered(null);
    setPrintMsg(null);
    limpiarConsulta();
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
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
      >
        <h2 className="text-lg font-semibold">Cashback del cliente</h2>

        <form onSubmit={consultar} className="flex gap-2">
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="Teléfono del cliente"
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value);
              if (consultado || consultando) limpiarConsulta();
            }}
            autoFocus
          />
          <Button type="submit" variant="secondary" disabled={consultando}>
            {consultando ? "…" : "Consultar"}
          </Button>
        </form>

        <form onSubmit={consultarPorCodigo} className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="o escanea la tarjeta…"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value);
              if (consultado || consultando) limpiarConsulta();
            }}
          />
          <Button type="submit" variant="secondary" disabled={consultando}>
            {consultando ? "…" : "Tarjeta"}
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {exito && <p className="text-sm font-medium text-emerald-700">{exito}</p>}

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

        {consultado && !recovered && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
              Saldo de cashback:{" "}
              <strong className="text-base">{money(consultado.saldoDinero)}</strong>
              {usable >= 1 ? (
                <span className="block text-[12px] text-text-soft">
                  Disponible para usar (pesos enteros): <strong>{money(usable)}</strong>
                </span>
              ) : (
                <span className="block text-[12px] text-text-soft">
                  Aún no alcanza el mínimo para usar ($1). Puede acumular en esta venta.
                </span>
              )}
              <span className="block text-[12px] text-text-soft">
                {porTarjeta
                  ? `Consultado con su tarjeta ••••${consultado.codigo!.slice(-4)}.`
                  : "Consultado por teléfono."}
              </span>
            </div>

            {usable >= 1 && (
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
                  Tope: {money(tope)} (lo menor entre el total y su saldo).
                </p>
                {pedido > 0 && (
                  <p className="text-[13px] font-semibold text-indigo-600">
                    Se aplicarán: {money(pedido)}
                  </p>
                )}
              </div>
            )}
            {usable >= 1 && !porTarjeta && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo completo del cliente</label>
                <Input
                  type="email"
                  placeholder="cliente@correo.com"
                  value={correoUsar}
                  onChange={(e) => {
                    setCorreoUsar(e.target.value);
                    setUsarMsg(null);
                  }}
                />
                <p className="text-[12px] text-text-soft">
                  Sin la tarjeta, el cashback se usa con su teléfono y su correo.
                </p>
              </div>
            )}
            {motivoBloqueo && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
                {motivoBloqueo}
              </p>
            )}
            {usarMsg && <p className="text-[13px] text-destructive">{usarMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={soloAcumular}>
                Acumular en esta venta
              </Button>
              {usable >= 1 && (
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!puedeUsar || verificando}
                  onClick={() => void aplicarUsar()}
                >
                  {verificando ? "Verificando…" : "Usar cashback"}
                </Button>
              )}
            </div>

            {/* Tarjeta física: activar (sin tarjeta), reponer o desbloquear */}
            <div className="space-y-2 rounded-md border border-border px-3 py-2.5 text-sm">
              {consultado.tarjeta ? (
                <p>
                  Tarjeta {consultado.tarjeta.estado}:{" "}
                  <strong>••••{consultado.tarjeta.codigo.slice(-4)}</strong>
                </p>
              ) : (
                <p className="text-text-soft">Sin tarjeta física.</p>
              )}

              {consultado.tarjeta?.estado === "bloqueada" &&
                (!modoDesbloqueo ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setModoDesbloqueo(true);
                      setModoTarjeta(false);
                      setDesbloqueoMsg(null);
                    }}
                  >
                    Desbloquear tarjeta
                  </Button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void desbloquear();
                    }}
                    className="space-y-2"
                  >
                    <Input
                      inputMode="numeric"
                      placeholder="Escanea la tarjeta bloqueada…"
                      value={codigoDesbloqueo}
                      onChange={(e) => setCodigoDesbloqueo(e.target.value)}
                      autoFocus
                    />
                    <Input
                      type="email"
                      placeholder="Correo completo del cliente"
                      value={correoDesbloqueo}
                      onChange={(e) => setCorreoDesbloqueo(e.target.value)}
                    />
                    <p className="text-[12px] text-text-soft">
                      Si el cliente la perdió, mejor usa Reponer tarjeta.
                    </p>
                    <Button type="submit" className="w-full" disabled={desbloqueando}>
                      {desbloqueando ? "Desbloqueando…" : "Desbloquear"}
                    </Button>
                  </form>
                ))}
              {desbloqueoMsg && <p className="text-[13px] text-destructive">{desbloqueoMsg}</p>}

              {!modoTarjeta ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setModoTarjeta(true);
                    setModoDesbloqueo(false);
                    setNuevoBarcode("");
                    setTarjetaMsg(null);
                  }}
                >
                  {consultado.tarjeta ? "Reponer tarjeta" : "Activar tarjeta"}
                </Button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void agregarTarjeta();
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
                  <Input
                    type="email"
                    placeholder="Correo completo del cliente"
                    value={correoTarjeta}
                    onChange={(e) => setCorreoTarjeta(e.target.value)}
                  />
                  <p className="text-[12px] text-text-soft">
                    Se cobra el artículo de la tarjeta y se vincula al pagar.
                  </p>
                  <Button type="submit" className="w-full" disabled={procesandoTarjeta}>
                    {procesandoTarjeta ? "Validando…" : "Agregar tarjeta a la venta"}
                  </Button>
                </form>
              )}
              {tarjetaMsg && <p className="text-[13px] text-destructive">{tarjetaMsg}</p>}
            </div>

            {/* Recuperar contraseña: con la tarjeta escaneada, o con su correo. */}
            {porTarjeta ? (
              <button
                type="button"
                onClick={() => void recuperar()}
                disabled={recuperando}
                className="text-sm font-semibold text-indigo-600 underline disabled:opacity-50"
              >
                {recuperando ? "Recuperando…" : "Recuperar contraseña"}
              </button>
            ) : !modoRecuperar ? (
              <button
                type="button"
                onClick={() => setModoRecuperar(true)}
                className="text-sm font-semibold text-indigo-600 underline"
              >
                Recuperar contraseña
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void recuperar();
                }}
                className="flex gap-2"
              >
                <Input
                  type="email"
                  placeholder="Correo completo del cliente"
                  value={correoRecuperar}
                  onChange={(e) => setCorreoRecuperar(e.target.value)}
                  autoFocus
                />
                <Button type="submit" variant="secondary" disabled={recuperando}>
                  {recuperando ? "…" : "Recuperar"}
                </Button>
              </form>
            )}
          </div>
        )}

        {!consultado && !recovered && (
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}

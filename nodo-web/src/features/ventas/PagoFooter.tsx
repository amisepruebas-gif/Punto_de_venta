import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Check,
  Coins,
  CreditCard,
  Gift,
  X,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCarrito, subtotalItem, aVentaArticulo } from "./carritoStore";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { UsarPuntosModal } from "@/features/puntos/UsarPuntosModal";
import { UsarRegaloModal } from "@/features/puntos/UsarRegaloModal";
import { useTerminalClip } from "@/features/clip/useTerminalClip";
import { telefonosIguales, type MovimientoPago, type VentaArticulo } from "@shared";

/** Billetes con sus imágenes copiadas de `nodo_1/.../drawable/billete*`.
 *  Los nombres reflejan las denominaciones reales del peso mexicano. */
const BILLETES: Array<{ d: number; src: string }> = [
  { d: 20, src: "/img/billetes/b_20.png" },
  { d: 50, src: "/img/billetes/b_50.png" },
  { d: 100, src: "/img/billetes/b_100.png" },
  { d: 200, src: "/img/billetes/b_200.png" },
  { d: 500, src: "/img/billetes/b_500.jpg" },
  { d: 1000, src: "/img/billetes/b_1000.jpg" },
];

const COMISION_DEFAULT = 0.04; // 4 % — mismo valor hardcoded en Android nodo_1

type Metodo = "pagoEfectivo" | "pagoTarjeta" | "pagoTransferencia";

const METODOS: Array<{ id: Metodo; etiqueta: string; Icono: LucideIcon }> = [
  { id: "pagoEfectivo", etiqueta: "Efectivo", Icono: Banknote },
  { id: "pagoTarjeta", etiqueta: "Tarjeta", Icono: CreditCard },
  { id: "pagoTransferencia", etiqueta: "Transferencia", Icono: ArrowLeftRight },
];

/** Pesos sin centavos y con separador de miles: 1400 → "$1,400". */
function pesos(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

/** Payload que PagoFooter emite al hacer click en COBRAR. La venta NO se ha
 *  guardado todavía: el padre debe abrir un preview/confirm modal y solo al
 *  confirmar persistir vía `crearVenta`. Replica el flujo Android donde
 *  COBRAR abre `ticketDigital` y solo el botón "confirmar" llama a
 *  `finalizarVenta`. */
export type CobrarPayload = {
  articulos: VentaArticulo[];
  movimiento: MovimientoPago;
  montoCobro: string;
  montoPago: string;
  cambio: string;
  enTurno: string;
  vendedorIdUsuario?: string;
  comicion?: string;
  statusComision?: string;
  /** Canje de cashback (POS): $ descuento aplicado + cliente para acreditar/debitar. */
  descuentoPuntos?: string;
  puntosTelefono?: string;
  /** Usar cashback pide la tarjeta escaneada con la que se consultó o, sin
   *  ella, el correo del cliente (ya comprobado contra su teléfono; el
   *  servidor lo vuelve a verificar antes de debitar). */
  puntosCodigo?: string;
  puntosEmail?: string;
  /** Fase 3 — crédito de regalo usado como descuento (NO es ingreso) +
   *  identificador para debitarlo: la tarjeta, o teléfono + correo. */
  descuentoRegalo?: string;
  regaloCodigo?: string;
  regaloPhone?: string;
  regaloEmail?: string;
  /** Con tarjeta: el cobro se manda a la terminal Clip de la caja. Sin esto
   *  (sin terminal, sin internet o "Cobrar sin terminal") se cobra a mano. */
  terminalClip?: boolean;
};

type Props = {
  onCobrar: (data: CobrarPayload) => void;
  /** Contador que, al cambiar, fuerza limpiar clientePuntos/descuentoPuntos.
   *  El padre lo incrementa al finalizar o cancelar una venta para que NO quede
   *  anclado el cliente/descuento de la venta anterior. */
  resetSignal?: number;
};

/**
 * Panel de cobro. Con la tablet acostada va como columna a la derecha de la
 * lista; parada, abajo. De arriba a abajo: total, cashback y regalo, forma
 * de pago, lo de cada forma (billetes con scroll horizontal y lo recibido,
 * la comisión o los datos de transferencia), los avisos y COBRAR. Los avisos
 * viven aquí para no tapar nunca la lista.
 *
 * Sin TARJETA/TRANSFERENCIA elegidas, COBRAR usa EFECTIVO por default.
 */
export function PagoFooter({ onCobrar, resetSignal }: Props) {
  const { items, enTurno, vendedorIdUsuario } = useCarrito();
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const { sucursal } = useSucursal();
  const { serial: terminalSerial, enLinea } = useTerminalClip();

  // Items "desmarcados" se mantienen visibles en el carrito pero se
  // excluyen del total y del COBRAR. Mientras haya alguno, el botón
  // COBRAR queda deshabilitado y el panel lo avisa.
  const itemsActivos = useMemo(
    () => items.filter((it) => !it.desmarcado),
    [items],
  );
  const tieneDesmarcados = items.some((it) => it.desmarcado);

  const subtotalBruto = useMemo(
    () => itemsActivos.reduce((acc, it) => acc + subtotalItem(it), 0),
    [itemsActivos],
  );

  // Total cobrado por líneas de tarjeta de regalo. El cashback NO puede financiar
  // la denominación de una gift card (convertiría cashback no-transferible en
  // crédito transferible; rompe "crédito == dinero recibido"): el canje se limita
  // al subtotal de PRODUCTOS reales (subtotalBruto − giftTotal).
  const giftTotal = useMemo(
    () =>
      itemsActivos
        .filter((it) => it.giftCard)
        .reduce((acc, it) => acc + subtotalItem(it), 0),
    [itemsActivos],
  );
  const [recibido, setRecibido] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("pagoEfectivo");
  const [error, setError] = useState<string | null>(null);
  // Canje de puntos: descuento (pesos) + cliente identificado para acreditar.
  const [descuentoPuntos, setDescuentoPuntos] = useState(0);
  // `codigo`: la tarjeta escaneada con la que se consultó; `email`: sin ella,
  // el correo del cliente. Usar saldo pide uno de los dos.
  const [clientePuntos, setClientePuntos] = useState<{
    telefono: string;
    codigo?: string;
    email?: string;
  } | null>(null);
  // Aviso al cambiar de cliente con un descuento puesto: el descuento del
  // cliente anterior se quita (nunca se debita a uno lo aplicado a otro).
  const [avisoCliente, setAvisoCliente] = useState<string | null>(null);
  const [usarPuntosOpen, setUsarPuntosOpen] = useState(false);
  // Fase 3 — crédito de regalo usado (pesos) + identificador de la tarjeta para
  // debitarlo. Es un DESCUENTO (reduce el total; NO es ingreso — ya se contó al
  // vender la tarjeta).
  const [descuentoRegalo, setDescuentoRegalo] = useState(0);
  const [regaloId, setRegaloId] = useState<{
    codigo?: string;
    phone?: string;
    email?: string;
  } | null>(null);
  const [usarRegaloOpen, setUsarRegaloOpen] = useState(false);
  // Un descuento (cashback o crédito de regalo) YA aplicado se invalida al editar
  // el carrito — ver el effect de [subtotalBruto]. Sin avisar, el cajero cobraba
  // creyendo que seguía aplicado (el botón sigue marcado, porque esa marca
  // refleja el CLIENTE vinculado, que sí se conserva). Esta bandera lo
  // hace visible; se limpia al reaplicar o al empezar otra venta.
  const [descuentoInvalidado, setDescuentoInvalidado] = useState(false);

  // Cashback y crédito de regalo se TOPAN mutuamente contra el subtotal de
  // PRODUCTOS reales (subtotalBruto − giftTotal): su suma nunca cubre la
  // adquisición de una gift card (esa se paga con dinero real) ni se solapan.
  const maxCashbackAplicable = Math.max(0, subtotalBruto - giftTotal - descuentoRegalo);
  const maxRegaloAplicable = Math.max(0, subtotalBruto - giftTotal - descuentoPuntos);

  // Total a cobrar = bruto menos cashback menos crédito de regalo (ambos descuentos).
  const total = Math.max(0, subtotalBruto - descuentoPuntos - descuentoRegalo);

  // Si el carrito cambia (se edita), invalidar SOLO el DESCUENTO de cashback: se
  // calculó sobre el total anterior y podría exceder el nuevo (el cajero lo
  // vuelve a aplicar). El cliente para ACUMULAR (teléfono) NO depende del total,
  // así que se CONSERVA — si se borrara, fijar "acumular" antes de agregar
  // artículos perdería el teléfono y no se acreditaría nada.
  useEffect(() => {
    // `descuentoPuntos`/`descuentoRegalo` NO van en deps a propósito: el closure
    // trae el valor del render en que cambió el subtotal, es decir el descuento
    // que estaba aplicado justo antes de invalidarse.
    if (descuentoPuntos > 0 || descuentoRegalo > 0) setDescuentoInvalidado(true);
    setDescuentoPuntos(0);
    // El crédito de regalo también se recalcula sobre el nuevo subtotal.
    setDescuentoRegalo(0);
    setRegaloId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalBruto]);

  // Reset explícito por señal del padre (al FINALIZAR o CANCELAR una venta) para
  // que el cliente/descuento de puntos NUNCA quede anclado entre ventas, aunque
  // el carrito no cambie de subtotal.
  useEffect(() => {
    setDescuentoPuntos(0);
    setClientePuntos(null);
    setDescuentoRegalo(0);
    setRegaloId(null);
    setDescuentoInvalidado(false);
    setAvisoCliente(null);
  }, [resetSignal]);

  // Comisión — solo aplica con tarjeta y si la sucursal tiene cobrarComision=true
  const comisionPct = sucursal?.comisionTarjetaPct ?? COMISION_DEFAULT;
  const comisionEnabled =
    !!sucursal?.cobrarComision && metodo === "pagoTarjeta" && total > 0;
  const comision = comisionEnabled ? Math.round(total * comisionPct) : 0;
  const totalConTarjeta = total + comision;
  // Con terminal Clip asignada y con internet, la tarjeta se cobra en ella.
  const conTerminal = metodo === "pagoTarjeta" && !!terminalSerial && enLinea;

  const recibidoNum = Number(recibido) || 0;
  const cambio =
    metodo === "pagoEfectivo" ? Math.max(0, recibidoNum - total) : 0;
  const vacio = items.length === 0;
  const sinVendedor = !enTurno;
  const sinSesion = !negocioId || !sucursalId || !nodoId;
  const efectivoOK = metodo !== "pagoEfectivo" || recibidoNum >= total;

  // Si el padre vacía el carrito tras una venta confirmada, reseteamos el
  // estado local del footer (recibido + método).
  useEffect(() => {
    if (items.length === 0) {
      setRecibido("");
      setMetodo("pagoEfectivo");
      setError(null);
      setDescuentoPuntos(0);
      setClientePuntos(null);
      setDescuentoRegalo(0);
      setRegaloId(null);
      setDescuentoInvalidado(false);
      setAvisoCliente(null);
    }
  }, [items.length]);

  // Reset de `recibido` cuando cambia el método de pago. Sin esto, cualquier
  // valor ingresado/sumado con billetes en el método anterior persistía y
  // confundía: ej. ponías $200 en efectivo, cambiabas a tarjeta, hacías click
  // en un billete y se sumaba sobre el $200 viejo.
  useEffect(() => {
    setRecibido("");
  }, [metodo]);

  function elegirBillete(d: number) {
    // Reemplaza el "recibido" por la denominación del billete elegido —
    // no suma sobre el valor previo. Si el cliente paga con varios
    // billetes el cajero usa "Exacto" o tipea el monto directamente
    // en el input. Comportamiento decidido por el usuario.
    setRecibido(String(d));
  }

  function limpiarRecibido() {
    setRecibido("");
  }

  /** `aMano`: con terminal asignada, cobrarla por fuera ("Cobrar sin terminal"). */
  function cobrar(aMano = false) {
    if (!negocioId || !sucursalId || !nodoId || !enTurno) return;
    if (vacio) return;
    if (tieneDesmarcados) {
      setError("Hay artículos desmarcados — desliza para marcar o eliminar");
      return;
    }
    if (metodo === "pagoEfectivo" && recibidoNum < total) {
      setError(`Falta $${(total - recibidoNum).toFixed(0)}`);
      return;
    }
    setError(null);

    // En tarjeta el cliente paga total + comisión (si aplica). El montoCobro
    // sigue siendo el total del carrito (lo que registra ingreso para la
    // tienda); montoPago refleja lo que aportó el cliente.
    const montoPago =
      metodo === "pagoEfectivo"
        ? recibidoNum
        : metodo === "pagoTarjeta" && comisionEnabled
        ? totalConTarjeta
        : total;

    onCobrar({
      // Solo enviamos los items ACTIVOS (no desmarcados). Limpiamos
      // también las flags internas del carrito.
      articulos: itemsActivos.map(aVentaArticulo),
      movimiento: metodo as MovimientoPago,
      montoCobro: String(total),
      montoPago: String(montoPago),
      cambio: String(cambio),
      enTurno,
      vendedorIdUsuario: vendedorIdUsuario ?? undefined,
      ...(metodo === "pagoTarjeta"
        ? {
            comicion: String(comision),
            statusComision: comisionEnabled ? "con comision" : "sin comision",
            ...(conTerminal && !aMano ? { terminalClip: true } : {}),
          }
        : {}),
      ...(clientePuntos
        ? {
            puntosTelefono: clientePuntos.telefono,
            descuentoPuntos: String(descuentoPuntos),
            ...(descuentoPuntos > 0 && clientePuntos.codigo
              ? { puntosCodigo: clientePuntos.codigo }
              : descuentoPuntos > 0 && clientePuntos.email
                ? { puntosEmail: clientePuntos.email }
                : {}),
          }
        : {}),
      ...(descuentoRegalo > 0 && regaloId
        ? {
            descuentoRegalo: String(descuentoRegalo),
            ...(regaloId.codigo ? { regaloCodigo: regaloId.codigo } : {}),
            ...(regaloId.phone ? { regaloPhone: regaloId.phone } : {}),
            ...(regaloId.email ? { regaloEmail: regaloId.email } : {}),
          }
        : {}),
    });
  }

  const totalACobrar = comisionEnabled ? totalConTarjeta : total;
  const faltan = Math.max(0, total - recibidoNum);
  const piezas = itemsActivos.reduce(
    (n, it) => n + (Number(it.cantidad) || 0),
    0,
  );
  // Mismas condiciones que antes deshabilitaban COBRAR.
  const puedeCobrar =
    !vacio && !sinVendedor && !sinSesion && efectivoOK && !tieneDesmarcados;

  // Bajo el total: de dónde sale lo que se cobra.
  let desglose: string | null = null;
  if (descuentoPuntos > 0 || descuentoRegalo > 0) {
    desglose =
      `Artículos ${pesos(subtotalBruto)}` +
      (descuentoPuntos > 0 ? ` · cashback −${pesos(descuentoPuntos)}` : "") +
      (descuentoRegalo > 0 ? ` · regalo −${pesos(descuentoRegalo)}` : "");
  } else if (comisionEnabled) {
    desglose = `Artículos ${pesos(total)} + comisión ${pesos(comision)}`;
  }

  // Por qué no se puede cobrar, o qué cambió. Lo que falta de efectivo ya lo
  // dice el recuadro de "Faltan por recibir".
  const avisos: Array<{ tono: "aviso" | "error" | "lealtad"; texto: string }> = [];
  if (sinVendedor) {
    avisos.push({
      tono: "aviso",
      texto: "Elige arriba quién atiende para poder cobrar.",
    });
  } else if (!vacio && sinSesion) {
    avisos.push({
      tono: "aviso",
      texto: "Este equipo no tiene sesión de nodo: regístralo para poder cobrar.",
    });
  }
  if (tieneDesmarcados && !error) {
    avisos.push({
      tono: "aviso",
      texto:
        "Hay artículos desmarcados: desliza la fila a la derecha para marcarlos o a la izquierda para quitarlos.",
    });
  }
  if (error) avisos.push({ tono: "error", texto: error });
  if (avisoCliente) avisos.push({ tono: "lealtad", texto: avisoCliente });
  if (descuentoInvalidado && descuentoPuntos === 0 && descuentoRegalo === 0) {
    avisos.push({
      tono: "lealtad",
      texto: "El carrito cambió: el descuento se quitó y hay que volver a aplicarlo.",
    });
  }

  const cobrarDetalle = vacio
    ? "Agrega artículos"
    : sinVendedor
    ? "Elige quién atiende"
    : sinSesion
    ? "Equipo sin sesión"
    : tieneDesmarcados
    ? "Hay artículos desmarcados"
    : metodo === "pagoEfectivo"
    ? efectivoOK
      ? `Efectivo · cambio ${pesos(cambio)}`
      : `Faltan ${pesos(faltan)} por recibir`
    : metodo === "pagoTarjeta"
    ? `Tarjeta${conTerminal ? " · terminal Clip" : ""}${comisionEnabled ? " · con comisión" : ""}`
    : "Transferencia";

  return (
    <aside
      aria-label="Cobro"
      className="flex shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 min-[860px]:min-h-0 min-[860px]:w-[22rem] min-[860px]:p-4"
    >
      <UsarPuntosModal
        open={usarPuntosOpen}
        maxTotal={maxCashbackAplicable}
        onClose={() => setUsarPuntosOpen(false)}
        onAplicar={({ telefono, codigo, email, descuento, soloLigar }) => {
          setUsarPuntosOpen(false);
          const mismo =
            !!clientePuntos && telefonosIguales(clientePuntos.telefono, telefono);
          // Activar/reponer la tarjeta del MISMO cliente no toca su descuento.
          if (soloLigar && mismo) return;
          // Otro cliente: su descuento sustituye al del anterior, nunca se
          // debita a uno lo que se aplicó a otro.
          setAvisoCliente(
            !mismo && descuentoPuntos > 0 && descuento === 0
              ? "Cambió el cliente de cashback: se quitó el descuento del anterior."
              : null,
          );
          setDescuentoPuntos(descuento);
          setClientePuntos({
            telefono,
            ...(codigo ? { codigo } : {}),
            ...(email ? { email } : {}),
          });
          setDescuentoInvalidado(false);
        }}
      />
      <UsarRegaloModal
        open={usarRegaloOpen}
        maxTotal={maxRegaloAplicable}
        onClose={() => setUsarRegaloOpen(false)}
        onAplicar={({ codigo, phone, email, monto }) => {
          setDescuentoRegalo(monto);
          setRegaloId({ codigo, phone, email });
          setDescuentoInvalidado(false);
          setUsarRegaloOpen(false);
        }}
      />

      {/* Acostada, lo de en medio hace scroll si no cabe y COBRAR se queda
          siempre a la vista. */}
      <div className="flex flex-col gap-2 min-[860px]:min-h-0 min-[860px]:flex-1 min-[860px]:overflow-y-auto [@media(max-height:560px)]:gap-1.5">
        {/* Total y descuentos: parada van lado a lado; acostada, uno sobre otro. */}
        <div className="flex gap-3 min-[860px]:flex-col min-[860px]:gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-[13px] text-muted-foreground">
              <span className="font-semibold">Total a cobrar</span>
              <span>
                {piezas} {piezas === 1 ? "pieza" : "piezas"}
              </span>
            </div>
            <p className="text-[2.5rem] font-bold leading-[1.1] tracking-tight tabular-nums [@media(max-height:560px)]:text-[2rem]">
              {pesos(totalACobrar)}
            </p>
            {desglose && (
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {desglose}
              </p>
            )}
          </div>
          <div className="grid w-[12.5rem] shrink-0 grid-rows-2 gap-2 min-[860px]:w-auto min-[860px]:grid-cols-2 min-[860px]:grid-rows-1">
            <BotonLealtad
              activo={descuentoPuntos > 0}
              Icono={descuentoPuntos > 0 || clientePuntos ? Check : Coins}
              etiqueta={
                descuentoPuntos > 0
                  ? `Cashback −${pesos(descuentoPuntos)}`
                  : "Cashback"
              }
              onClick={() => setUsarPuntosOpen(true)}
            />
            <BotonLealtad
              activo={descuentoRegalo > 0}
              Icono={descuentoRegalo > 0 ? Check : Gift}
              etiqueta={
                descuentoRegalo > 0
                  ? `Regalo −${pesos(descuentoRegalo)}`
                  : "Crédito de regalo"
              }
              onClick={() => setUsarRegaloOpen(true)}
            />
          </div>
        </div>

        {/* Forma de pago */}
        <div
          role="group"
          aria-label="Forma de pago"
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
        >
          {METODOS.map(({ id, etiqueta, Icono }) => {
            const activo = metodo === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={activo}
                onClick={() => setMetodo(id)}
                className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[9px] px-1 text-sm font-semibold transition-colors min-[860px]:flex-col min-[860px]:gap-0.5 min-[860px]:text-[12.5px] ${
                  activo
                    ? "bg-card text-marca-oscuro ring-2 ring-inset ring-marca"
                    : "text-muted-foreground hover:bg-card/60"
                }`}
              >
                <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {etiqueta}
              </button>
            );
          })}
        </div>

        {metodo === "pagoEfectivo" && (
          <>
            {/* Billetes grandes con scroll horizontal, como estaban antes.
                Tocar uno reemplaza lo recibido (no suma). */}
            <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto">
              {BILLETES.map((b) => (
                <button
                  key={b.d}
                  type="button"
                  onClick={() => elegirBillete(b.d)}
                  aria-label={`Pago con $${b.d}`}
                  className={`h-[4.5rem] aspect-[110/54] shrink-0 overflow-hidden rounded-md border-2 bg-card transition active:scale-95 ${
                    recibidoNum === b.d
                      ? "border-marca"
                      : "border-border hover:border-marca/60"
                  }`}
                >
                  <img
                    src={b.src}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>

            {/* Parada: Recibido · Cambio · Exacto en un renglón. Acostada:
                Recibido y Exacto arriba, y el cambio abajo a todo lo ancho. */}
            <div className="grid grid-cols-[minmax(0,1fr)_10.5rem_5.5rem] gap-2 min-[860px]:grid-cols-[minmax(0,1fr)_5.5rem]">
              <label className="flex h-[3.25rem] min-w-0 items-center gap-2 rounded-[10px] border-[1.5px] border-border bg-card pl-3 pr-1 transition-colors focus-within:border-marca">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  Recibido
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  aria-label="Recibido"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  placeholder="0"
                  className="h-11 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-right text-xl font-bold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {recibidoNum > 0 && (
                  <button
                    type="button"
                    onClick={limpiarRecibido}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Limpiar recibido"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                )}
              </label>
              <div
                role="status"
                className={`flex h-[3.25rem] min-w-0 flex-col justify-center rounded-[10px] px-3 min-[860px]:order-last min-[860px]:col-span-2 min-[860px]:h-11 min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between ${
                  vacio
                    ? "bg-muted text-muted-foreground"
                    : efectivoOK
                    ? "bg-cobro-suave text-cobro-texto"
                    : "border border-aviso-borde bg-aviso-suave text-aviso"
                }`}
              >
                <span className="text-xs font-semibold min-[860px]:text-sm">
                  {efectivoOK ? "Cambio" : "Faltan por recibir"}
                </span>
                <span className="text-xl font-bold leading-tight tabular-nums min-[860px]:text-2xl">
                  {pesos(efectivoOK ? cambio : faltan)}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRecibido(String(comisionEnabled ? totalConTarjeta : total))
                }
                disabled={total === 0}
                className="h-[3.25rem] rounded-[10px] border bg-card text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              >
                Exacto
              </button>
            </div>
          </>
        )}

        {metodo === "pagoTarjeta" && (
          <div className="flex flex-col gap-2">
            {comisionEnabled && (
              <div className="rounded-[10px] bg-muted px-3.5 py-2.5 text-sm tabular-nums">
                <div className="flex justify-between gap-2">
                  <span>Artículos</span>
                  <span>{pesos(total)}</span>
                </div>
                <div className="flex justify-between gap-2 font-medium text-aviso">
                  <span>Comisión {Math.round(comisionPct * 100)} %</span>
                  <span>+ {pesos(comision)}</span>
                </div>
                <div className="mt-1.5 flex justify-between gap-2 border-t pt-1.5 font-bold">
                  <span>Total con tarjeta</span>
                  <span>{pesos(totalConTarjeta)}</span>
                </div>
              </div>
            )}
            <p className="text-[13px] text-muted-foreground">
              {conTerminal
                ? "Se manda a la terminal Clip: el cliente paga ahí."
                : terminalSerial
                  ? "Sin internet: cobra en la terminal por tu cuenta y después toca Cobrar."
                  : "Cobra en la terminal y después toca Cobrar."}
            </p>
          </div>
        )}

        {/* Datos de transferencia. Replica `consInformacionDepagoa` Android
            (líneas 1681-1803 principal.xml): banco, titular, CLABE resaltada
            y referencia opcional. */}
        {metodo === "pagoTransferencia" && (
          <div className="rounded-[10px] bg-marca-suave px-3.5 py-2.5 text-marca-oscuro">
            {sucursal?.datosTransferencia ? (
              <>
                <p className="text-base font-bold">
                  {sucursal.datosTransferencia.banco || "Banco"}
                </p>
                {sucursal.datosTransferencia.titular && (
                  <p className="text-sm">{sucursal.datosTransferencia.titular}</p>
                )}
                <div className="mt-2 rounded-lg bg-card px-2.5 py-1.5">
                  <p className="text-xs font-semibold">CLABE</p>
                  <p className="text-base font-bold tabular-nums tracking-wide text-foreground">
                    {sucursal.datosTransferencia.cuenta || "—"}
                  </p>
                </div>
                {sucursal.datosTransferencia.referencia && (
                  <div className="mt-1.5 rounded-lg bg-card px-2.5 py-1.5">
                    <p className="text-xs font-semibold">Referencia</p>
                    <p className="text-base font-bold tabular-nums tracking-wide text-foreground">
                      {sucursal.datosTransferencia.referencia}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm">
                Configura los datos de transferencia desde admin-web.
              </p>
            )}
          </div>
        )}

        {avisos.map((a) => (
          <p
            key={a.texto}
            role={a.tono === "error" ? "alert" : "status"}
            className={`rounded-[10px] border px-3 py-2 text-[13px] font-medium ${
              a.tono === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : a.tono === "lealtad"
                ? "border-lealtad-borde bg-lealtad-suave text-lealtad-texto"
                : "border-aviso-borde bg-aviso-suave text-aviso"
            }`}
          >
            {a.texto}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={() => cobrar()}
        disabled={!puedeCobrar}
        className="flex h-[3.75rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-cobro text-white transition-colors hover:bg-cobro/90 active:bg-cobro/80 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        <span className="text-xl font-bold tabular-nums">
          Cobrar {pesos(totalACobrar)}
          {conTerminal ? " en terminal" : ""}
        </span>
        <span
          className={`text-[13px] font-medium tabular-nums ${
            puedeCobrar ? "text-cobro-claro" : ""
          }`}
        >
          {cobrarDetalle}
        </span>
      </button>
      {conTerminal && (
        // Respaldo: la terminal no responde o el cliente paga en otra.
        <button
          type="button"
          onClick={() => cobrar(true)}
          disabled={!puedeCobrar}
          className="h-11 shrink-0 rounded-xl text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cobrar sin terminal
        </button>
      )}
    </aside>
  );
}

/** Cashback o crédito de regalo: morado suave; ya aplicado, morado lleno. */
function BotonLealtad({
  activo,
  Icono,
  etiqueta,
  onClick,
}: {
  activo: boolean;
  Icono: LucideIcon;
  etiqueta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[10px] border px-2 text-[13px] font-semibold transition-colors ${
        activo
          ? "border-transparent bg-lealtad text-white hover:bg-lealtad/90"
          : "border-lealtad-borde bg-lealtad-suave text-lealtad-texto hover:bg-lealtad-borde"
      }`}
    >
      <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="truncate">{etiqueta}</span>
    </button>
  );
}

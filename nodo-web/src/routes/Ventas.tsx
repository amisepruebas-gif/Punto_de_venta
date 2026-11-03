import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { useCorteActivo } from "@/features/cortes/useCorteActivo";
import { Button } from "@/components/ui/button";
import { SelectorVendedor } from "@/features/ventas/SelectorVendedor";
import {
  BuscadorArticulo,
  type BuscadorArticuloHandle,
} from "@/features/ventas/BuscadorArticulo";
import { VariacionPickerModal } from "@/features/ventas/VariacionPickerModal";
import { SenaPickerModal } from "@/features/ventas/SenaPickerModal";
import { CarritoPanel } from "@/features/ventas/CarritoPanel";
import { PagoFooter, type CobrarPayload } from "@/features/ventas/PagoFooter";
import { NoRegistradoModal } from "@/features/ventas/NoRegistradoModal";
import { ConfirmarVentaModal } from "@/features/ventas/ConfirmarVentaModal";
import { ConfirmarSalidaModal } from "@/features/ventas/ConfirmarSalidaModal";
import { CorteModal } from "@/features/cortes/CorteModal";
import { ChatGrupoModal } from "@/features/chat-grupo/ChatGrupoModal";
import { useChatGrupoNodo } from "@/features/chat-grupo/useChatGrupoNodo";
import { ApartadoModal } from "@/features/apartados/ApartadoModal";
import { ApartadosSheet } from "@/features/apartados/ApartadosSheet";
import { TicketModal } from "@/features/ventas/TicketModal";
import { VentaRealizadaOverlay } from "@/features/ventas/VentaRealizadaOverlay";
import { BarraAcciones, BotonAccion } from "@/features/ventas/BarraAcciones";
import { BotonCabecera, BotonCorte } from "@/features/ventas/BotonCabecera";
import { RegistrosVentasSheet } from "@/features/ventas/historial/RegistrosVentasSheet";
import { PinPromptModal } from "@/features/ventas/historial/PinPromptModal";
import { usePinVentas } from "@/features/ventas/historial/usePinVentas";
import { useCarrito, subtotalItem } from "@/features/ventas/carritoStore";
import { useArticulos } from "@/features/articulos/useArticulos";
import { crearVenta } from "@/features/ventas/ventaService";
import {
  codigoErrorPuntos,
  ean13Ok,
  etiquetaTarjetaClip,
  generarID,
  clasificarErrorPuntos,
  pagoClipDeCobro,
  pagoClipManual,
  pendienteVigente,
  telefonosIguales,
  ventaSinDescuentoConEfectivo,
  type CobroClip,
  type PagoClip,
} from "@shared";
import { formatearTicketEscPos } from "@/features/ventas/ticketEscPos";
import { posDisponible, imprimirTicket } from "@/lib/pos-bridge";
import { useBackHandler } from "@/lib/back-handler";
import { useApariencia } from "@/features/apariencia/useApariencia";
import {
  Bookmark,
  BookmarkPlus,
  ListOrdered,
  MessageSquare,
  PackagePlus,
  Printer,
  Settings,
  Truck,
} from "lucide-react";
import { useResurtidosPendientesCount } from "@/features/resurtidos/useResurtidosPendientesCount";
import type { Articulo, Venta } from "@shared";
import { MenuPuntosRegalo } from "@/features/puntos/MenuPuntosRegalo";
import {
  PreRegistroClienteModal,
  type PreRegistroData,
} from "@/features/puntos/PreRegistroClienteModal";
import {
  VenderRegaloModal,
  type VenderRegaloData,
} from "@/features/puntos/VenderRegaloModal";
import {
  RecargarRegaloModal,
  type RecargarRegaloData,
} from "@/features/puntos/RecargarRegaloModal";
import {
  GiftEmitidaModal,
  type GiftEmitidaInfo,
} from "@/features/puntos/GiftEmitidaModal";
import { VinculacionClienteModal } from "@/features/puntos/VinculacionClienteModal";
import { ColaPuntosAviso } from "@/features/puntos/ColaPuntosAviso";
import {
  useClientePuntos,
  type ClientePendiente,
  type GiftPendiente,
  type TarjetaPendiente,
} from "@/features/puntos/clientePuntosStore";
import { CobroClipOverlay } from "@/features/clip/CobroClipOverlay";
import {
  RecuperarCobroClip,
  montoTarjetaDe,
  type AccionRecuperar,
} from "@/features/clip/RecuperarCobroClip";
import { CobroSinResolver, useCobroTerminal } from "@/features/clip/useCobroTerminal";
import { useCobroClip, type VentaEnCobro } from "@/features/clip/clipStore";
import {
  enviarPuntosAhora,
  usePuntosColaFlush,
} from "@/features/puntos/usePuntosColaFlush";
import { generarCodigoPuntos } from "@/features/puntos/codigoPuntos";
import { CARD_ARTICLE_ID } from "@/features/puntos/tarjeta";
import {
  fnCanjearPuntos,
  fnConsultarSaldoPuntos,
  fnCerrarCanje,
  fnConsultarSaldoTarjetaRegalo,
  fnRedimirCreditoRegalo,
  fnCerrarCreditoRegalo,
  type AcreditarPuntosOutput,
  type CerrarCanjeInput,
  type CerrarCreditoRegaloInput,
  type EmitirTarjetaRegaloOutput,
  type RecargarTarjetaRegaloOutput,
} from "@/firebase/callable";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { marcarCajaOcupada } from "@/lib/cajaOcupada";

/** Pendientes de lealtad de una venta (tarjeta a ligar, regalo a emitir). */
type PendientesVenta = {
  tarjPend: TarjetaPendiente | null;
  giftPend: GiftPendiente | null;
};

/** Opciones de `ejecutarVenta` para el cobro con la terminal Clip. */
type OpcionesVenta = {
  /** La tarjeta ya se cobró (o el cajero lo confirmó): no se vuelve a cobrar. */
  pagoClip?: PagoClip;
  /** Venta retomada tras recargar: sus pendientes vienen guardados con el
   *  cobro, porque la caja abrió con el carrito vacío y los limpió. */
  pendientes?: PendientesVenta;
  /** Terminar una venta ya cobrada tras recargar: sin el modo offline de
   *  crearVenta, que podría pisar la venta si ya se había creado. */
  sinOffline?: boolean;
};

/** Un descuento (cashback o regalo) no se pudo aplicar. Con la tarjeta ya
 *  cobrada no aborta: se reintenta o la diferencia se cobra en efectivo. */
class DescuentoFallido extends Error {
  quitar: "cashback" | "regalo";
  monto: number;
  /** Error de red: no se sabe si el débito se hizo. */
  incierto: boolean;
  constructor(mensaje: string, quitar: "cashback" | "regalo", monto: number, incierto = false) {
    super(mensaje);
    this.quitar = quitar;
    this.monto = monto;
    this.incierto = incierto;
  }
}

/**
 * Antes de cobrar en la terminal: que el cashback y el crédito de regalo
 * alcancen (solo consulta). Si no, se detiene sin cobrar nada; así, ya
 * cobrada la tarjeta, un descuento casi no puede fallar.
 */
async function revisarSaldosAntesDeTerminal(
  cashbackIdent: { codigo?: string; phone?: string },
  cashbackUsar: number,
  regaloUsar: number,
  regaloIdent: { codigo?: string; phone?: string } | null,
): Promise<void> {
  if (cashbackUsar > 0) {
    let disponible: number;
    try {
      // Con la tarjeta, por la tarjeta; sin ella (se usa con el correo), por el
      // teléfono: las dos dan el saldo del mismo monedero.
      const r = await fnConsultarSaldoPuntos(
        cashbackIdent.codigo ? { codigo: cashbackIdent.codigo } : { phone: cashbackIdent.phone },
      );
      disponible = r.data.exists ? Number(r.data.saldoUsable ?? r.data.saldoDinero) || 0 : 0;
    } catch {
      throw new Error("No se pudo revisar el cashback (sin conexión). Quítalo o reintenta.");
    }
    if (disponible < cashbackUsar) {
      throw new Error("Cashback insuficiente. Ajusta el monto y reintenta.");
    }
  }
  if (regaloUsar > 0 && regaloIdent) {
    let saldo: { saldo: number; vencido: boolean };
    try {
      const r = await fnConsultarSaldoTarjetaRegalo({
        ...(regaloIdent.codigo ? { codigo: regaloIdent.codigo } : {}),
        ...(regaloIdent.phone ? { phone: regaloIdent.phone } : {}),
      });
      saldo = { saldo: Number(r.data.saldo) || 0, vencido: Boolean(r.data.vencido) };
    } catch {
      throw new Error("No se pudo revisar el crédito de regalo (sin conexión). Quítalo o reintenta.");
    }
    if (saldo.vencido) throw new Error("El crédito de regalo venció. Quítalo y reintenta.");
    if (saldo.saldo < regaloUsar) {
      throw new Error("Crédito de regalo insuficiente. Ajusta el monto y reintenta.");
    }
  }
}

export function Ventas() {
  const navigate = useNavigate();
  const { negocioId, sucursalId, nodoId, session } = useNodoSession();
  const { sucursal } = useSucursal();
  const { corte } = useCorteActivo();
  const { limpiar, items, agregar } = useCarrito();
  const { byId: articulosById } = useArticulos();
  const { fondo, fondoOpacidad, cabecera, cabeceraOpacidad, logo } =
    useApariencia();
  const resurtidosPendientes = useResurtidosPendientesCount();
  usePuntosColaFlush();
  const pendientePuntos = useClientePuntos((s) => s.pendiente);
  // "Caja 1 · Centro" junto al logo, para saber en qué caja se está.
  const nombreCaja = [session?.nombreNodo, sucursal?.nombre]
    .filter(Boolean)
    .join(" · ");

  // Higiene (money-safety): al quedar VACÍO el carrito (venta finalizada o
  // vaciado manual) no arrastrar una `tarjetaPendiente` rancia a otra venta.
  // Corre async tras el render → NUNCA borra el pendiente entre el `limpiar()`
  // post-venta y la vinculación, que ya lo consumió (y limpió) para entonces.
  useEffect(() => {
    if (items.length === 0) {
      useClientePuntos.getState().limpiarTarjetaPendiente();
      // Igual para la gift card: un pendiente rancio (venta cancelada o recarga
      // de página) no debe emitirse en la próxima venta. El guard "emitida ⟺
      // cobrada" ya lo cubre; esto lo limpia proactivamente.
      useClientePuntos.getState().limpiarGiftPendiente();
    }
  }, [items.length]);
  const [corteOpen, setCorteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [apartarOpen, setApartarOpen] = useState(false);
  const [apartadosOpen, setApartadosOpen] = useState(false);
  const [registrosOpen, setRegistrosOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const { pin: pinRegistros } = usePinVentas(negocioId);
  const [noRegOpen, setNoRegOpen] = useState(false);
  const [preRegOpen, setPreRegOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [recargaOpen, setRecargaOpen] = useState(false);
  // Confirmación de emisión de gift card (muestra el código de acceso al cajero).
  const [giftEmitida, setGiftEmitida] = useState<GiftEmitidaInfo | null>(null);
  const [vinculacionOpen, setVinculacionOpen] = useState(false);
  const [ventaParaVincular, setVentaParaVincular] = useState<{
    venta: Venta;
    monto: string;
    path: string;
  } | null>(null);
  // La pregunta "¿sumar cashback?" va después de cobrar: tampoco recargar ahí.
  useEffect(() => {
    marcarCajaOcupada("vinculacion", vinculacionOpen);
    return () => marcarCajaOcupada("vinculacion", false);
  }, [vinculacionOpen]);
  // El cliente en espera vence a la hora aunque no haya ventas.
  useEffect(() => {
    const revisar = () => {
      const p = useClientePuntos.getState().pendiente;
      if (p && !pendienteVigente(p, Date.now())) {
        useClientePuntos.getState().limpiarPendiente();
      }
    };
    revisar();
    const iv = window.setInterval(revisar, 60_000);
    return () => window.clearInterval(iv);
  }, []);
  const [salidaOpen, setSalidaOpen] = useState(false);
  const [varPickerPadre, setVarPickerPadre] = useState<Articulo | null>(null);
  const [senaPadre, setSenaPadre] = useState<Articulo | null>(null);
  // Ref al buscador de artículos para devolverle el foco al input tras
  // cerrar VariacionPickerModal o SenaPickerModal. Sin esto, después de
  // cada escaneo que abre modal el siguiente scan se pierde en `body`.
  const buscadorRef = useRef<BuscadorArticuloHandle>(null);
  // Avisos de la venta en curso (tarjeta, regalo) para el mensaje final.
  const avisosVentaRef = useRef<string[]>([]);

  // Hook del chat del nodo a nivel app — el sonido de notificación y el
  // badge de no-leídos deben funcionar aunque el modal esté cerrado. Si
  // lo dejáramos dentro de ChatGrupoModal, el cajero solo escucharía el
  // sonido al tener el chat abierto, que es lo contrario de lo útil.
  const chatData = useChatGrupoNodo();
  // El preview lleva una `idempotencyKey` generada al momento de cobrar,
  // para que un retry de `crearVenta` (timeout, etc.) no duplique la venta:
  // misma key → mismo doc id → la transacción detecta que ya existe y
  // devuelve los datos. Si el usuario cancela el preview y vuelve a cobrar,
  // se genera una nueva key (es venta nueva).
  const [preview, setPreview] = useState<
    (CobrarPayload & { idempotencyKey: string }) | null
  >(null);
  // Señal para limpiar clientePuntos/descuentoPuntos en PagoFooter al
  // FINALIZAR o CANCELAR una venta (que no quede anclado entre ventas).
  const [resetPuntosSignal, setResetPuntosSignal] = useState(0);
  // `ultimaVenta` se conserva todo el tiempo que el cajero esté en la
  // pantalla — la usa el FAB de reimprimir. NO se muestra como modal
  // automáticamente al cerrar la venta: el modal de ticket solo aparece
  // cuando el cajero lo solicita explícitamente (FAB) y solo si no hay
  // bridge POS para imprimir directo (fallback PDF).
  const [ultimaVenta, setUltimaVenta] = useState<Venta | null>(null);
  const [overlayShow, setOverlayShow] = useState(false);
  // Loading que cubre el hueco entre "Confirmar" y "Venta realizada" (incluye la
  // acreditación de cashback, que es un await a la nube tras crear la venta).
  const [procesando, setProcesando] = useState(false);
  // Cobro con la terminal Clip: pantalla y pasos (ver features/clip).
  const terminal = useCobroTerminal({ negocioId, sucursalId });
  // Cobro con terminal a medias de antes de recargar: se pregunta al abrir.
  const registroClip = useCobroClip((s) => s.cobro);
  const [recuperarClip, setRecuperarClip] = useState(
    () => useCobroClip.getState().cobro !== null,
  );
  // Venta retomada desde un cobro a medias: lleva sus pendientes de lealtad.
  const retomadoRef = useRef<{ cobroId: string; pendientes: PendientesVenta } | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Handler del back físico/gesto del Android. Prioridad de cierre:
  // sheets/modales abiertos primero, después la app deja que el navegador
  // navegue atrás (lo hace `__handleAndroidBack` en back-handler.ts).
  useBackHandler(
    () => {
      // A media venta (cobrando, en la terminal o retomando un cobro) atrás
      // no hace nada: cerrar la vista previa perdería el aviso del cobro.
      if (procesando || terminal.vista || recuperarClip) return true;
      if (salidaOpen) {
        setSalidaOpen(false);
        return true;
      }
      if (varPickerPadre) {
        setVarPickerPadre(null);
        // Restaurar foco al buscador para que el siguiente scan no se
        // pierda — mismo motivo que en onClose/onSelect del modal.
        buscadorRef.current?.focus();
        return true;
      }
      if (senaPadre) {
        setSenaPadre(null);
        buscadorRef.current?.focus();
        return true;
      }
      if (pinOpen) {
        setPinOpen(false);
        return true;
      }
      if (registrosOpen) {
        setRegistrosOpen(false);
        return true;
      }
      if (apartadosOpen) {
        setApartadosOpen(false);
        return true;
      }
      if (chatOpen) {
        setChatOpen(false);
        return true;
      }
      if (corteOpen) {
        setCorteOpen(false);
        return true;
      }
      if (apartarOpen) {
        setApartarOpen(false);
        return true;
      }
      if (noRegOpen) {
        setNoRegOpen(false);
        return true;
      }
      if (ticketModalOpen) {
        setTicketModalOpen(false);
        return true;
      }
      if (preview) {
        setPreview(null);
        return true;
      }
      // El overlay "venta realizada" es transitorio (1.4s) — consumimos el
      // back para que no haga nada mientras se muestra.
      if (overlayShow) return true;
      // Catchall en la vista principal: en lugar de dejar que el APK cierre
      // la activity, mostramos el popup de confirmación de salida (replica
      // de `pop.preguntar_salir_app` del nodo_1). Solo el botón "Salir" del
      // modal cierra la app vía `POS.cerrarApp()`.
      setSalidaOpen(true);
      return true;
    },
    [
      salidaOpen,
      varPickerPadre,
      senaPadre,
      pinOpen,
      registrosOpen,
      apartadosOpen,
      chatOpen,
      corteOpen,
      apartarOpen,
      noRegOpen,
      ticketModalOpen,
      preview,
      overlayShow,
      procesando,
      terminal.vista,
      recuperarClip,
    ],
  );

  // Impresión vía bridge nativo (APK). No se await — el toast aparece
  // cuando la APK responde, mientras tanto el cajero ya puede seguir
  // operando. Si no hay POS, devuelve false para que el caller decida
  // el fallback (en este flujo: abrir TicketModal PDF).
  function imprimirTicketNativo(venta: Venta, puntosMsg?: string): boolean {
    if (!posDisponible()) return false;
    const formato = formatearTicketEscPos(venta, sucursal);
    imprimirTicket({ formato }).then((res) => {
      if (res.ok) {
        // Unifica el feedback de puntos con el de impresión para que NO se pise.
        setToast(
          puntosMsg
            ? `${puntosMsg} · Ticket #${venta.numeroDeVenta}`
            : `Ticket impreso #${venta.numeroDeVenta}`,
        );
        window.setTimeout(() => setToast(null), puntosMsg ? 6000 : 3000);
      } else {
        setToast(`No se pudo imprimir: ${res.error}`);
        window.setTimeout(() => setToast(null), 6000);
      }
    });
    return true;
  }

  // Finaliza la venta: registra como última, muestra overlay e imprime.
  function finalizarVenta(venta: Venta, mensaje?: string) {
    // Avisos de tarjeta/regalo de esta venta + el de cashback, en un solo toast.
    const puntosMsg =
      [...avisosVentaRef.current, mensaje].filter(Boolean).join(" · ") || undefined;
    avisosVentaRef.current = [];
    setUltimaVenta(venta);
    setOverlayShow(true);
    const printed = imprimirTicketNativo(venta, puntosMsg);
    // Sin impresora no hay toast desde imprimir → mostrar el de puntos aquí.
    if (!printed && puntosMsg) {
      setToast(puntosMsg);
      window.setTimeout(() => setToast(null), 5000);
    }
    // Limpiar clientePuntos/descuentoPuntos del footer (no anclar entre ventas).
    setResetPuntosSignal((n) => n + 1);
  }

  // Envoltura: enciende el loading durante TODO el proceso (canje + crearVenta +
  // acreditación) y lo apaga en cualquier salida (éxito, vinculación o error).
  // Sin argumentos cobra la venta de la vista previa (botón Confirmar); al
  // retomar un cobro con terminal a medias se pasan su venta y sus opciones.
  async function confirmarVenta(v: VentaEnCobro | null = preview, op?: OpcionesVenta) {
    setProcesando(true);
    // La recarga forzada remota espera a que termine (débito → venta → envíos).
    marcarCajaOcupada("cobro", true);
    try {
      const retomado = retomadoRef.current;
      await ejecutarVenta(
        v,
        op ??
          (retomado && v && retomado.cobroId === v.idempotencyKey
            ? { pendientes: retomado.pendientes }
            : {}),
      );
    } finally {
      marcarCajaOcupada("cobro", false);
      setProcesando(false);
      terminal.cerrar();
    }
  }

  async function ejecutarVenta(p: VentaEnCobro | null, op: OpcionesVenta = {}) {
    if (!p) throw new Error("Sin preview de venta");
    if (!negocioId || !sucursalId || !nodoId) {
      throw new Error("Sesión del nodo inválida");
    }
    const monto = p.montoCobro;
    const puntosTel = p.puntosTelefono;
    const descPuntos = p.descuentoPuntos;
    const cashbackUsar = Number(descPuntos) || 0;
    // Fase 3 — crédito de regalo usado como descuento (NO ingreso: montoCobro ya
    // lo excluye). Se debita EN LÍNEA antes de crear la venta (como el cashback).
    const regaloUsar = Number(p.descuentoRegalo) || 0;
    const regaloIdent =
      regaloUsar > 0
        ? {
            codigo: p.regaloCodigo,
            phone: p.regaloPhone,
            email: p.regaloEmail,
          }
        : null;

    // USAR cashback REQUIERE conexión: se debita EN LÍNEA *antes* de crear la venta.
    // Si falla (sin red o saldo), se aborta el cobro: NO se aplica el descuento y
    // NO se crea la venta (el modal muestra el error; el cajero lo quita o reintenta).
    // Idempotente por la idempotencyKey del preview (estable en retry).
    // (Acumular cashback SÍ funciona offline — es seguro porque solo suma.)
    // Blindaje money-safety: un descuento de cashback SIN teléfono no puede
    // debitarse → se estaría regalando saldo. Aborta el cobro (no crea la venta).
    if (cashbackUsar > 0 && !puntosTel) {
      throw new Error("No se puede aplicar cashback sin teléfono del cliente. Quítalo y reintenta.");
    }
    // Usar cashback pide la tarjeta del cliente o su correo (el servidor
    // verifica que sea de ese monedero). Sin ninguno, se detiene sin debitar.
    if (cashbackUsar > 0 && !p.puntosCodigo && !p.puntosEmail) {
      throw new Error(
        "Para usar cashback hace falta la tarjeta del cliente o su correo. Quita el descuento y vuelve a aplicarlo.",
      );
    }
    // Fase 5 (mínima-segura) — candado de canje: el servidor previene el DOBLE
    // DÉBITO (pendingLock → si hay un canje en curso del mismo cliente devuelve 409
    // y aquí se aborta). NO se reusa el cobro entre recargas (eso requeriría verificar
    // si la venta ya existe → deferido); el residual es el huérfano raro (detectable).
    const cobroId = p.idempotencyKey;

    // Terminal Clip: la tarjeta se cobra ANTES de descontar y de guardar la
    // venta (un rechazo es común; así no queda un débito sin venta). Antes se
    // revisan los saldos (solo consulta). El cobro se guarda en la tablet: si
    // la app se recarga a media espera, al abrir se retoma (RecuperarCobroClip).
    let pagoClip = op.pagoClip;
    if (p.terminalClip && !pagoClip) {
      const previo = useCobroClip.getState().cobro;
      if (previo && previo.cobroId !== cobroId) {
        setRecuperarClip(true);
        throw new Error("Hay un cobro con tarjeta anterior sin terminar. Resuélvelo primero.");
      }
      await revisarSaldosAntesDeTerminal(
        { codigo: p.puntosCodigo, phone: puntosTel },
        cashbackUsar,
        regaloUsar,
        regaloIdent,
      );
      const st = useClientePuntos.getState();
      useCobroClip.getState().iniciar({
        cobroId,
        venta: p,
        tarjPend: op.pendientes ? op.pendientes.tarjPend : st.tarjetaPendiente,
        giftPend: op.pendientes ? op.pendientes.giftPend : st.giftPendiente,
      });
      try {
        const montoTarjeta = montoTarjetaDe(p);
        pagoClip = await terminal.cobrar({
          cobroId,
          monto: montoTarjeta,
          montoPago: String(montoTarjeta),
        });
      } catch (e) {
        // Sin pago: no queda nada en curso (el servidor ya cerró el cobro).
        // Si el cajero salió sin red, el cobro sigue guardado para revisarlo.
        if (!(e instanceof CobroSinResolver)) useCobroClip.getState().terminar();
        throw e;
      }
      useCobroClip.getState().avanzar("descuentos", { pagoClip });
    }

    try {
      // Cashback y crédito de regalo juntos: revisar el regalo ANTES del primer
      // débito. Si no alcanza (o venció), el cobro se detiene sin debitar el
      // cashback; antes el cashback quedaba debitado sin venta.
      if (!pagoClip && puntosTel && cashbackUsar > 0 && regaloUsar > 0 && regaloIdent) {
        let saldoRegalo: { saldo: number; vencido: boolean };
        try {
          const res = await fnConsultarSaldoTarjetaRegalo({
            ...(regaloIdent.codigo ? { codigo: regaloIdent.codigo } : {}),
            ...(regaloIdent.phone ? { phone: regaloIdent.phone } : {}),
          });
          saldoRegalo = { saldo: Number(res.data.saldo) || 0, vencido: Boolean(res.data.vencido) };
        } catch {
          throw new DescuentoFallido(
            "No se pudo revisar el crédito de regalo (sin conexión). Quítalo o reintenta.",
            "regalo",
            regaloUsar,
          );
        }
        if (saldoRegalo.vencido) {
          throw new DescuentoFallido("El crédito de regalo venció. Quítalo y reintenta.", "regalo", regaloUsar);
        }
        if (saldoRegalo.saldo < regaloUsar) {
          throw new DescuentoFallido(
            "Crédito de regalo insuficiente. Ajusta el monto y reintenta.",
            "regalo",
            regaloUsar,
          );
        }
      }
      if (puntosTel && cashbackUsar > 0) {
        // Drenar un 'cerrar' encolado de ESTE cliente antes del nuevo canje: un cierre
        // previo que falló dejaría el candado abierto y rechazaría este cobro (409).
        const cerrarPend = useClientePuntos
          .getState()
          .cola.find(
            (x) =>
              x.tipo === "cerrar" &&
              (x.payload as { phone?: string }).phone === puntosTel,
          );
        if (cerrarPend) {
          try {
            await fnCerrarCanje(cerrarPend.payload as unknown as CerrarCanjeInput);
            useClientePuntos.getState().quitarDeCola(cerrarPend.id);
          } catch {
            /* si falla, seguimos; el 409 de abajo lo reporta claro */
          }
        }
        try {
          // Con la tarjeta, o con teléfono + correo (el servidor verifica que
          // sean de ese monedero antes de debitar).
          await fnCanjearPuntos({
            phone: puntosTel,
            ...(p.puntosCodigo ? { codigo: p.puntosCodigo } : { email: p.puntosEmail }),
            money: cashbackUsar,
            idempotencyKey: cobroId,
            pendingLock: true, // activa el candado del servidor (anti doble-débito)
          });
        } catch (e) {
          // Conflicto (otro canje en curso del mismo cliente) → abortar claro; NO crear
          // venta con descuento sin débito. Otro error (red/saldo) → abortar genérico.
          const msg = e instanceof Error ? e.message : "";
          throw new DescuentoFallido(
            codigoErrorPuntos(e) === "permission-denied"
              ? "La tarjeta o el correo no corresponden al cliente. Quita el descuento y vuelve a aplicarlo."
              : msg.includes("canje en curso")
                ? "Ya hay un canje en curso para este cliente. Espera unos minutos y reintenta."
                : "No se pudo usar el cashback (sin conexión o saldo). Quítalo o reintenta.",
            "cashback",
            cashbackUsar,
            clasificarErrorPuntos("canje", e) === "reintentar",
          );
        }
      }

      // Fase 3 — USAR crédito de regalo: se debita EN LÍNEA antes de crear la venta
      // (mismo patrón que el cashback). Candado SEPARADO (regalosPendientes) anti
      // doble-débito. El crédito es un DESCUENTO → NO es ingreso (montoCobro ya lo
      // excluye). Idempotente por cobroId (= ventaId). Si falla, se aborta el cobro.
      if (regaloUsar > 0 && regaloIdent) {
        // Drenar TODOS los 'cerrarRegalo' encolados antes del nuevo débito: un cierre
        // previo fallido dejaría su candado abierto y podría rechazar este cobro con
        // 409. Se cierran todos (no solo el que empata por identificador) porque la
        // MISMA tarjeta puede identificarse por código O por teléfono —canales
        // distintos que resuelven al mismo monedero—, así que un match exacto fallaría.
        // Cada cierre es idempotente (el server solo borra si el cobroId coincide).
        const pendientesCerrar = useClientePuntos
          .getState()
          .cola.filter((x) => x.tipo === "cerrarRegalo");
        for (const pc of pendientesCerrar) {
          try {
            await fnCerrarCreditoRegalo(pc.payload as unknown as CerrarCreditoRegaloInput);
            useClientePuntos.getState().quitarDeCola(pc.id);
          } catch {
            /* si falla, seguimos; el 409 de abajo lo reporta si aplica */
          }
        }
        try {
          // Con la tarjeta, o con teléfono + correo (el servidor verifica que el
          // correo sea de ese monedero).
          await fnRedimirCreditoRegalo({
            codigo: regaloIdent.codigo,
            phone: regaloIdent.phone,
            ...(regaloIdent.codigo ? {} : { email: regaloIdent.email }),
            money: regaloUsar,
            idempotencyKey: cobroId,
            pendingLock: true,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          throw new DescuentoFallido(
            codigoErrorPuntos(e) === "permission-denied"
              ? "La tarjeta o el correo no corresponden al cliente. Quita el crédito y vuelve a aplicarlo."
              : msg.includes("en curso")
              ? "Ya hay un uso de crédito en curso para esta tarjeta. Espera unos minutos y reintenta."
              : msg.includes("vencido")
              ? "El crédito de regalo venció. Quítalo y reintenta."
              : msg.includes("insuficiente")
              ? "Crédito de regalo insuficiente. Ajusta el monto y reintenta."
              : msg.includes("no encontrad")
              ? "Tarjeta o monedero no encontrado. Verifica el código."
              : "No se pudo usar el crédito de regalo (sin conexión). Quítalo o reintenta.",
            "regalo",
            regaloUsar,
            clasificarErrorPuntos("canje", e) === "reintentar",
          );
        }
      }
    } catch (e) {
      // Con la tarjeta ya cobrada, un descuento que falla no aborta la venta:
      // se reintenta (los débitos son idempotentes por cobroId) o la diferencia
      // se cobra en efectivo. Nunca se guarda un descuento sin débito.
      if (!pagoClip || !(e instanceof DescuentoFallido)) throw e;
      const tarjeta = etiquetaTarjetaClip(pagoClip);
      const decision = await terminal.preguntarDescuento({
        monto: montoTarjetaDe(p),
        tarjeta,
        quitar: e.quitar,
        descuento: e.monto,
        // Solo el motivo: el consejo del mensaje ("Quítalo o reintenta") es
        // para la vista previa; aquí la pantalla dice qué hacer.
        mensaje: `${e.message.split(". ")[0].replace(/\.$/, "")}.`,
        incierto: e.incierto,
      });
      const siguiente =
        decision === "efectivo" ? ventaSinDescuentoConEfectivo(p, e.quitar) : p;
      if (decision === "efectivo") {
        // El candado del débito que falló se cierra (idempotente por cobroId);
        // si no, ese cliente no podría usar su saldo hasta que venza.
        const { encolar } = useClientePuntos.getState();
        if (e.quitar === "cashback" && puntosTel) {
          encolar("cerrar", { phone: puntosTel, cobroId });
        }
        if (e.quitar === "regalo" && regaloIdent) {
          encolar("cerrarRegalo", {
            ...(regaloIdent.codigo ? { codigo: regaloIdent.codigo } : {}),
            ...(regaloIdent.phone ? { phone: regaloIdent.phone } : {}),
            cobroId,
          });
        }
        useCobroClip.getState().avanzar("descuentos", { venta: siguiente });
      }
      terminal.guardando(montoTarjetaDe(p), tarjeta);
      return ejecutarVenta(siguiente, { ...op, pagoClip });
    }

    if (pagoClip) {
      useCobroClip.getState().avanzar("guardando");
      terminal.guardando(montoTarjetaDe(p), etiquetaTarjetaClip(pagoClip));
    }
    const result = await crearVenta({
      negocioId,
      sucursalId,
      nodoId,
      ...p,
      idempotencyKey: cobroId, // venta ligada al MISMO id del débito
      ...(pagoClip ? { pagoClip } : {}),
      ...(op.sinOffline ? { permitirOffline: false } : {}),
    });
    retomadoRef.current = null;

    // SNAPSHOT de los pendientes ANTES de limpiar() (que dispara el effect de
    // higiene cart-empty → borra tarjetaPendiente/giftPendiente de forma ASÍNCRONA).
    // Sin esto, el bloque de emisión de gift —que corre DESPUÉS del await de la
    // vinculación de la tarjeta de lealtad— podía leer giftPendiente ya en null:
    // la gift quedaba cobrada pero NUNCA emitida (pérdida silenciosa). Capturados
    // aquí (carrito aún NO vaciado), la decisión es inmune a esa carrera de timing.
    // Una venta retomada tras recargar trae los suyos guardados con el cobro.
    const tarjPend = op.pendientes
      ? op.pendientes.tarjPend
      : useClientePuntos.getState().tarjetaPendiente;
    const giftPend = op.pendientes
      ? op.pendientes.giftPend
      : useClientePuntos.getState().giftPendiente;
    const giftLine = (result.venta.articulos ?? []).find((a) => a.giftCard === true);
    // Total cobrado por líneas gift: base a EXCLUIR del cashback ganado (§0.3).
    const giftTotal = (result.venta.articulos ?? [])
      .filter((a) => a.giftCard === true)
      .reduce((s, a) => s + subtotalItem(a), 0);
    // Monto de la gift = lo REALMENTE cobrado por su línea (crédito == dinero
    // recibido, sin importar edición).
    const giftMonto = giftLine ? subtotalItem(giftLine) : 0;
    // "Vinculado ⟺ pagado": solo vincular si el ARTÍCULO de la tarjeta realmente
    // se cobró en ESTA venta. Blinda contra un pendiente arrastrado (carrito
    // cancelado/vaciado sin cobrar) que vincularía la tarjeta sin haberse pagado.
    const tarjetaCobrada = (result.venta.articulos ?? []).some(
      (a) => a.id === CARD_ARTICLE_ID,
    );

    // Todo lo que se debe por esta venta (ligar tarjeta, emitir o recargar
    // regalo, acumular cashback) se ANOTA EN LA COLA AQUÍ, antes de cualquier
    // await: si la app se recarga o se cierra a media llamada, la cola lo envía
    // después. Todo es idempotente (por ventaId o tarjeta+monedero), así que
    // repetirlo no duplica. Antes se borraba el pendiente y se llamaba, y solo
    // se encolaba ante 'unavailable'; una red caída llega como 'internal' y la
    // gift quedaba cobrada sin emitir. Los pendientes se limpian siempre: uno
    // cuya línea no se cobró se descarta sin vincular/emitir.
    const { encolar } = useClientePuntos.getState();
    const anotar = { ventaPath: result.path };
    const anotarEnCurso = result.offline
      ? anotar
      : { ...anotar, enCursoHasta: Date.now() + 90_000 };
    if (tarjPend) useClientePuntos.getState().limpiarTarjetaPendiente();
    if (giftPend) useClientePuntos.getState().limpiarGiftPendiente();
    const idCard =
      tarjPend && tarjPend.telefono && tarjPend.codigo && tarjetaCobrada
        ? encolar(
            "card",
            {
              modo: tarjPend.codigoAnterior ? "reponer" : "activar",
              phone: tarjPend.telefono,
              ...(tarjPend.correo ? { email: tarjPend.correo } : {}),
              codigo: tarjPend.codigo,
              ...(tarjPend.codigoAnterior ? { codigoAnterior: tarjPend.codigoAnterior } : {}),
              ventaId: result.venta.ventaId,
            },
            anotarEnCurso,
          )
        : null;
    const idGift =
      giftPend && giftLine && giftPend.modo === "emitir"
        ? encolar(
            "gift",
            {
              email: giftPend.email,
              phone: giftPend.phone,
              nombre: giftPend.nombre,
              barcode: giftPend.barcode,
              denominacion: giftMonto,
              ventaId: result.venta.ventaId,
            },
            anotarEnCurso,
          )
        : null;
    const idRecarga =
      giftPend && giftLine && giftPend.modo === "recargar"
        ? encolar(
            "giftRecarga",
            {
              email: giftPend.email,
              phone: giftPend.phone,
              codigo: giftPend.codigo,
              amount: giftMonto,
              ventaId: result.venta.ventaId,
            },
            anotarEnCurso,
          )
        : null;
    // PT-10: se ACREDITA sobre lo pagado (montoCobro neto), EXCLUYENDO la
    // denominación de gift cards: adquirir una NO genera cashback.
    const idEarn = puntosTel
      ? encolar(
          "earn",
          {
            phone: puntosTel,
            amount: Math.max(0, (Number(monto) || 0) - giftTotal),
            ventaId: result.venta.ventaId,
            sucursalId,
            nodoId,
          },
          anotarEnCurso,
        )
      : null;
    // Venta guardada y lo que se debe ya anotado: el cobro con terminal
    // terminó y no queda nada que retomar al abrir.
    if (pagoClip) useCobroClip.getState().terminar();

    // Fase 5: canje debitado y venta creada → cerrar el pendiente (idempotente).
    // Best-effort + encolado durable.
    if (puntosTel && cashbackUsar > 0) {
      try {
        await fnCerrarCanje({ phone: puntosTel, cobroId });
      } catch {
        useClientePuntos
          .getState()
          .encolar("cerrar", { phone: puntosTel, cobroId });
      }
    }
    // Fase 3 — cerrar el candado del crédito de regalo (idempotente). Best-effort
    // + encolado durable ('cerrarRegalo') si falla la red.
    if (regaloUsar > 0 && regaloIdent) {
      const cerrarPayload = {
        ...(regaloIdent.codigo ? { codigo: regaloIdent.codigo } : {}),
        ...(regaloIdent.phone ? { phone: regaloIdent.phone } : {}),
        cobroId,
      };
      try {
        await fnCerrarCreditoRegalo(cerrarPayload);
      } catch {
        useClientePuntos.getState().encolar("cerrarRegalo", cerrarPayload);
      }
    }
    limpiar();
    setPreview(null);
    if (result.offline) {
      setToast(
        `Venta OFFLINE (${result.venta.numeroDeVenta}). Se reconcilia al reconectar.`,
      );
      window.setTimeout(() => setToast(null), 4000);
    }

    // Envío inmediato de lo anotado (con red). Si falla, el ítem sigue en la cola
    // (red caída: se reintenta solo) o pasa a fallidos (rechazo: queda a la
    // vista en "Por enviar"); la venta YA existe y nunca se revierte.
    // Los avisos se juntan y salen con el mensaje final de la venta (antes el
    // de cashback o el del ticket pisaba un "Tarjeta NO vinculada").
    avisosVentaRef.current = [];
    const avisar = (msg: string) => {
      avisosVentaRef.current.push(msg);
    };
    if (result.offline) {
      if (idCard || idGift || idRecarga) {
        avisar("Sin conexión: tarjeta y regalo se aplicarán solos al reconectar. La venta sí se cobró.");
      }
    } else {
      if (idCard) {
        const r = await enviarPuntosAhora(idCard);
        if (!r.ok) {
          avisar(
            r.clase === "reintentar"
              ? "La tarjeta se vinculará sola al reconectar. La venta sí se cobró."
              : `Tarjeta NO vinculada (${r.mensaje}). Quedó en "Por enviar". La venta sí se cobró.`,
          );
        }
      }
      if (idGift) {
        const r = await enviarPuntosAhora(idGift);
        if (r.ok) {
          const d = r.data as EmitirTarjetaRegaloOutput;
          setGiftEmitida({
            balance: Number(d.balance) || giftMonto,
            accessCode: d.accessCode ?? null,
            cardLinked: Boolean(d.cardLinked),
          });
        } else {
          avisar(
            r.clase === "reintentar"
              ? "La tarjeta de regalo se activará sola al reconectar. La venta sí se cobró."
              : `Tarjeta de regalo NO activada (${r.mensaje}). Quedó en "Por enviar". La venta sí se cobró.`,
          );
        }
      }
      if (idRecarga) {
        const r = await enviarPuntosAhora(idRecarga);
        if (r.ok) {
          const bal = Number((r.data as RecargarTarjetaRegaloOutput).balance) || 0;
          avisar(`Recarga aplicada. Nuevo saldo de crédito: $${bal.toLocaleString("es-MX")}.`);
        } else {
          avisar(
            r.clase === "reintentar"
              ? "La recarga se aplicará sola al reconectar. La venta sí se cobró."
              : `Recarga NO aplicada (${r.mensaje}). Quedó en "Por enviar". La venta sí se cobró.`,
          );
        }
      }
    }

    // PT-10: cliente EXISTENTE. El canje (débito) ya ocurrió en línea arriba; aquí
    // se ACREDITA (anotado arriba en la cola). Esperamos la respuesta para el
    // ticket; si falla, la cola la reintenta — la venta NO se bloquea.
    if (idEarn) {
      let ventaFinal: Venta =
        descPuntos && Number(descPuntos) > 0
          ? { ...result.venta, descuentoPuntos: descPuntos }
          : result.venta;
      let puntosMsg = "Cashback: se acreditará al reconectar.";
      const r = result.offline ? null : await enviarPuntosAhora(idEarn);
      if (r && !r.ok && r.clase !== "reintentar") {
        puntosMsg = `Cashback NO acreditado (${r.mensaje}). Quedó en "Por enviar".`;
      }
      if (r && r.ok) {
        const res = { data: r.data as AcreditarPuntosOutput };
        const added = Number(res.data.added) || 0; // cashback $ acumulado
        const balance = Number(res.data.balance) || 0; // saldo $ resultante
        if (added > 0) {
          ventaFinal = {
            ...ventaFinal,
            puntosGanados: added.toFixed(2),
            puntosSaldoDinero: balance.toFixed(2)
          };
          puntosMsg = `Acumuló $${added.toFixed(2)} de cashback · saldo $${balance.toFixed(2)}`;
          // Persistir en la venta para auditoría en admin-web. Best-effort.
          void updateDoc(doc(db, result.path), {
            puntosGanados: added.toFixed(2),
            puntosSaldoDinero: balance.toFixed(2)
          }).catch(() => {});
        } else if (res.data.already) {
          puntosMsg = "Cashback ya acreditado (reintento).";
        } else {
          puntosMsg = "Sin cashback en esta venta (monto mínimo no alcanzado).";
        }
      }
      // El cliente de la venta es el que está en espera (mismo teléfono): se le
      // imprime su contraseña temporal y sale de la espera.
      const pendTel = useClientePuntos.getState().pendiente;
      if (
        pendTel &&
        pendienteVigente(pendTel, Date.now()) &&
        telefonosIguales(pendTel.telefono, puntosTel)
      ) {
        ventaFinal = { ...ventaFinal, codigoPuntos: pendTel.code };
        void updateDoc(doc(db, result.path), { puntosClienteEmail: pendTel.correo }).catch(
          () => {},
        );
        useClientePuntos.getState().limpiarPendiente();
      }
      finalizarVenta(ventaFinal, puntosMsg);
      return;
    }

    // Cliente pre-registrado en espera: vence a la hora (antes se quedaba
    // pegado). Si en esta venta se cobró SU tarjeta, es él: se acumula sin
    // preguntar. Si no, se pregunta ANTES del ticket.
    const pend = useClientePuntos.getState().pendiente;
    if (pend && !pendienteVigente(pend, Date.now())) {
      useClientePuntos.getState().limpiarPendiente();
    } else if (pend) {
      const sel = { venta: result.venta, monto, path: result.path };
      if (tarjetaCobrada && tarjPend && telefonosIguales(tarjPend.telefono, pend.telefono)) {
        await vincularPendiente(sel, pend);
        return;
      }
      setVentaParaVincular(sel);
      setVinculacionOpen(true);
      return;
    }
    finalizarVenta(result.venta);
  }

  // Cobro con terminal a medias al abrir la caja (ver RecuperarCobroClip).
  // Nada se cobra dos veces: seguir el cobro reusa el mismo (idempotente por
  // cobroId) y terminar la venta usa el pago ya aprobado.
  async function accionRecuperarClip(accion: AccionRecuperar, cobro: CobroClip | null) {
    const r = useCobroClip.getState().cobro;
    setRecuperarClip(false);
    if (!r) return;
    const pendientes = { tarjPend: r.tarjPend, giftPend: r.giftPend };
    if (accion === "retomar") {
      // No se cobró nada: la venta vuelve a la vista previa para confirmarla.
      useCobroClip.getState().terminar();
      retomadoRef.current = { cobroId: r.cobroId, pendientes };
      setPreview(r.venta);
      return;
    }
    if (accion === "mas-tarde") return; // sigue guardado: se pregunta al volver a abrir
    if (accion === "descartar" || accion === "revisar") {
      useCobroClip.getState().terminar();
      return;
    }
    const pagoClip =
      accion === "terminar-venta"
        ? (r.pagoClip ??
          (cobro
            ? cobro.estado === "manual"
              ? pagoClipManual(r.cobroId)
              : pagoClipDeCobro(cobro)
            : undefined))
        : undefined;
    if (accion === "terminar-venta") {
      if (!pagoClip) {
        setToast("No se encontró el cobro aprobado de esta venta. Revísalo en Clip.");
        window.setTimeout(() => setToast(null), 6000);
        return;
      }
      // Queda guardado con el registro: si guardar la venta falla, el siguiente
      // intento no vuelve a la terminal.
      useCobroClip
        .getState()
        .avanzar(r.fase === "terminal" ? "descuentos" : r.fase, { pagoClip });
    }
    try {
      await confirmarVenta(
        r.venta,
        accion === "terminar-venta" ? { pendientes, pagoClip, sinOffline: true } : { pendientes },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(accion === "terminar-venta" ? `No se pudo guardar la venta: ${msg}` : msg);
      window.setTimeout(() => setToast(null), 6000);
      // Sigue pendiente (p. ej. sin red al guardar): se vuelve a ofrecer.
      if (useCobroClip.getState().cobro) setRecuperarClip(true);
    }
  }

  // Pre-registro de cliente (FAB). Devuelve el error para el modal, o null si
  // quedó registrado (o anotado para cuando vuelva la red: la contraseña
  // temporal se genera aquí, así sirve aunque no haya conexión).
  async function handlePreRegistrar(data: PreRegistroData): Promise<string | null> {
    // La tarjeta se valida ANTES de registrar (dígito verificador y que no esté
    // en uso): no se cobra una tarjeta que luego no se puede ligar.
    const art = data.cardBarcode ? articulosById.get(CARD_ARTICLE_ID) : undefined;
    if (data.cardBarcode) {
      if (!ean13Ok(data.cardBarcode)) return "Código de tarjeta inválido (dígito verificador).";
      if (!art) return "No se encontró el artículo de la tarjeta. Avisa al admin.";
      try {
        const chk = await fnConsultarSaldoPuntos({ codigo: data.cardBarcode });
        if (chk.data.exists) return "Esa tarjeta ya está en uso.";
      } catch {
        return "No se pudo validar la tarjeta (sin conexión). Regístralo sin tarjeta o reintenta.";
      }
    }
    const code = generarCodigoPuntos();
    const payload = { email: data.correo, phone: data.telefono, nombre: data.nombre, code };
    // Anotado antes de llamar (vale dinero: sin registro no hay cashback). Con
    // red se espera la respuesta: un "ya existe" se dice aquí y no deja al
    // cliente en espera con una contraseña que no sirve.
    const idRegistro = useClientePuntos.getState().encolar("register", payload, {
      enCursoHasta: Date.now() + 90_000,
    });
    const r = await enviarPuntosAhora(idRegistro);
    if (!r.ok && r.clase !== "reintentar") {
      useClientePuntos.getState().quitarFallido(idRegistro);
      return r.clase === "hecho"
        ? "Ya existe un cliente con ese correo o teléfono. Búscalo por teléfono en Cashback."
        : `No se pudo registrar: ${r.mensaje}`;
    }
    useClientePuntos.getState().setPendiente({
      correo: data.correo,
      telefono: data.telefono,
      nombre: data.nombre,
      code,
    });
    // F5: si adquirió tarjeta al registrarse, agregar el ARTÍCULO al carrito y dejar
    // el barcode PENDIENTE de vincular al cobrar (pagó → se vincula, como F4).
    let msgTarjeta = "";
    if (data.cardBarcode && art) {
      agregar(art);
      useClientePuntos.getState().setTarjetaPendiente({
        codigo: data.cardBarcode,
        telefono: data.telefono,
        correo: data.correo,
      });
      msgTarjeta = " + tarjeta agregada";
    }
    setToast(
      r.ok
        ? `Cliente registrado${msgTarjeta}. Código: ${code}`
        : `Registrado sin conexión (se sincroniza)${msgTarjeta}. Código: ${code}`,
    );
    window.setTimeout(() => setToast(null), 6000);
    return null;
  }

  // Vender tarjeta de regalo (FAB): agrega la denominación como línea de venta
  // (ingreso, sin inventario) y deja la emisión PENDIENTE. "Pagó → se emite": al
  // cobrar se carga el crédito. La denominación que se carga la da la línea gift
  // de la venta (money-safety), no este pendiente.
  function handleVenderRegalo(data: VenderRegaloData) {
    useCarrito.getState().agregarGiftCard({
      nombre: `Tarjeta de regalo $${data.denominacion}`,
      monto: String(data.denominacion),
    });
    useClientePuntos.getState().setGiftPendiente({
      modo: "emitir",
      email: data.email,
      phone: data.phone,
      nombre: data.nombre,
      barcode: data.barcode,
    });
    setToast(`Tarjeta de regalo $${data.denominacion} agregada al cobro.`);
    window.setTimeout(() => setToast(null), 4000);
  }

  // Recargar tarjeta de regalo existente (FAB): agrega el monto como línea de
  // venta (ingreso, sin inventario) y deja la RECARGA pendiente. "Pagó → se
  // recarga": al cobrar se suma el crédito y se reinicia la vigencia +6m. El monto
  // real que se recarga lo da la línea gift de la venta (money-safety).
  function handleRecargarRegalo(data: RecargarRegaloData) {
    useCarrito.getState().agregarGiftCard({
      nombre: `Recarga tarjeta de regalo $${data.monto}`,
      monto: String(data.monto),
    });
    useClientePuntos.getState().setGiftPendiente({
      modo: "recargar",
      codigo: data.codigo,
      phone: data.phone,
    });
    setToast(`Recarga de $${data.monto} agregada al cobro.`);
    window.setTimeout(() => setToast(null), 4000);
  }

  // Consulta el saldo de una tarjeta de regalo (para el modal de recarga, antes de
  // cobrar). Devuelve null si falla la red → el modal avisa y bloquea la recarga.
  async function handleLookupRegalo(id: { codigo?: string; phone?: string }) {
    try {
      const res = await fnConsultarSaldoTarjetaRegalo(id);
      return {
        saldo: Number(res.data.saldo) || 0,
        expiraAt: res.data.expiraAt ?? null,
        vencido: Boolean(res.data.vencido),
      };
    } catch {
      return null;
    }
  }

  // Acreditar el cashback de la venta al cliente en espera + imprimir el ticket
  // con su contraseña temporal + sacarlo de la espera.
  async function vincularPendiente(
    sel: { venta: Venta; monto: string; path: string },
    pend: ClientePendiente,
  ) {
    if (!sucursalId || !nodoId) {
      finalizarVenta(sel.venta);
      return;
    }
    let venta: Venta = { ...sel.venta, codigoPuntos: pend.code };
    // Excluir la denominación de gift cards del cashback ganado (§0.3).
    const giftTotalV = (sel.venta.articulos ?? [])
      .filter((a) => a.giftCard === true)
      .reduce((s, a) => s + subtotalItem(a), 0);
    const payload = {
      email: pend.correo,
      phone: pend.telefono,
      amount: Math.max(0, (Number(sel.monto) || 0) - giftTotalV),
      ventaId: sel.venta.ventaId,
      sucursalId,
      nodoId,
    };
    // Se anota en la cola y se envía; esperamos la respuesta para el ticket. Si
    // falla (o espera el registro del cliente), la cola lo reintenta: no bloquea
    // el ticket con la contraseña temporal.
    const idEarn = useClientePuntos.getState().encolar("earn", payload, {
      ventaPath: sel.path,
      enCursoHasta: Date.now() + 90_000,
    });
    let puntosMsg = "Cashback: se acreditará al reconectar.";
    const r = await enviarPuntosAhora(idEarn);
    if (r.ok) {
      const res = { data: r.data as AcreditarPuntosOutput };
      const added = Number(res.data.added) || 0; // cashback $ acumulado
      const balance = Number(res.data.balance) || 0; // saldo $ resultante
      puntosMsg = "";
      if (added > 0) {
        venta = {
          ...venta,
          puntosGanados: added.toFixed(2),
          puntosSaldoDinero: balance.toFixed(2)
        };
        puntosMsg = `Acumuló $${added.toFixed(2)} de cashback · saldo $${balance.toFixed(2)}`;
      } else if (res.data.already) {
        puntosMsg = "Cashback ya acreditado (reintento).";
      }
    } else if (r.clase !== "reintentar") {
      puntosMsg = `Cashback NO acreditado (${r.mensaje}). Quedó en "Por enviar".`;
    }
    // Auditoría en la venta: correo/teléfono (NO la contraseña, es credencial)
    // + puntos ganados. Best-effort, no bloquea.
    void updateDoc(doc(db, sel.path), {
      puntosClienteEmail: pend.correo,
      puntosClienteTelefono: pend.telefono,
      ...(venta.puntosGanados
        ? {
            puntosGanados: venta.puntosGanados,
            puntosSaldoDinero: venta.puntosSaldoDinero
          }
        : {})
    }).catch(() => {});
    useClientePuntos.getState().limpiarPendiente();
    finalizarVenta(venta, puntosMsg);
  }

  // "Sí": acreditar esta venta al cliente en espera.
  async function handleVincularSi() {
    const sel = ventaParaVincular;
    const pend = useClientePuntos.getState().pendiente;
    setVinculacionOpen(false);
    setVentaParaVincular(null);
    if (!sel) return;
    if (!pend) {
      finalizarVenta(sel.venta);
      return;
    }
    await vincularPendiente(sel, pend);
  }

  // "No": no acreditar esta venta; el pendiente se mantiene para la correcta.
  function handleVincularNo() {
    const sel = ventaParaVincular;
    setVinculacionOpen(false);
    setVentaParaVincular(null);
    if (sel) finalizarVenta(sel.venta);
  }

  // "Quitar pre-registro": sale de la espera; esta venta sigue sin cashback.
  function handleVincularQuitar() {
    const sel = ventaParaVincular;
    useClientePuntos.getState().limpiarPendiente();
    setVinculacionOpen(false);
    setVentaParaVincular(null);
    if (sel) finalizarVenta(sel.venta);
  }

  function handleReimprimir() {
    if (!ultimaVenta) return;
    const printed = imprimirTicketNativo(ultimaVenta);
    if (!printed) {
      // Fallback web/PDF cuando la APK no está disponible.
      setTicketModalOpen(true);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="relative flex h-14 shrink-0 items-center gap-1 overflow-hidden border-b bg-card px-2.5 min-[1000px]:gap-1.5 min-[1000px]:px-3">
        {/* Capa de imagen de cabecera con opacidad ajustable. Va detrás del
            contenido. Si no hay cabecera elegida, no se renderiza. */}
        {cabecera.src && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${cabecera.src})`,
              opacity: cabeceraOpacidad,
            }}
            aria-hidden
          />
        )}
        <div className="relative z-10 flex min-w-0 shrink items-center gap-2.5">
          {logo.src ? (
            <img
              src={logo.src}
              alt="Amise"
              className="h-6 max-w-full object-contain min-[1000px]:h-7"
              draggable={false}
            />
          ) : (
            <span className="truncate text-sm font-semibold">Amise</span>
          )}
          {nombreCaja && (
            <span className="hidden truncate text-[13px] text-muted-foreground min-[1000px]:block">
              {nombreCaja}
            </span>
          )}
        </div>
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 min-[1000px]:gap-1.5">
          <SelectorVendedor />
          <BotonCabecera
            icono={ListOrdered}
            etiqueta="Registros"
            onClick={() => setPinOpen(true)}
          />
          <BotonCabecera
            icono={Bookmark}
            etiqueta="Apartados"
            onClick={() => setApartadosOpen(true)}
          />
          <BotonCabecera
            icono={Truck}
            etiqueta="Resurtidos"
            onClick={() => navigate("/resurtidos")}
            badge={resurtidosPendientes}
          />
          {/* Solo aparece si hay cashback/tarjetas/regalos sin enviar. */}
          <ColaPuntosAviso />
          <BotonCorte abierto={!!corte} onClick={() => setCorteOpen(true)} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/ajustes")}
            aria-label="Ajustes"
            className="h-11 w-11"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Cuerpo principal — wrapper con imagen de fondo. La imagen va en
          una capa absoluta detrás de todo el contenido; lo demás va en
          tarjetas encima. Acostada: lista a la izquierda y cobro a la
          derecha; parada (menos de 860 px), el cobro va abajo. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {fondo.src && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${fondo.src})`,
              opacity: fondoOpacidad,
            }}
            aria-hidden
          />
        )}

        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5 p-2.5 min-[860px]:flex-row min-[860px]:gap-3 min-[860px]:p-3">
          <section
            aria-label="Venta"
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5"
          >
            {/* z-30 para que el desplegable de sugerencias quede encima de
                la lista. */}
            <div className="relative z-30">
              <BuscadorArticulo
                ref={buscadorRef}
                onPedirVariacion={setVarPickerPadre}
                onPedirSena={setSenaPadre}
              />
            </div>

            <CarritoPanel />

            <BarraAcciones>
              <BotonAccion
                icono={Printer}
                etiqueta="Reimprimir"
                onClick={handleReimprimir}
                disabled={!ultimaVenta}
                ariaLabel={
                  ultimaVenta
                    ? `Reimprimir ticket #${ultimaVenta.numeroDeVenta ?? ""}`.trim()
                    : "Sin ventas para reimprimir"
                }
              />
              <BotonAccion
                icono={PackagePlus}
                etiqueta="No registrado"
                onClick={() => setNoRegOpen(true)}
                ariaLabel="Vender artículo no registrado"
              />
              <BotonAccion
                icono={BookmarkPlus}
                etiqueta="Apartar"
                onClick={() => setApartarOpen(true)}
                ariaLabel="Crear apartado"
              />
              <MenuPuntosRegalo
                onPreRegistro={() => setPreRegOpen(true)}
                onVenderRegalo={() => setGiftOpen(true)}
                onRecargarRegalo={() => setRecargaOpen(true)}
                pendienteCorreo={pendientePuntos?.correo ?? null}
                onQuitarPendiente={() => {
                  useClientePuntos.getState().limpiarPendiente();
                  setToast("Se quitó al cliente en espera.");
                  window.setTimeout(() => setToast(null), 3000);
                }}
              />
              <BotonAccion
                icono={MessageSquare}
                etiqueta="Chat"
                onClick={() => setChatOpen(true)}
                // Mientras el chat está abierto, el badge se oculta (los
                // mensajes se están viendo en vivo). marcarApertura ya marca
                // leídos al abrir, así que cerrar dejará noLeidos en 0 hasta
                // que llegue un mensaje nuevo.
                badge={chatOpen ? 0 : chatData.noLeidos}
                ariaLabel="Abrir chat"
              />
            </BarraAcciones>
          </section>

          <PagoFooter
            resetSignal={resetPuntosSignal}
            onCobrar={(data) =>
              setPreview({ ...data, idempotencyKey: generarID() })
            }
          />
        </div>
      </div>

      <ConfirmarVentaModal
        data={preview}
        onCancel={() => {
          setPreview(null);
          setResetPuntosSignal((n) => n + 1);
          retomadoRef.current = null;
        }}
        onConfirm={() => confirmarVenta()}
      />

      {procesando && (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/70"
          role="alert"
          aria-busy
        >
          <div className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="text-sm font-semibold text-white">Procesando venta…</p>
        </div>
      )}

      <CobroClipOverlay terminal={terminal} />
      {recuperarClip && registroClip && !procesando && (
        <RecuperarCobroClip registro={registroClip} onAccion={accionRecuperarClip} />
      )}

      <PreRegistroClienteModal
        open={preRegOpen}
        onClose={() => setPreRegOpen(false)}
        onRegistrar={handlePreRegistrar}
        pendienteCorreo={pendientePuntos?.correo ?? null}
      />
      <VenderRegaloModal
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        onVender={handleVenderRegalo}
      />
      <RecargarRegaloModal
        open={recargaOpen}
        onClose={() => setRecargaOpen(false)}
        onLookup={handleLookupRegalo}
        onRecargar={handleRecargarRegalo}
      />
      <GiftEmitidaModal info={giftEmitida} onClose={() => setGiftEmitida(null)} />
      <VinculacionClienteModal
        open={vinculacionOpen}
        cliente={pendientePuntos}
        onSi={handleVincularSi}
        onNo={handleVincularNo}
        onQuitar={handleVincularQuitar}
      />

      <VentaRealizadaOverlay
        show={overlayShow}
        onDone={() => setOverlayShow(false)}
      />

      <NoRegistradoModal open={noRegOpen} onClose={() => setNoRegOpen(false)} />
      <ConfirmarSalidaModal
        open={salidaOpen}
        onCancel={() => setSalidaOpen(false)}
      />
      <VariacionPickerModal
        padre={varPickerPadre}
        onClose={() => {
          setVarPickerPadre(null);
          buscadorRef.current?.focus();
        }}
        onSelect={(padre, sv) => {
          const imagenUrl = sv.imagenUrl ?? padre.imagenUrl;
          agregar(padre, {
            ...(sv.codigo ? { subvariacionCodigo: sv.codigo } : {}),
            subvariacionNombre: sv.nombre,
            ...(imagenUrl ? { imagenUrl } : {}),
          });
          setVarPickerPadre(null);
          buscadorRef.current?.focus();
        }}
        onSelectOtro={(padre, nombre) => {
          const imagenUrl = padre.imagenUrl;
          agregar(padre, {
            // Variación libre: el item carga el texto del cajero como
            // subvariacionNombre y el flag variacionLibre=true para que
            // admin-web pueda distinguirlo en reportes. No hay
            // subvariacionCodigo (no está en catálogo).
            variacionLibre: true,
            subvariacionNombre: nombre,
            ...(imagenUrl ? { imagenUrl } : {}),
          });
          setVarPickerPadre(null);
          buscadorRef.current?.focus();
        }}
      />
      <SenaPickerModal
        padre={senaPadre}
        onClose={() => {
          setSenaPadre(null);
          buscadorRef.current?.focus();
        }}
        onConfirm={(padre, descripcion) => {
          const imagenUrl = padre.imagenUrl;
          agregar(padre, {
            seña: descripcion,
            ...(imagenUrl ? { imagenUrl } : {}),
          });
          setSenaPadre(null);
          buscadorRef.current?.focus();
        }}
      />
      <TicketModal
        venta={ticketModalOpen ? ultimaVenta : null}
        onClose={() => setTicketModalOpen(false)}
      />
      <CorteModal open={corteOpen} onClose={() => setCorteOpen(false)} />
      <ChatGrupoModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        data={chatData}
      />
      <ApartadoModal
        open={apartarOpen}
        onClose={() => setApartarOpen(false)}
        onSuccess={(id) => {
          setToast(`Apartado creado (${id.slice(0, 10)}…)`);
          window.setTimeout(() => setToast(null), 4000);
        }}
      />
      <ApartadosSheet
        open={apartadosOpen}
        onClose={() => setApartadosOpen(false)}
      />
      <RegistrosVentasSheet
        open={registrosOpen}
        onClose={() => setRegistrosOpen(false)}
      />
      <PinPromptModal
        open={pinOpen}
        pinCorrecto={pinRegistros}
        onClose={() => setPinOpen(false)}
        onSuccess={() => {
          setPinOpen(false);
          setRegistrosOpen(true);
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-32 left-1/2 z-40 w-[min(90vw,28rem)] -translate-x-1/2 rounded-md bg-primary px-4 py-3 text-center text-sm text-primary-foreground shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

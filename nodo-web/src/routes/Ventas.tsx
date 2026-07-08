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
import { FloatingChatButton } from "@/features/chat-grupo/FloatingChatButton";
import { FloatingApartarButton } from "@/features/apartados/FloatingApartarButton";
import { FloatingNoRegistradoButton } from "@/features/ventas/FloatingNoRegistradoButton";
import { FloatingReimprimirButton } from "@/features/ventas/FloatingReimprimirButton";
import { RegistrosVentasSheet } from "@/features/ventas/historial/RegistrosVentasSheet";
import { PinPromptModal } from "@/features/ventas/historial/PinPromptModal";
import { usePinVentas } from "@/features/ventas/historial/usePinVentas";
import { useCarrito } from "@/features/ventas/carritoStore";
import { useArticulos } from "@/features/articulos/useArticulos";
import { crearVenta } from "@/features/ventas/ventaService";
import { generarID } from "@shared";
import { formatearTicketEscPos } from "@/features/ventas/ticketEscPos";
import { posDisponible, imprimirTicket } from "@/lib/pos-bridge";
import { useBackHandler } from "@/lib/back-handler";
import { useApariencia } from "@/features/apariencia/useApariencia";
import { Bookmark, ListOrdered, Settings, Truck } from "lucide-react";
import { useResurtidosPendientesCount } from "@/features/resurtidos/useResurtidosPendientesCount";
import type { Articulo, Venta } from "@shared";
import { FloatingPreRegistroButton } from "@/features/puntos/FloatingPreRegistroButton";
import {
  PreRegistroClienteModal,
  type PreRegistroData,
} from "@/features/puntos/PreRegistroClienteModal";
import { VinculacionClienteModal } from "@/features/puntos/VinculacionClienteModal";
import { useClientePuntos } from "@/features/puntos/clientePuntosStore";
import { usePuntosColaFlush } from "@/features/puntos/usePuntosColaFlush";
import { generarCodigoPuntos } from "@/features/puntos/codigoPuntos";
import { CARD_ARTICLE_ID } from "@/features/puntos/tarjeta";
import {
  fnRegistrarClientePuntos,
  fnAcreditarPuntos,
  fnCanjearPuntos,
  fnCerrarCanje,
  fnActivarTarjeta,
  fnReponerTarjeta,
  type CerrarCanjeInput,
} from "@/firebase/callable";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export function Ventas() {
  const navigate = useNavigate();
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const { sucursal } = useSucursal();
  const { corte } = useCorteActivo();
  const { limpiar, enTurno, items, agregar } = useCarrito();
  const { byId: articulosById } = useArticulos();
  const { fondo, fondoOpacidad, cabecera, cabeceraOpacidad, logo } =
    useApariencia();
  const resurtidosPendientes = useResurtidosPendientesCount();
  usePuntosColaFlush();
  const pendientePuntos = useClientePuntos((s) => s.pendiente);
  const sinVendedor = !enTurno;
  const carritoVacio = items.length === 0;

  // Higiene (money-safety): al quedar VACÍO el carrito (venta finalizada o
  // vaciado manual) no arrastrar una `tarjetaPendiente` rancia a otra venta.
  // Corre async tras el render → NUNCA borra el pendiente entre el `limpiar()`
  // post-venta y la vinculación, que ya lo consumió (y limpió) para entonces.
  useEffect(() => {
    if (items.length === 0) {
      useClientePuntos.getState().limpiarTarjetaPendiente();
    }
  }, [items.length]);
  const banner =
    sinVendedor && !carritoVacio
      ? "Selecciona un vendedor para cobrar"
      : carritoVacio && sinVendedor
      ? "Carrito vacío · selecciona un vendedor"
      : null;
  const [corteOpen, setCorteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [apartarOpen, setApartarOpen] = useState(false);
  const [apartadosOpen, setApartadosOpen] = useState(false);
  const [registrosOpen, setRegistrosOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const { pin: pinRegistros } = usePinVentas(negocioId);
  const [noRegOpen, setNoRegOpen] = useState(false);
  const [preRegOpen, setPreRegOpen] = useState(false);
  const [vinculacionOpen, setVinculacionOpen] = useState(false);
  const [ventaParaVincular, setVentaParaVincular] = useState<{
    venta: Venta;
    monto: string;
    path: string;
  } | null>(null);
  const [salidaOpen, setSalidaOpen] = useState(false);
  const [varPickerPadre, setVarPickerPadre] = useState<Articulo | null>(null);
  const [senaPadre, setSenaPadre] = useState<Articulo | null>(null);
  // Ref al buscador de artículos para devolverle el foco al input tras
  // cerrar VariacionPickerModal o SenaPickerModal. Sin esto, después de
  // cada escaneo que abre modal el siguiente scan se pierde en `body`.
  const buscadorRef = useRef<BuscadorArticuloHandle>(null);

  // Hook del chat del nodo a nivel app — el sonido de notificación y el
  // badge de no-leídos deben funcionar aunque el modal esté cerrado. Si
  // lo dejáramos dentro de ChatGrupoModal, el cajero solo escucharía el
  // sonido al tener el chat abierto, que es lo contrario de lo útil.
  const chatData = useChatGrupoNodo();

  // Altura real del PagoFooter — la usa CarritoPanel como padding inferior
  // del scroll. Sin esto, los items que caen detrás del footer (cuando hay
  // muchos en el carrito) quedan inalcanzables: scroll bottom no los
  // muestra completos. Reactivo a transferencia, banners, comisión, etc.
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(280);

  useEffect(() => {
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (typeof h === "number" && h > 0) setFooterHeight(Math.ceil(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Handler del back físico/gesto del Android. Prioridad de cierre:
  // sheets/modales abiertos primero, después la app deja que el navegador
  // navegue atrás (lo hace `__handleAndroidBack` en back-handler.ts).
  useBackHandler(
    () => {
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
  function finalizarVenta(venta: Venta, puntosMsg?: string) {
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
  async function confirmarVenta() {
    setProcesando(true);
    try {
      await ejecutarVenta();
    } finally {
      setProcesando(false);
    }
  }

  async function ejecutarVenta() {
    if (!preview) throw new Error("Sin preview de venta");
    if (!negocioId || !sucursalId || !nodoId) {
      throw new Error("Sesión del nodo inválida");
    }
    const monto = preview.montoCobro;
    const puntosTel = preview.puntosTelefono;
    const descPuntos = preview.descuentoPuntos;
    const cashbackUsar = Number(descPuntos) || 0;

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
    // Fase 5 (mínima-segura) — candado de canje: el servidor previene el DOBLE
    // DÉBITO (pendingLock → si hay un canje en curso del mismo cliente devuelve 409
    // y aquí se aborta). NO se reusa el cobro entre recargas (eso requeriría verificar
    // si la venta ya existe → deferido); el residual es el huérfano raro (detectable).
    const cobroId = preview.idempotencyKey;
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
        await fnCanjearPuntos({
          phone: puntosTel,
          money: cashbackUsar,
          idempotencyKey: cobroId,
          pendingLock: true, // activa el candado del servidor (anti doble-débito)
        });
      } catch (e) {
        // Conflicto (otro canje en curso del mismo cliente) → abortar claro; NO crear
        // venta con descuento sin débito. Otro error (red/saldo) → abortar genérico.
        const msg = e instanceof Error ? e.message : "";
        throw new Error(
          msg.includes("canje en curso")
            ? "Ya hay un canje en curso para este cliente. Espera unos minutos y reintenta."
            : "No se pudo usar el cashback (sin conexión o saldo). Quítalo o reintenta.",
        );
      }
    }

    const result = await crearVenta({
      negocioId,
      sucursalId,
      nodoId,
      ...preview,
      idempotencyKey: cobroId, // venta ligada al MISMO id del débito
    });
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
    limpiar();
    setPreview(null);
    if (result.offline) {
      setToast(
        `Venta OFFLINE (${result.venta.numeroDeVenta}). Se reconcilia al reconectar.`,
      );
      window.setTimeout(() => setToast(null), 4000);
    }

    // F4/F6: si se compró/repuso una tarjeta en esta venta, vincularla AHORA que la
    // venta se creó → "pagó → se vincula", idempotente por ventaId. Best-effort: la
    // venta YA existe, un fallo no la revierte. Limpiamos el pendiente antes para que
    // NUNCA se arrastre a otra venta. Offline: se omite (la vinculación necesita red).
    const tarjPend = useClientePuntos.getState().tarjetaPendiente;
    // "Vinculado ⟺ pagado": solo vincular si el ARTÍCULO de la tarjeta realmente se
    // cobró en ESTA venta. Blinda contra un pendiente arrastrado (carrito cancelado
    // /vaciado sin cobrar) que vincularía la tarjeta sin haberse pagado.
    const tarjetaCobrada = (result.venta.articulos ?? []).some(
      (a) => a.id === CARD_ARTICLE_ID,
    );
    if (tarjPend && tarjPend.telefono && tarjPend.codigo && !tarjetaCobrada) {
      // Había pendiente pero la tarjeta NO se cobró → descartar sin vincular.
      useClientePuntos.getState().limpiarTarjetaPendiente();
    } else if (tarjPend && tarjPend.telefono && tarjPend.codigo) {
      useClientePuntos.getState().limpiarTarjetaPendiente();
      const cardPayload = {
        modo: (tarjPend.codigoAnterior ? "reponer" : "activar") as "activar" | "reponer",
        phone: tarjPend.telefono,
        codigo: tarjPend.codigo,
        ...(tarjPend.codigoAnterior ? { codigoAnterior: tarjPend.codigoAnterior } : {}),
        ventaId: result.venta.ventaId,
      };
      if (result.offline) {
        // Sin conexión: encolar el vínculo → se reintenta solo al reconectar
        // (idempotente por código+monedero; NO re-cobra: la venta ya existe).
        useClientePuntos.getState().encolar("card", cardPayload);
        setToast("Sin conexión: la tarjeta se vinculará automáticamente al reconectar.");
        window.setTimeout(() => setToast(null), 6000);
      } else {
        try {
          if (tarjPend.codigoAnterior) {
            await fnReponerTarjeta({
              phone: tarjPend.telefono,
              codigoAnterior: tarjPend.codigoAnterior,
              codigoNuevo: tarjPend.codigo,
              ventaId: result.venta.ventaId,
            });
          } else {
            await fnActivarTarjeta({
              phone: tarjPend.telefono,
              codigo: tarjPend.codigo,
              ventaId: result.venta.ventaId,
            });
          }
        } catch (e) {
          const err = e as { code?: string; message?: string };
          // Solo se reintenta un fallo de RED (el proxy lanza 'unavailable' al no
          // contactar amise). Otro error (rechazo definitivo o del server) conserva
          // el mensaje accionable y NO se encola (evita reintentos vacíos que se
          // descartarían en silencio).
          if (String(err?.code || "").includes("unavailable")) {
            useClientePuntos.getState().encolar("card", cardPayload);
            setToast("La tarjeta se vinculará automáticamente al reconectar. La venta sí se cobró.");
          } else {
            setToast(`Tarjeta NO vinculada (${err?.message || "revisa el código"}). La venta sí se cobró.`);
          }
          window.setTimeout(() => setToast(null), 6000);
        }
      }
    }

    // PT-10: cliente EXISTENTE. El canje (débito) ya ocurrió en línea arriba; aquí
    // solo se ACREDITA sobre lo pagado por método (= montoCobro neto). La
    // acreditación es best-effort y puede encolarse offline (idempotente por ventaId).
    if (puntosTel) {
      let ventaFinal: Venta =
        descPuntos && Number(descPuntos) > 0
          ? { ...result.venta, descuentoPuntos: descPuntos }
          : result.venta;
      const earnPayload = {
        phone: puntosTel,
        amount: Number(monto) || 0,
        ventaId: result.venta.ventaId,
        sucursalId,
        nodoId
      };
      // Esperamos la acreditación para dar FEEDBACK (toast unificado en el ticket).
      // Si falla (sin red), se encola y reintenta — la venta NO se bloquea.
      let puntosMsg = "";
      try {
        const res = await fnAcreditarPuntos(earnPayload);
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
      } catch {
        useClientePuntos.getState().encolar("earn", earnPayload);
        puntosMsg = "Cashback: se acreditará al reconectar.";
      }
      finalizarVenta(ventaFinal, puntosMsg);
      return;
    }

    // Si hay un cliente pre-registrado pendiente, ofrecer vincular ANTES del
    // ticket. Si no, finalizar (imprimir) directo.
    if (useClientePuntos.getState().pendiente) {
      setVentaParaVincular({ venta: result.venta, monto, path: result.path });
      setVinculacionOpen(true);
      return;
    }
    finalizarVenta(result.venta);
  }

  // Pre-registro de cliente (FAB): genera la contraseña temporal local, guarda
  // el pendiente y llama a la CF (encola si offline — el código ya está local).
  function handlePreRegistrar(data: PreRegistroData) {
    const code = generarCodigoPuntos();
    useClientePuntos.getState().setPendiente({
      correo: data.correo,
      telefono: data.telefono,
      nombre: data.nombre,
      code,
    });
    const payload = { email: data.correo, phone: data.telefono, nombre: data.nombre, code };
    fnRegistrarClientePuntos(payload).catch(() => {
      useClientePuntos.getState().encolar("register", payload);
      setToast(`Registrado sin conexión (se sincroniza). Código: ${code}`);
      window.setTimeout(() => setToast(null), 6000);
    });

    // F5: si adquirió tarjeta al registrarse, agregar el ARTÍCULO al carrito y dejar
    // el barcode PENDIENTE de vincular al cobrar (pagó → se vincula, como F4).
    let msgTarjeta = "";
    if (data.cardBarcode) {
      const art = articulosById.get(CARD_ARTICLE_ID);
      if (art) {
        agregar(art);
        useClientePuntos.getState().setTarjetaPendiente({
          codigo: data.cardBarcode,
          telefono: data.telefono,
        });
        msgTarjeta = " + tarjeta agregada";
      } else {
        msgTarjeta = " (no se encontró el artículo de tarjeta)";
      }
    }
    setToast(`Cliente registrado${msgTarjeta}. Código: ${code}`);
    window.setTimeout(() => setToast(null), 5000);
  }

  // "Sí": acreditar los puntos de esta venta + imprimir el ticket con la
  // contraseña temporal + limpiar el pendiente.
  async function handleVincularSi() {
    const sel = ventaParaVincular;
    const pend = useClientePuntos.getState().pendiente;
    setVinculacionOpen(false);
    setVentaParaVincular(null);
    if (!sel || !pend || !sucursalId || !nodoId) {
      if (sel) finalizarVenta(sel.venta);
      return;
    }
    let venta: Venta = { ...sel.venta, codigoPuntos: pend.code };
    const payload = {
      email: pend.correo,
      phone: pend.telefono,
      amount: Number(sel.monto) || 0,
      ventaId: sel.venta.ventaId,
      sucursalId,
      nodoId,
    };
    // Esperar la acreditación para feedback + reflejarla en el ticket; si falla,
    // encolar (no bloquea el ticket con la contraseña temporal).
    let puntosMsg = "";
    try {
      const res = await fnAcreditarPuntos(payload);
      const added = Number(res.data.added) || 0; // cashback $ acumulado
      const balance = Number(res.data.balance) || 0; // saldo $ resultante
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
    } catch {
      useClientePuntos.getState().encolar("earn", payload);
      puntosMsg = "Cashback: se acreditará al reconectar (sin conexión).";
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

  // "No": no acreditar esta venta; el pendiente se mantiene para la correcta.
  function handleVincularNo() {
    const sel = ventaParaVincular;
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
      <header className="relative flex shrink-0 items-center gap-2 overflow-hidden border-b px-3 py-2">
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
        <div className="relative z-10 flex min-w-0 max-w-[14rem] shrink items-center">
          {logo.src ? (
            <img
              src={logo.src}
              alt="Logo"
              className="h-9 max-w-[12rem] object-contain"
              draggable={false}
            />
          ) : (
            <span className="truncate text-sm font-semibold">Amise</span>
          )}
        </div>
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2">
          <SelectorVendedor className="max-w-[18rem]" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPinOpen(true)}
            aria-label="Registros de venta"
          >
            <ListOrdered className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setApartadosOpen(true)}
            aria-label="Apartados"
          >
            <Bookmark className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/resurtidos")}
            aria-label="Resurtidos"
            className="relative"
          >
            <Truck className="h-5 w-5" />
            {resurtidosPendientes > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {resurtidosPendientes}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => setCorteOpen(true)}
            className={`h-7 rounded-full border border-white/30 backdrop-blur-sm transition-colors ${
              corte
                ? "bg-emerald-500/70 text-white hover:bg-emerald-500/80"
                : "bg-white/20 text-foreground hover:bg-white/40"
            }`}
          >
            {corte ? "Corte en curso" : "Iniciar corte"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/ajustes")}
            aria-label="Ajustes"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Cuerpo principal — wrapper con imagen de fondo. La imagen va en
          una capa absoluta detrás de todo el contenido; el contenido sigue
          como siblings normales pero con `z-10` para quedar encima. */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
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

        {/* Banner de estado (sin vendedor / carrito vacío) */}
        {banner && (
          <div className="relative z-10 border-b bg-amber-50 px-3 py-1 text-center text-xs font-medium text-amber-900">
            {banner}
          </div>
        )}

        {/* Buscador (autocomplete) en la parte superior; carrito ocupa el área principal.
            z-30 (mayor que el bloque de abajo z-10) para que el desplegable de
            sugerencias quede por encima de la fila carrito+footer. */}
        <div className="relative z-30">
          <BuscadorArticulo
            ref={buscadorRef}
            onPedirVariacion={setVarPickerPadre}
            onPedirSena={setSenaPadre}
          />
        </div>
        {/* `relative` para anclar el PagoFooter como overlay al fondo. El carrito
            se extiende a toda la altura disponible y es scrollable; el footer
            flota encima con fondo transparente y `pointer-events-none` en las
            zonas vacías para que puedas ver y hacer click en los items que
            quedan detrás de los huecos entre botones. */}
        <div className="relative z-10 flex flex-1 overflow-hidden">
          <CarritoPanel bottomPadding={footerHeight} />

          <div
            ref={footerRef}
            className="pointer-events-none absolute inset-x-0 bottom-0"
          >
            <PagoFooter
              resetSignal={resetPuntosSignal}
              onCobrar={(data) =>
                setPreview({ ...data, idempotencyKey: generarID() })
              }
            />
          </div>
        </div>
      </div>

      <ConfirmarVentaModal
        data={preview}
        onCancel={() => {
          setPreview(null);
          setResetPuntosSignal((n) => n + 1);
        }}
        onConfirm={confirmarVenta}
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

      <FloatingNoRegistradoButton onClick={() => setNoRegOpen(true)} />
      <FloatingPreRegistroButton onClick={() => setPreRegOpen(true)} />
      <PreRegistroClienteModal
        open={preRegOpen}
        onClose={() => setPreRegOpen(false)}
        onRegistrar={handlePreRegistrar}
      />
      <VinculacionClienteModal
        open={vinculacionOpen}
        correo={pendientePuntos?.correo ?? ""}
        onSi={handleVincularSi}
        onNo={handleVincularNo}
      />
      <FloatingApartarButton onClick={() => setApartarOpen(true)} />
      <FloatingChatButton
        onClick={() => setChatOpen(true)}
        // Mientras el chat está abierto, el badge se oculta (los mensajes
        // se están viendo en vivo). marcarApertura ya marca leídos al
        // abrir, así que cerrar dejará noLeidos en 0 hasta que llegue
        // un mensaje nuevo.
        noLeidos={chatOpen ? 0 : chatData.noLeidos}
      />

      <VentaRealizadaOverlay
        show={overlayShow}
        onDone={() => setOverlayShow(false)}
      />

      <FloatingReimprimirButton
        onClick={handleReimprimir}
        disabled={!ultimaVenta}
        numeroDeVenta={ultimaVenta?.numeroDeVenta}
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
          className="fixed bottom-32 left-1/2 z-40 w-[min(90vw,28rem)] -translate-x-1/2 rounded-md bg-primary px-4 py-3 text-center text-sm text-primary-foreground shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

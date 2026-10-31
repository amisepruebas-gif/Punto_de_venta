import { useEffect, useMemo, useState } from "react";
import { CreditCard, ArrowLeftRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCarrito, subtotalItem, aVentaArticulo } from "./carritoStore";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { UsarPuntosModal } from "@/features/puntos/UsarPuntosModal";
import { UsarRegaloModal } from "@/features/puntos/UsarRegaloModal";
import type { MovimientoPago, VentaArticulo } from "@shared";

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
  /** Fase 3 — crédito de regalo usado como descuento (NO es ingreso) +
   *  identificador de la tarjeta para debitarlo (uno de los dos). */
  descuentoRegalo?: string;
  regaloCodigo?: string;
  regaloPhone?: string;
};

type Props = {
  onCobrar: (data: CobrarPayload) => void;
  /** Contador que, al cambiar, fuerza limpiar clientePuntos/descuentoPuntos.
   *  El padre lo incrementa al finalizar o cancelar una venta para que NO quede
   *  anclado el cliente/descuento de la venta anterior. */
  resetSignal?: number;
};

/**
 * Footer compacto de cobro replicando el panel inferior del Android nodo_1
 * (`principal.xml`): 4 columnas full-width.
 *  1. TARJETA + TRANSFERENCIA apiladas sobre la fila de totales (TOTAL,
 *     MONTO PAGO/recibido, CAMBIO, Apartar).
 *  2. COBRAR (vertical alto).
 *  3. NO REGISTRADO (vertical alto).
 *  4. Scroll horizontal de billetes.
 *
 * Sin TARJETA/TRANSFERENCIA activas, COBRAR usa EFECTIVO por default.
 */
export function PagoFooter({ onCobrar, resetSignal }: Props) {
  const { items, enTurno, vendedorIdUsuario } = useCarrito();
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const { sucursal } = useSucursal();

  // Items "desmarcados" se mantienen visibles en el carrito pero se
  // excluyen del total y del COBRAR. Mientras haya alguno, el botón
  // COBRAR queda deshabilitado y el banner del Ventas.tsx avisa.
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
  const [clientePuntos, setClientePuntos] = useState<{ telefono: string } | null>(
    null,
  );
  const [usarPuntosOpen, setUsarPuntosOpen] = useState(false);
  // Fase 3 — crédito de regalo usado (pesos) + identificador de la tarjeta para
  // debitarlo. Es un DESCUENTO (reduce el total; NO es ingreso — ya se contó al
  // vender la tarjeta).
  const [descuentoRegalo, setDescuentoRegalo] = useState(0);
  const [regaloId, setRegaloId] = useState<{ codigo?: string; phone?: string } | null>(
    null,
  );
  const [usarRegaloOpen, setUsarRegaloOpen] = useState(false);
  // Un descuento (cashback o crédito de regalo) YA aplicado se invalida al editar
  // el carrito — ver el effect de [subtotalBruto]. Sin avisar, el cajero cobraba
  // creyendo que seguía aplicado (el botón sigue diciendo "Cashback ✓", porque
  // ese ✓ refleja el CLIENTE vinculado, que sí se conserva). Esta bandera lo
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
  }, [resetSignal]);

  // Comisión — solo aplica con tarjeta y si la sucursal tiene cobrarComision=true
  const comisionPct = sucursal?.comisionTarjetaPct ?? COMISION_DEFAULT;
  const comisionEnabled =
    !!sucursal?.cobrarComision && metodo === "pagoTarjeta" && total > 0;
  const comision = comisionEnabled ? Math.round(total * comisionPct) : 0;
  const totalConTarjeta = total + comision;

  const recibidoNum = Number(recibido) || 0;
  const cambio =
    metodo === "pagoEfectivo" ? Math.max(0, recibidoNum - total) : 0;
  const vacio = items.length === 0;
  const sinVendedor = !enTurno;
  const sinSesion = !negocioId || !sucursalId || !nodoId;
  const efectivoOK = metodo !== "pagoEfectivo" || recibidoNum >= total;

  // Motivo por el que COBRAR queda deshabilitado, para que el cajero NO quede
  // adivinando. Reusa los MISMOS booleanos del `disabled` del botón (single
  // source of truth). Solo cubre los casos sin aviso propio: carrito vacío,
  // sin vendedor y desmarcados ya tienen su banner en otro lado.
  const motivoCobrar =
    vacio || sinVendedor || tieneDesmarcados
      ? null
      : sinSesion
      ? "Este equipo no tiene sesión de nodo: regístralo para poder cobrar."
      : !efectivoOK
      ? `Ingresa el efectivo recibido (faltan $${Math.max(0, total - recibidoNum).toFixed(0)}).`
      : null;

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
    // billetes el cajero usa "PAGO IGUAL" o tipea el monto directamente
    // en el input. Comportamiento decidido por el usuario.
    setRecibido(String(d));
  }

  function limpiarRecibido() {
    setRecibido("");
  }

  function toggleMetodo(m: Metodo) {
    setMetodo((curr) => (curr === m ? "pagoEfectivo" : m));
  }

  function cobrar() {
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
          }
        : {}),
      ...(clientePuntos
        ? {
            puntosTelefono: clientePuntos.telefono,
            descuentoPuntos: String(descuentoPuntos),
          }
        : {}),
      ...(descuentoRegalo > 0 && regaloId
        ? {
            descuentoRegalo: String(descuentoRegalo),
            ...(regaloId.codigo ? { regaloCodigo: regaloId.codigo } : {}),
            ...(regaloId.phone ? { regaloPhone: regaloId.phone } : {}),
          }
        : {}),
    });
  }

  const cobrarColor =
    metodo === "pagoTarjeta"
      ? "bg-orange-600 hover:bg-orange-700"
      : metodo === "pagoTransferencia"
      ? "bg-blue-600 hover:bg-blue-700"
      : "bg-emerald-600 hover:bg-emerald-700";

  const cobrarLabel =
    metodo === "pagoTarjeta"
      ? "TARJETA"
      : metodo === "pagoTransferencia"
      ? "TRANSF."
      : "EFECTIVO";

  return (
    <div className="w-full bg-transparent">
      <UsarPuntosModal
        open={usarPuntosOpen}
        maxTotal={maxCashbackAplicable}
        onClose={() => setUsarPuntosOpen(false)}
        onAplicar={({ telefono, descuento }) => {
          setDescuentoPuntos(descuento);
          setClientePuntos({ telefono });
          setDescuentoInvalidado(false);
          setUsarPuntosOpen(false);
        }}
      />
      <UsarRegaloModal
        open={usarRegaloOpen}
        maxTotal={maxRegaloAplicable}
        onClose={() => setUsarRegaloOpen(false)}
        onAplicar={({ codigo, phone, monto }) => {
          setDescuentoRegalo(monto);
          setRegaloId({ codigo, phone });
          setDescuentoInvalidado(false);
          setUsarRegaloOpen(false);
        }}
      />
      {tieneDesmarcados && !error && (
        <p className="pointer-events-auto bg-amber-100 px-3 py-0.5 text-center text-[11px] font-semibold text-amber-900">
          Hay artículos desmarcados — desliza la fila a la derecha para
          marcarlos, o a la izquierda para eliminarlos.
        </p>
      )}
      {error && (
        <p
          className="pointer-events-auto bg-destructive/10 px-3 py-0.5 text-center text-[11px] text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {motivoCobrar && !error && (
        <p className="pointer-events-auto bg-amber-100 px-3 py-0.5 text-center text-[11px] font-semibold text-amber-900">
          {motivoCobrar}
        </p>
      )}
      {descuentoInvalidado && descuentoPuntos === 0 && descuentoRegalo === 0 && (
        <p className="pointer-events-auto bg-indigo-100 px-3 py-0.5 text-center text-[11px] font-semibold text-indigo-900">
          El carrito cambió: el descuento se quitó y hay que volver a aplicarlo.
        </p>
      )}

      {/*
        Layout estilo Android `principal.xml`:
        Col 1 con stack vertical: TRANSFERENCIA (arriba) → TARJETA (medio) →
        cuadro de totales (abajo). Col 2-4 (COBRAR, NO REG, scroll de billetes)
        coinciden con el ancho y alto del cuadro de totales y se alinean al
        bottom de la fila para quedar a la altura exacta de los totales.
        Debajo de 760 px (tablet chica parada) junto a totales + COBRAR no
        queda lugar para los billetes: ahí pasan a su propio renglón arriba.
      */}
      <div className="flex w-full items-end gap-1.5 p-1.5 max-[759px]:flex-wrap">
        {/* Columna 1: TRANSFER (top) + TARJETA (medio) + totales (bottom) */}
        <div className="pointer-events-auto flex w-[20rem] shrink-0 flex-col gap-1">
          <Button
            size="sm"
            onClick={() => toggleMetodo("pagoTransferencia")}
            className={`h-14 w-full text-[11px] font-bold ${
              metodo === "pagoTransferencia"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border bg-background text-foreground hover:bg-accent"
            }`}
          >
            <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
            TRANSFERENCIA
          </Button>
          <Button
            size="sm"
            onClick={() => toggleMetodo("pagoTarjeta")}
            className={`h-14 w-full text-[11px] font-bold ${
              metodo === "pagoTarjeta"
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "border bg-background text-foreground hover:bg-accent"
            }`}
          >
            <CreditCard className="mr-1 h-3.5 w-3.5" />
            PAGO CON TARJETA
          </Button>

          {/* PAGO IGUAL — replica `button118` de Android: rellena el input
              "Pago" con el monto exacto del total (o total con tarjeta si la
              comisión está activa). */}
          <Button
            size="sm"
            onClick={() =>
              setRecibido(
                String(comisionEnabled ? totalConTarjeta : total),
              )
            }
            disabled={total === 0}
            className="h-14 w-full border bg-card text-[11px] font-bold text-foreground hover:bg-accent disabled:opacity-100 disabled:saturate-50"
          >
            PAGO IGUAL
          </Button>

          {/* Card de info de transferencia. Replica `consInformacionDepagoa`
              Android (líneas 1681-1803 principal.xml): banco grande, titular,
              CLABE en cuadro resaltado, referencia opcional. */}
          {metodo === "pagoTransferencia" && (
            <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-blue-900 shadow-sm">
              {sucursal?.datosTransferencia ? (
                <>
                  <p className="text-center text-base font-bold tracking-wide">
                    {sucursal.datosTransferencia.banco || "BANCO"}
                  </p>
                  {sucursal.datosTransferencia.titular && (
                    <p className="text-center text-sm font-medium leading-tight">
                      {sucursal.datosTransferencia.titular}
                    </p>
                  )}
                  <div className="mt-1.5 rounded border border-blue-300/70 bg-white px-2 py-1">
                    <p className="text-[10px] font-semibold uppercase text-blue-700/70">
                      CLABE
                    </p>
                    <p className="text-base font-bold tabular-nums tracking-wide">
                      {sucursal.datosTransferencia.cuenta || "—"}
                    </p>
                  </div>
                  {sucursal.datosTransferencia.referencia && (
                    <div className="mt-1.5 rounded border border-blue-300/70 bg-white px-2 py-1">
                      <p className="text-[10px] font-semibold uppercase text-blue-700/70">
                        Referencia
                      </p>
                      <p className="text-base font-bold tabular-nums tracking-wide">
                        {sucursal.datosTransferencia.referencia}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-sm italic">
                  Configura los datos de transferencia desde admin-web
                </p>
              )}
            </div>
          )}

          {/* Cuadro de totales — define el tamaño base para COBRAR/billetes.
              Cuando es tarjeta + comisión, sustituye el layout por 3 filas
              apiladas: Total → Comisión → Total con tarjeta, junto al Pago. */}
          <div className="flex h-[4.5rem] w-full items-center gap-3 rounded-md border bg-card px-3">
            {metodo === "pagoTarjeta" && comisionEnabled ? (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="font-semibold uppercase text-muted-foreground">
                    Total
                  </span>
                  <span className="font-semibold tabular-nums">
                    ${total.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-[11px] text-orange-700">
                  <span className="font-semibold uppercase">
                    Comisión {Math.round(comisionPct * 100)}%
                  </span>
                  <span className="font-semibold tabular-nums">
                    + ${comision}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 border-t pt-0.5 text-sm">
                  <span className="font-bold uppercase">Total c/T</span>
                  <span className="font-bold tabular-nums">
                    ${totalConTarjeta}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUsarPuntosOpen(true)}
                    className="text-[11px] font-semibold text-indigo-600 underline"
                  >
                    {clientePuntos ? "Cashback ✓" : "Cashback"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsarRegaloOpen(true)}
                    className="text-[11px] font-semibold text-amber-700 underline"
                  >
                    {descuentoRegalo > 0 ? "Crédito ✓" : "Crédito regalo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Total
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  ${total.toFixed(0)}
                </p>
                {descuentoPuntos > 0 && (
                  <p className="text-[11px] font-semibold text-indigo-600 tabular-nums">
                    − ${descuentoPuntos.toFixed(2)} de cashback
                  </p>
                )}
                {descuentoRegalo > 0 && (
                  <p className="text-[11px] font-semibold text-amber-700 tabular-nums">
                    − ${descuentoRegalo.toFixed(2)} de crédito de regalo
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUsarPuntosOpen(true)}
                    className="text-[11px] font-semibold text-indigo-600 underline"
                  >
                    {clientePuntos ? "Cashback ✓" : "Cashback"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUsarRegaloOpen(true)}
                    className="text-[11px] font-semibold text-amber-700 underline"
                  >
                    {descuentoRegalo > 0 ? "Crédito ✓" : "Crédito regalo"}
                  </button>
                </div>
              </div>
            )}

            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Pago
              </p>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  placeholder="0"
                  className="h-9 w-24 pr-6 text-right text-base font-semibold tabular-nums"
                />
                {recibidoNum > 0 && (
                  <button
                    type="button"
                    onClick={limpiarRecibido}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Limpiar recibido"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {metodo === "pagoEfectivo" && (
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Cambio
                </p>
                <p className="text-xl font-semibold tabular-nums text-emerald-700">
                  ${cambio.toFixed(0)}
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Columna 2: COBRAR — mismo tamaño que el cuadro de totales (w-[22rem] h-[4.5rem]) */}
        <Button
          onClick={cobrar}
          disabled={
            vacio ||
            sinVendedor ||
            sinSesion ||
            !efectivoOK ||
            tieneDesmarcados
          }
          className={`pointer-events-auto flex h-[4.5rem] w-[14.3rem] shrink-0 flex-col items-center justify-center gap-0.5 text-white disabled:opacity-100 disabled:saturate-50 ${cobrarColor}`}
        >
          <span className="text-lg font-bold tracking-wide">COBRAR</span>
          <span className="text-xs font-semibold opacity-80">
            · {cobrarLabel}
          </span>
        </Button>

        {/* Columna 3: billetes con sus imágenes reales (copiadas de
            `nodo_1/.../drawable/billete*`). Aspect ratio ~110:54 igual que
            el original Android. Ocupan todo el espacio que dejó libre
            "NO REGISTRADO" (que ahora vive como FAB).
            `[&>:first-child]:ml-auto` hace que cuando los billetes caben,
            queden alineados a la derecha (espacio libre se traga el primer
            elemento), pero cuando exceden el ancho el `margin auto` colapsa
            y el `overflow-x-auto` permite scroll natural. Usar `justify-end`
            rompía el scroll porque escondía los primeros items.
            Debajo de 1500 px de ancho los 6 billetes grandes no caben (en una
            tablet se veían 2 o 3): ahí van en 2 filas de billetes chicos con
            su cantidad, pegados a COBRAR, con la misma altura total. */}
        <div className="no-scrollbar flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto [&>:first-child]:ml-auto max-[1500px]:grid max-[1500px]:grid-cols-[repeat(3,max-content)] max-[759px]:order-first max-[759px]:basis-full max-[759px]:grid-cols-[repeat(6,max-content)]">
          {BILLETES.map((b) => (
            <button
              key={b.d}
              type="button"
              onClick={() => elegirBillete(b.d)}
              aria-label={`Pago con $${b.d}`}
              className="pointer-events-auto relative h-[4.5rem] aspect-[110/54] shrink-0 overflow-hidden rounded-md border-2 border-border bg-card transition hover:border-primary/60 active:scale-95 max-[1500px]:h-[2.125rem]"
            >
              <img
                src={b.src}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              <span className="absolute bottom-0 right-0 hidden rounded-tl bg-black/65 px-1 text-[10px] font-bold leading-tight text-white max-[1500px]:block">
                ${b.d}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// (función `billeteColor` eliminada — ya no aplicaba con las imágenes
//  reales de billetes; los colores vienen del propio billete escaneado.)

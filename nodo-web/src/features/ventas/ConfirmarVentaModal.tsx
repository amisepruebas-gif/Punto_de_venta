import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { subtotalItem } from "./carritoStore";
import type { CobrarPayload } from "./PagoFooter";
import {
  mostrarMetaTicket,
  type MovimientoPago,
  type TicketLinea,
} from "@shared";

const METODO_LABEL: Record<MovimientoPago, string> = {
  pagoEfectivo: "EFECTIVO",
  pagoTarjeta: "TARJETA",
  pagoTransferencia: "TRANSFERENCIA",
  pagoDividido: "PAGO DIVIDIDO",
};

const ANCHO_TICKET_CHARS = 32;

type Props = {
  data: CobrarPayload | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

/**
 * Replica `pop_ticket_digital.xml` del Android nodo_1: preview del ticket
 * ANTES de guardar. La venta solo se persiste cuando el usuario hace click
 * en "Confirmar" (equivalente al `button128 → finalizarVenta` de Android).
 *
 * Estilo "recibo de papel": fondo cremoso, monoespaciada, divisores con
 * guiones, bordes perforados arriba/abajo y el contenido replica lo que
 * `ticketEscPos.ts` enviará a la impresora — incluye encabezado/pie
 * configurables, toggles de meta y QR si la sucursal los tiene definidos.
 */
export function ConfirmarVentaModal({ data, onCancel, onConfirm }: Props) {
  const { sucursal } = useSucursal();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  const cfg = sucursal?.ticketConfig;
  const qr = cfg?.qr;

  // Reset cuando llega un preview nuevo. Sin esto: el primer Confirmar marca
  // submitting=true; al concluir el padre hace setPreview(null) y el modal
  // renderiza null pero su instancia React sigue viva con `submitting=true`
  // preservado. La siguiente venta veía el botón "Guardando…" disabled
  // permanentemente. Bug reportado por el usuario.
  useEffect(() => {
    if (data) {
      setSubmitting(false);
      setError(null);
    }
  }, [data]);

  useEffect(() => {
    let cancelado = false;
    if (!qr || !qr.contenido.trim()) {
      setQrSvg(null);
      return;
    }
    QRCode.toString(qr.contenido.trim(), {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        if (!cancelado) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelado) setQrSvg(null);
      });
    return () => {
      cancelado = true;
    };
  }, [qr]);

  if (!data) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  const total = Number(data.montoCobro) || 0;
  const pago = Number(data.montoPago) || 0;
  const cambio = Number(data.cambio) || 0;
  const comicion = Number(data.comicion) || 0;
  const conComision =
    data.movimiento === "pagoTarjeta" && data.statusComision === "con comision";
  const totalFinal = conComision ? total + comicion : total;

  const encabezado = cfg?.encabezado ?? [];
  const pie = cfg?.pie ?? [];
  const mostrarNumero = mostrarMetaTicket(cfg, "numeroTicket");
  const mostrarFecha = mostrarMetaTicket(cfg, "fecha");
  const mostrarVendedor = mostrarMetaTicket(cfg, "vendedor");
  const algunMeta = mostrarNumero || mostrarFecha || mostrarVendedor;

  const fechaLocal = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={() => !submitting && onCancel()}
      role="dialog"
      aria-modal
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-[360px] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Borde perforado superior */}
        <div
          aria-hidden
          className="h-2.5 w-full"
          style={{
            backgroundImage:
              "linear-gradient(135deg, transparent 50%, #fffaf0 50%), linear-gradient(225deg, transparent 50%, #fffaf0 50%)",
            backgroundSize: "10px 10px, 10px 10px",
            backgroundPosition: "0 0, 5px 0",
            backgroundRepeat: "repeat-x",
          }}
        />

        {/* Hoja del ticket */}
        <div
          className="flex flex-1 flex-col overflow-hidden bg-[#fffaf0] text-zinc-800 shadow-2xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, transparent 4%, transparent 96%, rgba(0,0,0,0.03) 100%)",
          }}
        >
          <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-[1.35]">
            {/* Encabezado */}
            {encabezado.length > 0 ? (
              encabezado.map((l) => <LineaTicket key={l.id} linea={l} />)
            ) : (
              <>
                {sucursal?.nombre && (
                  <p className="text-center text-base font-bold uppercase tracking-wide">
                    {sucursal.nombre}
                  </p>
                )}
                {sucursal?.direccion && (
                  <p className="text-center text-[11px]">{sucursal.direccion}</p>
                )}
                {sucursal?.telefono && (
                  <p className="text-center text-[11px]">
                    Tel: {sucursal.telefono}
                  </p>
                )}
              </>
            )}

            <Divisor />

            {/* Meta */}
            {algunMeta && (
              <>
                {(mostrarNumero || mostrarFecha) && (
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    {mostrarNumero ? (
                      <span className="italic text-zinc-600">
                        Ticket nuevo
                      </span>
                    ) : (
                      <span />
                    )}
                    {mostrarFecha && <span>{fechaLocal}</span>}
                  </div>
                )}
                {mostrarVendedor && (
                  <p className="text-[11px]">
                    Vendedor: <span className="font-semibold">{data.enTurno}</span>
                  </p>
                )}
                <Divisor />
              </>
            )}

            {/* Items */}
            <ul className="space-y-1.5">
              {data.articulos.map((a, idx) => {
                const sub = subtotalItem(a);
                const precioBase = Number(a.precio) || 0;
                const precioFinal = Number(a.descuento) || precioBase;
                const tieneDescuento =
                  !!a.descuento && precioFinal !== precioBase;
                const isNoReg = a.id === "00000000" || a.id === "0";
                const nombre = a.subvariacionNombre
                  ? `${a.nombrePublico} - ${a.subvariacionNombre}`
                  : a.nombrePublico;
                return (
                  <li key={idx}>
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 tabular-nums">
                        {a.cantidad}×
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {nombre}
                        {isNoReg && (
                          <span className="ml-1 rounded-sm border border-rose-700/50 px-1 text-[9px] font-bold text-rose-700">
                            NR
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">${sub}</span>
                    </div>
                    <div className="flex items-baseline justify-between pl-6 text-[10.5px] text-zinc-600">
                      <span className="truncate">
                        {a.subvariacionCodigo && (
                          <span className="mr-1">{a.subvariacionCodigo}</span>
                        )}
                        {a.talla && <span className="mr-1">T{a.talla}</span>}
                        {tieneDescuento ? (
                          <>
                            <span className="line-through">${precioBase}</span>
                            {" → "}
                            <span>${precioFinal}</span> c/u
                          </>
                        ) : (
                          <>${precioFinal} c/u</>
                        )}
                      </span>
                      {a.seña && (
                        <span
                          className="max-w-[20ch] truncate rounded bg-emerald-700/10 px-1 text-[10px] text-emerald-800"
                          title={`Seña: ${a.seña}`}
                        >
                          SEÑA: {a.seña}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <Divisor />

            {/* Totales */}
            <div className="space-y-0.5 text-[11.5px]">
              {conComision && (
                <>
                  <FilaTotal label="Subtotal" valor={`$${total}`} />
                  <FilaTotal
                    label="Comisión tarjeta"
                    valor={`+ $${comicion}`}
                  />
                </>
              )}
              <FilaTotal
                label={conComision ? "TOTAL CON TARJETA" : "TOTAL"}
                valor={`$${totalFinal}`}
                grande
              />
              <FilaTotal label="Pago" valor={`$${pago}`} />
              {data.movimiento === "pagoEfectivo" && cambio > 0 && (
                <FilaTotal label="Cambio" valor={`$${cambio}`} />
              )}
            </div>

            <p className="pt-2 text-center text-[12px] font-bold uppercase tracking-wider">
              {METODO_LABEL[data.movimiento]}
            </p>

            {/* Pie */}
            <Divisor />
            {pie.length > 0 ? (
              pie.map((l) => <LineaTicket key={l.id} linea={l} />)
            ) : (
              <p className="text-center text-[11px] italic">
                ¡Gracias por tu compra!
              </p>
            )}

            {/* QR */}
            {qrSvg && (
              <div className="flex flex-col items-center pt-3">
                <div
                  className="h-24 w-24"
                  // SVG generado localmente — sin XSS.
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                {qr?.leyenda && (
                  <p className="pt-1 text-center text-[10px]">{qr.leyenda}</p>
                )}
              </div>
            )}

            <p className="pt-3 text-center text-[9px] uppercase tracking-widest text-zinc-400">
              · vista previa ·
            </p>
          </div>
        </div>

        {/* Borde perforado inferior */}
        <div
          aria-hidden
          className="h-2.5 w-full"
          style={{
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, #fffaf0 50%), linear-gradient(-45deg, transparent 50%, #fffaf0 50%)",
            backgroundSize: "10px 10px, 10px 10px",
            backgroundPosition: "0 0, 5px 0",
            backgroundRepeat: "repeat-x",
          }}
        />

        {/* Acciones — fuera del recibo, sobre el backdrop */}
        <div className="mt-3 space-y-1.5">
          {error && (
            <p
              className="rounded-md bg-destructive px-3 py-2 text-center text-xs text-destructive-foreground"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers visuales
// ============================================================

function Divisor() {
  return (
    <p className="my-1.5 select-none text-center text-zinc-500">
      {"-".repeat(ANCHO_TICKET_CHARS)}
    </p>
  );
}

function FilaTotal({
  label,
  valor,
  grande,
}: {
  label: string;
  valor: string;
  grande?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${
        grande ? "border-y border-dashed border-zinc-400 py-1 text-[14px] font-bold" : ""
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

function LineaTicket({ linea }: { linea: TicketLinea }) {
  const estilo = linea.estilo ?? "normal";
  const alineacion = linea.alineacion ?? "center";

  let tamañoClase = "";
  let pesoClase = "";
  switch (estilo) {
    case "big":
      tamañoClase = "text-base";
      pesoClase = "font-bold";
      break;
    case "bold":
      pesoClase = "font-bold";
      break;
    case "small":
      tamañoClase = "text-[10px] text-zinc-700";
      break;
  }

  const alinClase =
    alineacion === "left"
      ? "text-left"
      : alineacion === "right"
        ? "text-right"
        : "text-center";

  return (
    <p className={`whitespace-pre-wrap break-words ${tamañoClase} ${pesoClase} ${alinClase}`}>
      {linea.texto || " "}
    </p>
  );
}

import { useEffect, useState } from "react";
import { Printer, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSucursal } from "@/features/sucursal/useSucursal";
import {
  generarTicketPDF,
  abrirPDF,
  compartirPDF,
} from "./ticketService";
import { subtotalItem } from "./carritoStore";
import type { MovimientoPago, Venta } from "@shared";

const METODO_LABEL: Record<MovimientoPago, string> = {
  pagoEfectivo: "EFECTIVO",
  pagoTarjeta: "TARJETA",
  pagoTransferencia: "TRANSFERENCIA",
  pagoDividido: "PAGO DIVIDIDO",
};

const METODO_BADGE: Record<MovimientoPago, string> = {
  pagoEfectivo: "bg-emerald-600",
  pagoTarjeta: "bg-orange-600",
  pagoTransferencia: "bg-blue-600",
  pagoDividido: "bg-violet-600",
};

type Props = {
  venta: Venta | null;
  onClose: () => void;
};

/**
 * Vista preview del ticket — replica `pop_ticket_digital.xml` del Android nodo_1:
 * card centrada con backdrop oscuro, lista de artículos (recyclerTicket_cero),
 * totales (MONTO PAGO + CAMBIO + TOTAL), badge del tipo de pago, fecha y vendedor.
 *
 * Acciones secundarias: Imprimir/PDF y Compartir (vía `generarTicketPDF`).
 */
export function TicketModal({ venta, onClose }: Props) {
  const { sucursal } = useSucursal();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    setShareSupported(
      typeof (navigator as Navigator & { canShare?: (d: ShareData) => boolean })
        .canShare === "function",
    );
  }, []);

  useEffect(() => {
    if (!venta) return;
    setGenerando(true);
    setError(null);
    generarTicketPDF({ venta, sucursal })
      .then(setBlob)
      .catch((e) => setError((e as Error).message))
      .finally(() => setGenerando(false));
  }, [venta, sucursal]);

  if (!venta) return null;

  const total = Number(venta.montoCobro) || 0;
  const pago = Number(venta.montoPago) || 0;
  const cambio = Number(venta.cambio) || 0;
  const comicion = Number(venta.comicion) || 0;
  const conComision =
    venta.movimiento === "pagoTarjeta" &&
    venta.statusComision === "con comision";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-2 border-b p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              Ticket #{venta.numeroDeVenta}
            </h2>
            {sucursal?.nombre && (
              <p className="truncate text-xs text-muted-foreground">
                {sucursal.nombre}
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {venta.fecha?.slice(0, 16)}
              {venta.enTurno ? ` · ${venta.enTurno}` : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white ${METODO_BADGE[venta.movimiento]}`}
          >
            {METODO_LABEL[venta.movimiento]}
          </span>
        </header>

        {/* Lista de artículos — estilo recyclerTicket_cero */}
        <ul className="min-h-[6rem] flex-1 divide-y overflow-y-auto">
          {venta.articulos.map((a, idx) => {
            const sub = subtotalItem(a);
            const precioBase = Number(a.precio) || 0;
            const precioFinal = Number(a.descuento) || precioBase;
            const isNoReg = a.id === "00000000" || a.id === "0";
            const tieneDescuento = !!a.descuento && precioFinal !== precioBase;
            return (
              <li
                key={idx}
                className="flex items-start gap-2 px-4 py-2.5 text-sm"
              >
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-bold tabular-nums">
                  {a.cantidad}×
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <p className="truncate font-medium">{a.nombrePublico}</p>
                    {isNoReg && (
                      <span className="rounded bg-rose-500/15 px-1 py-0 text-[9px] font-bold text-rose-700">
                        NR
                      </span>
                    )}
                    {a.talla && (
                      <span className="rounded bg-muted px-1 py-0 text-[9px]">
                        T{a.talla}
                      </span>
                    )}
                    {a.seña && (
                      <span
                        className="max-w-[16ch] truncate rounded bg-emerald-500/15 px-1 py-0 text-[9px] text-emerald-700"
                        title={`Seña: ${a.seña}`}
                      >
                        SEÑA: {a.seña}
                      </span>
                    )}
                    {tieneDescuento && (
                      <span className="rounded bg-amber-500/15 px-1 py-0 text-[9px] text-amber-700">
                        DESC
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.subvariacionCodigo && (
                      <span className="font-mono">
                        {a.subvariacionCodigo}{" · "}
                      </span>
                    )}
                    {tieneDescuento ? (
                      <>
                        <span className="line-through">${precioBase}</span>{" "}
                        ${precioFinal} c/u
                      </>
                    ) : (
                      <>${precioFinal} c/u</>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-base font-semibold tabular-nums">
                  ${sub.toFixed(0)}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Totales */}
        <div className="space-y-1 border-t bg-muted/30 px-4 py-2.5">
          {conComision && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal carrito</span>
                <span className="font-medium tabular-nums">
                  ${total.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Comisión tarjeta
                </span>
                <span className="font-medium tabular-nums text-orange-700">
                  + ${comicion.toFixed(0)}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Monto pago</span>
            <span className="font-medium tabular-nums">${pago.toFixed(0)}</span>
          </div>
          {venta.movimiento === "pagoEfectivo" && cambio > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cambio</span>
              <span className="font-medium tabular-nums text-emerald-700">
                ${cambio.toFixed(0)}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t pt-1.5">
            <span className="text-sm font-semibold">
              {conComision ? "TOTAL CON TARJETA" : "TOTAL"}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              ${(conComision ? total + comicion : total).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <footer className="flex flex-col gap-1.5 border-t p-3">
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-1.5">
            <Button
              disabled={!blob || generando}
              onClick={() => blob && abrirPDF(blob)}
              className="flex-1"
              size="sm"
            >
              <Printer className="mr-1.5 h-4 w-4" />
              {generando ? "Generando…" : "Imprimir / PDF"}
            </Button>
            {shareSupported && (
              <Button
                variant="outline"
                disabled={!blob || generando}
                size="sm"
                onClick={async () => {
                  if (!blob) return;
                  const ok = await compartirPDF(
                    blob,
                    `ticket-${venta.numeroDeVenta}.pdf`,
                  );
                  if (!ok) setError("Compartir canceló o falló");
                }}
              >
                <Share2 className="mr-1.5 h-4 w-4" />
                Compartir
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

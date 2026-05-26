import { useEffect, useState } from "react";
import {
  Banknote,
  Calendar as CalendarIcon,
  CreditCard,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNodoSession } from "@/hooks/useNodoSession";
import { ymdMX } from "@shared";
import type { MovimientoPago, Venta, VentaArticulo } from "@shared";
import { useVentasDia } from "./useVentasDia";
import { CalendarioMesModal } from "./CalendarioMesModal";

type Props = {
  open: boolean;
  onClose: () => void;
};

const NOMBRES_MES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function fmtFull(n: number): string {
  return `$${n.toLocaleString("es-MX")}`;
}

function fmtFecha(y: string, m: string, d: string): string {
  const mIdx = parseInt(m, 10) - 1;
  return `${d} ${NOMBRES_MES_CORTO[mIdx]} ${y}`;
}

function horaCorta(fecha: string): string {
  // "YYYY-MM-DD HH:mm:ss" → "HH:mm"
  const t = fecha.split(" ")[1] ?? "";
  return t.slice(0, 5);
}

function metodoLabel(m: MovimientoPago): string {
  if (m === "pagoEfectivo") return "EFECTIVO";
  if (m === "pagoTarjeta") return "TARJETA";
  if (m === "pagoTransferencia") return "TRANSFERENCIA";
  return "DIVIDIDO";
}

function metodoIcon(m: MovimientoPago) {
  if (m === "pagoTarjeta") return CreditCard;
  if (m === "pagoTransferencia") return ArrowLeftRight;
  return Banknote;
}

function metodoColor(m: MovimientoPago): string {
  if (m === "pagoTarjeta") return "text-orange-700 bg-orange-50 border-orange-200";
  if (m === "pagoTransferencia") return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

/**
 * Sheet inferior con todas las ventas del día seleccionado. Cada venta es
 * un card expandible que muestra los artículos con miniatura cuando hay
 * `imagenUrl` (snapshot guardado en la propia venta).
 *
 * Trae además el botón "Mes" que abre el calendario para saltar a otro día.
 */
export function RegistrosVentasSheet({ open, onClose }: Props) {
  const { negocioId, sucursalId } = useNodoSession();

  // Día seleccionado por defecto: hoy MX. Cambia cuando el usuario elige
  // un día desde el calendario.
  const hoy = ymdMX();
  const [y, setY] = useState(hoy.y);
  const [m, setM] = useState(hoy.m);
  const [d, setD] = useState(hoy.d);
  const [calOpen, setCalOpen] = useState(false);

  // Reset a hoy cada vez que se reabre el sheet — evita quedar atascado
  // viendo un día pasado entre aperturas.
  useEffect(() => {
    if (open) {
      const h = ymdMX();
      setY(h.y);
      setM(h.m);
      setD(h.d);
      setCalOpen(false);
    }
  }, [open]);

  const { ventas, totalDia, loading } = useVentasDia(
    negocioId,
    sucursalId,
    y,
    m,
    d,
  );

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
        onClick={onClose}
        role="dialog"
        aria-modal
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="shrink-0 border-b">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">
                  Ventas del {fmtFecha(y, m, d)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {ventas.length}{" "}
                  {ventas.length === 1 ? "venta" : "ventas"} · Total{" "}
                  <span className="font-semibold text-emerald-700">
                    {fmtFull(totalDia)}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalOpen(true)}
                className="h-9 rounded-full"
              >
                <CalendarIcon className="mr-1 h-4 w-4" />
                Mes
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Cerrar"
                className="h-9 w-9"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Cargando…
              </p>
            ) : ventas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sin ventas en este día.
              </p>
            ) : (
              <ul className="space-y-2">
                {ventas.map((v, idx) => (
                  <VentaCard key={v.ventaId || idx} venta={v} numero={idx + 1} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <CalendarioMesModal
        open={calOpen}
        yInicial={y}
        mInicial={m}
        onClose={() => setCalOpen(false)}
        onElegirDia={(yy, mm, dd) => {
          setY(yy);
          setM(mm);
          setD(dd);
          setCalOpen(false);
        }}
      />
    </>
  );
}

function VentaCard({ venta, numero }: { venta: Venta; numero: number }) {
  const Icono = metodoIcon(venta.movimiento);
  const color = metodoColor(venta.movimiento);
  const apartado = venta.apartado === "1";
  const cambioNum = Number(venta.cambio) || 0;
  const totalNum = Number(venta.montoCobro) || 0;
  const pagoNum = Number(venta.montoPago) || 0;

  return (
    <li className="rounded-lg border bg-card shadow-sm">
      {/* Header de la venta */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {numero}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold">
            {venta.enTurno || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {horaCorta(venta.fecha)} · #{venta.numeroDeVenta}
          </p>
        </div>
        <div
          className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${color}`}
        >
          <Icono className="h-3 w-3" />
          {metodoLabel(venta.movimiento)}
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="text-base font-bold tabular-nums">
            {fmtFull(totalNum)}
          </p>
          {venta.movimiento === "pagoEfectivo" && (
            <p className="text-[10px] text-muted-foreground">
              Pago {fmtFull(pagoNum)} · Cambio{" "}
              <span className="font-semibold text-emerald-700">
                {fmtFull(cambioNum)}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Apartado pill */}
      {apartado && venta.idApartado && (
        <div className="border-b bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-900">
          Apartado · {venta.idApartado}
        </div>
      )}

      {/* Artículos */}
      <ul className="divide-y">
        {venta.articulos.map((a, i) => (
          <ArticuloRow key={`${a.id}-${a.subvariacionCodigo ?? ""}-${i}`} a={a} />
        ))}
      </ul>
    </li>
  );
}

function ArticuloRow({ a }: { a: VentaArticulo }) {
  const cantidad = Number(a.cantidad) || 0;
  const precio = Number(a.descuento || a.precio) || 0;
  const subtotal = cantidad * precio;
  const tieneDescuento = !!a.descuento && Number(a.descuento) !== Number(a.precio);

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {/* Miniatura — del snapshot guardado en la venta */}
      {a.imagenUrl ? (
        <img
          src={a.imagenUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">
          {a.descripcion || "—"}
        </div>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-xs font-semibold">{a.nombrePublico}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {a.subvariacionCodigo ? (
            <span className="font-mono">{a.subvariacionCodigo}</span>
          ) : (
            <>
              {a.descripcion}
              {a.id && ` · #${a.id}`}
            </>
          )}
          {a.talla && ` · T${a.talla}`}
        </p>
      </div>
      <div className="shrink-0 text-right leading-tight">
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {cantidad} ×{" "}
          {tieneDescuento ? (
            <>
              <span className="line-through">${a.precio}</span> ${precio}
            </>
          ) : (
            <>${precio}</>
          )}
        </p>
        <p className="text-sm font-bold tabular-nums">${subtotal}</p>
      </div>
    </li>
  );
}

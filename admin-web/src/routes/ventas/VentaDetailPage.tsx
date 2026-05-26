import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useVentasAdmin } from "@/features/ventas-admin/useVentasAdmin";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { Button } from "@/components/ui/button";

/**
 * Detalle de venta. Replica la lógica de adapterHistorialDos +
 * adapterHistorialTres_actualizado del Android legacy:
 * - precio efectivo: descuento > precio > precioVenta.
 * - badges por item: "3 X 2" / MAYOREO / DESCUENTO / TALLA / SEÑA / NR / APARTADO.
 * - color por método de pago.
 */

type ItemLegacy = {
  id: string;
  cantidad?: string;
  precio?: string;
  precioVenta?: string;
  descuento?: string;
  nombrePublico?: string;
  descripcion?: string;
  talla?: string;
  seña?: string;
  aply_3x2?: unknown;
  mayoreoAply?: unknown;
  numeroAp?: string;
};

const ID_NO_REGISTRADO = new Set(["00000000", "0", ""]);

function precioEfectivo(it: ItemLegacy): number {
  if (it.descuento) return Number(it.descuento) || 0;
  if (it.precio) return Number(it.precio) || 0;
  if (it.precioVenta) return Number(it.precioVenta) || 0;
  return 0;
}

function isNoRegistrado(it: ItemLegacy): boolean {
  return ID_NO_REGISTRADO.has(it.id ?? "");
}

function metodoPago(m: string): { label: string; cls: string } {
  switch (m) {
    case "pagoEfectivo":
      return { label: "EFECTIVO", cls: "bg-emerald-500/15 text-emerald-700" };
    case "pagoTransferencia":
      return { label: "TRANSFERENCIA", cls: "bg-blue-500/15 text-blue-700" };
    case "pagoTarjeta":
      return { label: "TARJETA", cls: "bg-orange-500/15 text-orange-700" };
    case "pagoDividido":
      return { label: "DIVIDIDO", cls: "bg-violet-500/15 text-violet-700" };
    default:
      return { label: m, cls: "bg-muted text-muted-foreground" };
  }
}

export function VentaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sucursales } = useSucursales();

  // Para MVP: buscamos entre las últimas 500 ventas. Para un deep-link real
  // habría que hacer query puntual, pero es aceptable post-MVP.
  const { ventas, loading } = useVentasAdmin({ limite: 500 });
  const venta = useMemo(
    () => ventas.find((v) => v.ventaId === id),
    [ventas, id],
  );
  const sucursal = useMemo(
    () => sucursales.find((s) => s.sucursalId === venta?.sucursalId),
    [sucursales, venta],
  );

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Buscando venta…
      </p>
    );
  }

  if (!venta) {
    return (
      <div className="container max-w-md py-10 text-center">
        <p className="text-muted-foreground">
          Venta no encontrada en las últimas 500. Abre desde la lista.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/ventas")}
        >
          Volver a ventas
        </Button>
      </div>
    );
  }

  // Subtotal según jerarquía precio descuento>precio>precioVenta
  const subtotal = (venta.articulos as unknown as ItemLegacy[]).reduce(
    (a, it) => a + (Number(it.cantidad) || 0) * precioEfectivo(it),
    0,
  );

  const pago = metodoPago(venta.movimiento);

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
      </Button>

      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Venta #{venta.numeroDeVenta}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pago.cls}`}
          >
            {pago.label}
          </span>
          {venta.apartado === "1" && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              APARTADO
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {venta.fecha} · {venta.enTurno} ·{" "}
          {sucursal?.nombre ?? venta.sucursalId}
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">
          Artículos ({venta.articulos.length})
        </h2>
        <ul className="divide-y">
          {(venta.articulos as unknown as ItemLegacy[]).map((it, i) => (
            <ItemRow key={i} item={it} />
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-2 text-base font-semibold">Totales</h2>
        <div className="space-y-1 text-sm">
          {Math.abs(subtotal - Number(venta.montoCobro)) > 0.01 && (
            <Row label="Subtotal artículos" value={`$${subtotal.toFixed(2)}`} />
          )}
          <Row
            label="Total cobrado"
            value={`$${Number(venta.montoCobro).toFixed(2)}`}
            strong
          />
          <Row label="Método" value={pago.label} />
          {venta.movimiento === "pagoEfectivo" && (
            <>
              <Row
                label="Recibido"
                value={`$${Number(venta.montoPago).toFixed(2)}`}
              />
              <Row
                label="Cambio"
                value={`$${Number(venta.cambio).toFixed(2)}`}
              />
            </>
          )}
          {venta.datosPagoDividido && (
            <div className="mt-2 rounded bg-muted p-2 text-xs">
              <p className="mb-1 font-medium">Pago dividido:</p>
              {Object.entries(venta.datosPagoDividido).map(([k, v]) => (
                <Row key={k} label={k} value={`$${v}`} />
              ))}
            </div>
          )}
          {venta.apartado === "1" && (
            <Row
              label="ID Apartado"
              value={venta.idApartado ?? "—"}
            />
          )}
          {venta.numeroDeVentaOffline && (
            <Row
              label="Originalmente offline"
              value={venta.numeroDeVentaOffline}
            />
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 text-sm">
        <h2 className="mb-2 text-base font-semibold">Metadatos</h2>
        <Row label="ID venta" value={venta.ventaId} />
        <Row label="Huella" value={venta.huella} />
        <Row label="Nodo" value={venta.nodoId} />
        <Row label="Sucursal" value={sucursal?.nombre ?? venta.sucursalId} />
        <Row label="Fecha (legacy)" value={venta.fecha} />
        <Row label="FechaISO" value={venta.fechaISO} />
      </section>
    </div>
  );
}

function ItemRow({ item }: { item: ItemLegacy }) {
  const cant = Number(item.cantidad) || 0;
  const precioBase = Number(item.precio) || Number(item.precioVenta) || 0;
  const precioFinal = precioEfectivo(item);
  const tieneDescuento = !!item.descuento;
  const subtotal = cant * precioFinal;
  const noReg = isNoRegistrado(item);
  const esApartadoAnidado = !!item.numeroAp;

  // Nombre a mostrar
  const nombre = noReg
    ? item.descripcion || "Sin descripción"
    : item.nombrePublico || item.descripcion || `#${item.id}`;

  return (
    <li
      className={`grid grid-cols-12 gap-2 py-3 ${
        esApartadoAnidado ? "bg-blue-500/5 -mx-3 px-3 rounded" : ""
      }`}
    >
      <div className="col-span-1 text-sm font-medium">{cant}×</div>
      <div className="col-span-7 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium truncate">{nombre}</span>
          {noReg && (
            <span
              className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
              title="No registrado en catálogo"
            >
              NR
            </span>
          )}
          {esApartadoAnidado && (
            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              APARTADO
            </span>
          )}
        </div>
        {/* Sub-fila con id + descripcion + chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {!noReg && item.id && (
            <span className="font-mono">#{item.id}</span>
          )}
          {item.descripcion && !noReg && (
            <span className="truncate">{item.descripcion}</span>
          )}
          {item.talla && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              Talla {item.talla}
            </span>
          )}
          {item.seña && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700">
              Seña ${item.seña}
            </span>
          )}
          {/* Promociones */}
          {item.aply_3x2 !== undefined && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-700 font-semibold">
              3 X 2
            </span>
          )}
          {item.mayoreoAply !== undefined && (
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-700 font-semibold">
              MAYOREO
            </span>
          )}
          {tieneDescuento && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 font-semibold">
              DESCUENTO
            </span>
          )}
        </div>
      </div>
      <div className="col-span-2 text-right text-sm tabular-nums">
        {tieneDescuento && precioBase !== precioFinal ? (
          <div>
            <div className="text-xs text-muted-foreground line-through">
              ${precioBase.toFixed(2)}
            </div>
            <div className="font-medium">${precioFinal.toFixed(2)}</div>
          </div>
        ) : (
          <span>${precioFinal.toFixed(2)}</span>
        )}
      </div>
      <div className="col-span-2 text-right font-semibold tabular-nums">
        ${subtotal.toFixed(2)}
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${
        strong ? "text-base font-semibold" : ""
      }`}
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="break-all text-right">{value}</span>
    </div>
  );
}

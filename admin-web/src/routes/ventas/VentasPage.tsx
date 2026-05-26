import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Lock,
  Pencil,
  ShoppingBag,
  X,
} from "lucide-react";
import { useVentasAdmin } from "@/features/ventas-admin/useVentasAdmin";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { usePinVentas } from "@/features/ventas-admin/usePinVentas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MovimientoPago,
  Venta,
  VentaArticulo,
} from "@shared";

type RangoPreset = "hoy" | "7d" | "30d" | "custom";

function rangoFechas(
  preset: RangoPreset,
  customFrom?: string,
  customTo?: string,
) {
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "hoy") return { desde: hoy, hasta: null };
  if (preset === "7d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 6);
    return { desde: d, hasta: null };
  }
  if (preset === "30d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 29);
    return { desde: d, hasta: null };
  }
  return {
    desde: customFrom ? new Date(customFrom) : null,
    hasta: customTo ? new Date(customTo + "T23:59:59") : null,
  };
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString("es-MX")}`;
}

function horaCorta(fecha: string): string {
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
  if (m === "pagoTarjeta")
    return "text-orange-700 bg-orange-50 border-orange-200";
  if (m === "pagoTransferencia")
    return "text-blue-700 bg-blue-50 border-blue-200";
  if (m === "pagoDividido")
    return "text-violet-700 bg-violet-50 border-violet-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

export function VentasPage() {
  const { sucursales } = useSucursales();
  const [preset, setPreset] = useState<RangoPreset>("hoy");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const [movimiento, setMovimiento] = useState<MovimientoPago | "">("");
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!zoomImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomImage(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomImage]);

  const rango = useMemo(
    () => rangoFechas(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { ventas, loading, fromCache } = useVentasAdmin({
    desde: rango.desde,
    hasta: rango.hasta,
    sucursalId,
  });

  const filtradas = useMemo(() => {
    if (!movimiento) return ventas;
    return ventas.filter((v) => v.movimiento === movimiento);
  }, [ventas, movimiento]);

  const totales = useMemo(() => {
    const total = filtradas.reduce(
      (acc, v) => acc + (Number(v.montoCobro) || 0),
      0,
    );
    return { total, count: filtradas.length };
  }, [filtradas]);

  // Ventas que aún tienen `numeroDeVenta` con prefijo "OFFLINE-" — el
  // reconciliador no les ha asignado número real todavía. Si una lleva
  // > 1 hora pendiente algo está mal (Cloud Function detenida, error,
  // etc.) y mostramos una alerta visual.
  const pendientesOffline = useMemo(() => {
    const ahora = Date.now();
    return ventas
      .filter(
        (v) =>
          typeof v.numeroDeVenta === "string" &&
          v.numeroDeVenta.startsWith("OFFLINE-"),
      )
      .map((v) => {
        const ts = Date.parse(v.fechaISO || "");
        const edadMin = isFinite(ts) ? Math.floor((ahora - ts) / 60000) : 0;
        return { venta: v, edadMin };
      });
  }, [ventas]);

  return (
    <div className="container max-w-6xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Ventas
          </h1>
          {/* Indicador EN VIVO vs SINCRONIZANDO. Cuando `fromCache=true` el
              cliente todavía no confirmó con el servidor — los datos son del
              IndexedDB local. Cuando `fromCache=false` la conexión está
              caliente y cualquier venta nueva aparece al instante. */}
          {!loading && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                fromCache
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-emerald-500/10 text-emerald-700"
              }`}
              title={
                fromCache
                  ? "Mostrando datos locales — esperando confirmación del servidor"
                  : "Listener en vivo — ventas nuevas aparecen automáticamente"
              }
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  fromCache ? "bg-amber-500" : "animate-pulse bg-emerald-500"
                }`}
              />
              {fromCache ? "Sincronizando" : "En vivo"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Historial del negocio
        </p>
      </div>

      <PinCard />

      {pendientesOffline.length > 0 && (
        <PendientesOfflineCard items={pendientesOffline} />
      )}

      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:p-4 md:grid-cols-4">
        <div className="space-y-1.5 md:order-1">
          <Label>Rango</Label>
          <div className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap">
            {(["hoy", "7d", "30d", "custom"] as RangoPreset[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "default" : "outline"}
                onClick={() => setPreset(p)}
                className="h-9 px-2 sm:h-8 sm:px-3"
              >
                {p === "hoy"
                  ? "Hoy"
                  : p === "7d"
                    ? "7 días"
                    : p === "30d"
                      ? "30 días"
                      : "Rango"}
              </Button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>

        {sucursales.length > 1 && (
          <div className="space-y-1.5 md:order-2">
            <Label>Sucursal</Label>
            <select
              value={sucursalId ?? ""}
              onChange={(e) => setSucursalId(e.target.value || null)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {sucursales.map((s) => (
                <option key={s.sucursalId} value={s.sucursalId}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5 md:order-3">
          <Label>Forma de pago</Label>
          <select
            value={movimiento}
            onChange={(e) =>
              setMovimiento(e.target.value as MovimientoPago | "")
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            <option value="pagoEfectivo">Efectivo</option>
            <option value="pagoTransferencia">Transferencia</option>
            <option value="pagoTarjeta">Tarjeta</option>
            <option value="pagoDividido">Dividido</option>
          </select>
        </div>

        {/* En mobile: este card va arriba (order-first). En desktop:
            cuarta columna (order-last). */}
        <div className="order-first flex flex-row items-center justify-between gap-3 rounded-md bg-muted/50 p-3 md:order-last md:flex-col md:items-stretch md:justify-end md:space-y-1">
          <p className="text-xs text-muted-foreground">
            {totales.count} venta{totales.count === 1 ? "" : "s"}
          </p>
          <p className="text-xl font-bold sm:text-2xl">
            {fmtFull(totales.total)}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sin ventas en el rango
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtradas.slice(0, 200).map((v) => (
            <VentaCard
              key={v.ventaId}
              venta={v}
              onZoom={(src, alt) => setZoomImage({ src, alt })}
            />
          ))}
          {filtradas.length > 200 && (
            <li className="rounded-md border border-dashed p-2 text-center text-xs text-muted-foreground">
              Mostrando 200 de {filtradas.length} — refina los filtros para ver
              más
            </li>
          )}
        </ul>
      )}

      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/85 p-5 animate-in fade-in duration-150"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomImage(null);
            }}
            aria-label="Cerrar"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={zoomImage.src}
            alt={zoomImage.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[min(92vw,720px)] cursor-default rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}

function PendientesOfflineCard({
  items,
}: {
  items: { venta: Venta; edadMin: number }[];
}) {
  // Si hay alguna venta pendiente con > 60 min, severidad alta.
  const algunaVieja = items.some((i) => i.edadMin > 60);
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        algunaVieja
          ? "border-red-300 bg-red-50"
          : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={`h-5 w-5 ${
            algunaVieja ? "text-red-600" : "text-amber-600"
          }`}
        />
        <p className="text-sm font-semibold">
          {items.length} venta{items.length === 1 ? "" : "s"} OFFLINE
          pendiente{items.length === 1 ? "" : "s"} de reconciliación
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Estas ventas se crearon sin conexión y aún no tienen un número real
        asignado por la Cloud Function reconciliadora. Lo normal es que se
        resuelva en segundos al reconectar. Si una lleva más de 1 hora
        pendiente, revisa los logs de <code>reconciliarVentasOffline</code>.
      </p>
      <ul className="space-y-1">
        {items.slice(0, 10).map(({ venta, edadMin }) => (
          <li
            key={venta.ventaId}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border bg-card px-2 py-1.5 text-xs"
          >
            <code className="font-mono text-[11px]">{venta.numeroDeVenta}</code>
            <span className="text-muted-foreground">·</span>
            <span className="truncate">{venta.enTurno || "—"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold">
              ${Number(venta.montoCobro).toFixed(0)}
            </span>
            <span className="basis-full text-muted-foreground sm:ml-auto sm:basis-auto">
              hace{" "}
              <span
                className={
                  edadMin > 60 ? "font-bold text-red-600" : ""
                }
              >
                {edadMin < 1
                  ? "<1 min"
                  : edadMin < 60
                    ? `${edadMin} min`
                    : `${Math.floor(edadMin / 60)} h`}
              </span>
            </span>
          </li>
        ))}
        {items.length > 10 && (
          <li className="text-center text-[11px] text-muted-foreground">
            … y {items.length - 10} más
          </li>
        )}
      </ul>
    </div>
  );
}

function PinCard() {
  const { pin, loading, actualizar } = usePinVentas();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function abrirEditor() {
    setValor(pin);
    setEditando(true);
    setError(null);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await actualizar(valor);
      setEditando(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 sm:flex-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Contraseña de Registros (nodo POS)
          </p>
          <p className="text-xs text-muted-foreground">
            Se pide al abrir el sheet de "Registros de venta" en la app de
            ventas. Se sincroniza automáticamente con todos los nodos.
          </p>
        </div>
      </div>
      {!editando ? (
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <code className="rounded bg-muted px-3 py-1 font-mono text-base tracking-widest">
            {loading ? "…" : pin}
          </code>
          <Button size="sm" variant="outline" onClick={abrirEditor}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value.replace(/\D/g, "").slice(0, 8));
              setError(null);
            }}
            placeholder="2121"
            className="h-9 w-28 rounded-md border border-input bg-background px-3 text-center text-base font-mono tracking-widest"
          />
          <Button
            size="sm"
            onClick={guardar}
            disabled={guardando || valor.length < 4}
          >
            Guardar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditando(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          {error && (
            <p className="basis-full text-right text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VentaCard({
  venta,
  onZoom,
}: {
  venta: Venta;
  onZoom: (src: string, alt: string) => void;
}) {
  const Icono = metodoIcon(venta.movimiento);
  const color = metodoColor(venta.movimiento);
  const apartado = venta.apartado === "1";
  const totalNum = Number(venta.montoCobro) || 0;
  const pagoNum = Number(venta.montoPago) || 0;
  const cambioNum = Number(venta.cambio) || 0;

  return (
    <li className="rounded-lg border bg-card shadow-sm">
      {/* Header — en mobile: 2 líneas (vendedor+monto, después método+fecha).
          En desktop (≥sm): todo en una línea con flex-wrap. */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 border-b px-3 py-2 sm:flex sm:flex-wrap">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {venta.numeroDeVenta}
        </span>
        <div className="min-w-0 leading-tight sm:flex-1">
          <p className="truncate text-xs font-semibold">
            {venta.enTurno || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {venta.fecha} · {horaCorta(venta.fecha)}
          </p>
        </div>
        <div className="shrink-0 text-right leading-tight sm:order-3">
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
        {/* En mobile el pill método baja a una línea propia (col-span-3).
            En desktop se mete antes del monto (orden 2 con flex). */}
        <div
          className={`col-span-3 flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold sm:col-span-1 sm:order-2 ${color}`}
        >
          <Icono className="h-3 w-3" />
          {metodoLabel(venta.movimiento)}
        </div>
      </div>

      {apartado && venta.idApartado && (
        <div className="border-b bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-900">
          Apartado · {venta.idApartado}
        </div>
      )}

      <ul className="divide-y">
        {venta.articulos.map((a, i) => (
          <ArticuloRow
            key={`${a.id}-${a.subvariacionCodigo ?? ""}-${i}`}
            a={a}
            onZoom={onZoom}
          />
        ))}
      </ul>
    </li>
  );
}

function ArticuloRow({
  a,
  onZoom,
}: {
  a: VentaArticulo;
  onZoom: (src: string, alt: string) => void;
}) {
  const cantidad = Number(a.cantidad) || 0;
  const precio = Number(a.descuento || a.precio) || 0;
  const subtotal = cantidad * precio;
  const tieneDescuento =
    !!a.descuento && Number(a.descuento) !== Number(a.precio);

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      {a.imagenUrl ? (
        <button
          type="button"
          onClick={() => onZoom(a.imagenUrl!, a.nombrePublico || "Producto")}
          className="shrink-0 cursor-zoom-in rounded transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Ampliar imagen"
        >
          <img
            src={a.imagenUrl}
            alt=""
            className="h-10 w-10 rounded object-cover"
            loading="lazy"
          />
        </button>
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

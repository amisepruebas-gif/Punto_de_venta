import { useEffect, useMemo, useState } from "react";
import { HandCoins, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import {
  guardarConfigCashbackMayoreo,
  movimientosCashback,
  useConfigCashbackMayoreo,
  useCuentaCashbackPorTelefono,
  useCuentasCashbackMayoreo,
} from "@/features/cashback-mayoreo/cashbackMayoreoService";
import { fnAjustarCashbackMayoreo, fnQuitarTarjetaCashbackMayoreo } from "@/firebase/callables";
import {
  AVISO_CASHBACK,
  URL_CASHBACK_PRODUCCION,
  ganadoCentavos,
  pesosDeCentavos,
  saldoVigenteCentavos,
  textoAperturaCuenta,
  textoVigencia,
  validarConfigCashback,
  type CuentaCashbackMayoreo,
  type MovimientoCashbackMayoreo,
  type UnidadVigencia,
} from "@shared";

const fecha = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(iso))
    : "—";

const ATAJOS: Array<{ label: string; cantidad: number; unidad: UnidadVigencia }> = [
  { label: "10 días", cantidad: 10, unidad: "dias" },
  { label: "1 mes", cantidad: 1, unidad: "meses" },
  { label: "1 año", cantidad: 1, unidad: "anios" },
];

/**
 * Cashback de mayoreo (propio de la tienda, sin amise.mx): configuración
 * (activo, % y vigencia) y las cuentas de los clientes.
 */
export function CashbackMayoreoPage() {
  return (
    <div className="container max-w-5xl space-y-6 py-6">
      <div className="flex items-center gap-2">
        <HandCoins className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cashback mayoreo</h1>
          <p className="text-sm text-muted-foreground">
            Solo en las cajas de sucursales de mayoreo. Página del cliente:{" "}
            <a className="underline" href={URL_CASHBACK_PRODUCCION} target="_blank" rel="noreferrer">
              {URL_CASHBACK_PRODUCCION.replace("https://", "")}
            </a>
          </p>
        </div>
      </div>
      <Configuracion />
      <Cuentas />
    </div>
  );
}

function Configuracion() {
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { config, existe, loading } = useConfigCashbackMayoreo();
  const [activo, setActivo] = useState(false);
  const [pct, setPct] = useState("3");
  const [cantidad, setCantidad] = useState("1");
  const [unidad, setUnidad] = useState<UnidadVigencia>("meses");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (!config || cargado) return;
    setActivo(existe && config.activo);
    setPct(String(config.pct));
    setCantidad(String(config.vigencia.cantidad));
    setUnidad(config.vigencia.unidad);
    setCargado(true);
  }, [config, existe, cargado]);

  const borrador = { pct: Number(pct), vigencia: { cantidad: Number(cantidad), unidad } };
  const error = validarConfigCashback(borrador);

  async function guardar() {
    if (!negocioId || error) return;
    setGuardando(true);
    setMsg(null);
    try {
      await guardarConfigCashbackMayoreo(
        negocioId,
        { activo, ...borrador },
        user?.user.email ?? user?.user.uid ?? "admin",
      );
      setMsg({ ok: true, texto: "Guardado. Las cajas de mayoreo lo toman al momento." });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">Configuración</h2>
      <label className="flex items-start gap-2">
        <Checkbox className="mt-0.5" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        <span className="text-sm">
          Programa activo
          <span className="block text-[11px] text-muted-foreground">
            Apagado, las cajas no abren cuentas ni acumulan; los clientes sí pueden ver su saldo.
          </span>
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cb-pct">% de cada compra que gana el cliente</Label>
          <Input id="cb-pct" type="number" inputMode="decimal" min="0" step="any" value={pct}
            onChange={(e) => setPct(e.target.value)} className="max-w-[10rem]" />
          <p className="text-[11px] text-muted-foreground">
            Con {pct || 0} %, una compra de $1,000 da {pesosDeCentavos(ganadoCentavos(1000, Number(pct)))}.
            Solo cuenta lo que paga con dinero.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-vig">Vigencia del saldo (sin comprar)</Label>
          <div className="flex gap-2">
            <Input id="cb-vig" type="number" inputMode="numeric" min="1" step="1" value={cantidad}
              onChange={(e) => setCantidad(e.target.value)} className="w-24" />
            <select
              className="h-10 rounded-md border bg-background px-2 text-sm"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as UnidadVigencia)}
              aria-label="Unidad de la vigencia"
            >
              <option value="dias">días</option>
              <option value="meses">meses</option>
              <option value="anios">años</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ATAJOS.map((a) => (
              <Button key={a.label} type="button" variant="outline" size="sm"
                onClick={() => { setCantidad(String(a.cantidad)); setUnidad(a.unidad); }}>
                {a.label}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cada compra renueva la fecha. Además, cada 1 de enero el saldo vuelve a $0. Un cambio
            aplica desde la siguiente compra de cada cliente.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{msg.texto}</p>}
      <Button onClick={guardar} disabled={guardando || !!error}>
        {guardando ? "Guardando…" : "Guardar configuración"}
      </Button>

      <details className="rounded-md border bg-muted/20 p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Lo que la caja le lee al cliente al abrir su cuenta ({textoVigencia(borrador.vigencia)})
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {textoAperturaCuenta(error ? { pct: 3, vigencia: { cantidad: 1, unidad: "meses" } } : borrador).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        <p className="mt-3 font-medium">Aviso de privacidad y condiciones (también en la página):</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
          {AVISO_CASHBACK.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </details>
    </section>
  );
}

function Cuentas() {
  const { cuentas, loading } = useCuentasCashbackMayoreo();
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const ahora = Date.now();
  // Solo se cargan las más recientes; con el teléfono completo se busca la
  // cuenta aunque sea vieja.
  const digitos = q.replace(/\D/g, "");
  const telCompleto =
    digitos.length === 10 && !cuentas.some((c) => c.telefono === digitos) ? digitos : null;
  const cuentaVieja = useCuentaCashbackPorTelefono(telCompleto ?? (abierta && !cuentas.some((c) => c.telefono === abierta) ? abierta : null));
  const todas = useMemo(
    () => (cuentaVieja && !cuentas.some((c) => c.telefono === cuentaVieja.telefono) ? [cuentaVieja, ...cuentas] : cuentas),
    [cuentas, cuentaVieja],
  );
  const filtradas = useMemo(() => {
    const d = q.replace(/\D/g, "");
    const t = q.trim().toLowerCase();
    return todas.filter((c) =>
      !t || (d && c.telefono.includes(d)) || (c.nombre ?? "").toLowerCase().includes(t));
  }, [todas, q]);
  const cuenta = todas.find((c) => c.telefono === abierta) ?? null;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Cuentas ({cuentas.length})</h2>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Teléfono o nombre" className="pl-8" />
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin cuentas{q ? " con esa búsqueda" : " todavía"}.
          {q && digitos.length !== 10 ? " Aquí están las 300 más recientes: para otra, escribe su teléfono completo." : ""}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3">Teléfono</th>
                <th className="py-1.5 pr-3">Nombre</th>
                <th className="py-1.5 pr-3 text-right">Saldo</th>
                <th className="py-1.5 pr-3">Vence</th>
                <th className="py-1.5 pr-3">Última compra</th>
                <th className="py-1.5">Tarjeta</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.telefono} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setAbierta(c.telefono)}>
                  <td className="py-1.5 pr-3 tabular-nums">{c.telefono}</td>
                  <td className="py-1.5 pr-3">{c.nombre || "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                    {pesosDeCentavos(saldoVigenteCentavos(c, ahora))}
                  </td>
                  <td className="py-1.5 pr-3">{fecha(c.venceISO)}</td>
                  <td className="py-1.5 pr-3">{fecha(c.ultimaCompraISO)}</td>
                  <td className="py-1.5">{c.tarjeta ? `•••${c.tarjeta.slice(-4)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cuenta && <DetalleCuenta cuenta={cuenta} onCerrar={() => setAbierta(null)} />}
    </section>
  );
}

function DetalleCuenta({ cuenta, onCerrar }: { cuenta: CuentaCashbackMayoreo; onCerrar: () => void }) {
  const { negocioId } = useNegocio();
  const [movs, setMovs] = useState<Array<MovimientoCashbackMayoreo & { id: string }> | null>(null);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const saldo = saldoVigenteCentavos(cuenta, Date.now());

  useEffect(() => {
    if (!negocioId) return;
    let vivo = true;
    movimientosCashback(negocioId, cuenta.telefono)
      .then((m) => vivo && setMovs(m))
      .catch((e) => vivo && setMsg({ ok: false, texto: (e as Error).message }));
    return () => { vivo = false; };
  }, [negocioId, cuenta.telefono, cuenta.saldoCentavos, cuenta.tarjeta]);

  async function ajustar() {
    if (!negocioId) return;
    const centavos = Math.round(Number(monto) * 100);
    if (!Number.isFinite(centavos) || centavos === 0) {
      setMsg({ ok: false, texto: "Escribe un monto (con signo − para restar)" });
      return;
    }
    setTrabajando(true);
    setMsg(null);
    try {
      const r = await fnAjustarCashbackMayoreo({ negocioId, telefono: cuenta.telefono, centavos, motivo });
      setMsg({ ok: true, texto: `Listo: saldo ${pesosDeCentavos(r.data.saldoCentavos)}` });
      setMonto("");
      setMotivo("");
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setTrabajando(false);
    }
  }

  async function quitarTarjeta() {
    if (!negocioId || !window.confirm("¿Quitar la tarjeta de esta cuenta? Ya no servirá para acumular ni gastar.")) return;
    setTrabajando(true);
    setMsg(null);
    try {
      await fnQuitarTarjetaCashbackMayoreo({ negocioId, telefono: cuenta.telefono });
      setMsg({ ok: true, texto: "Tarjeta quitada" });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/10 p-3" role="region" aria-label="Detalle de la cuenta">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{cuenta.nombre || "Sin nombre"} · {cuenta.telefono}</p>
          <p className="text-sm text-muted-foreground">
            Saldo {pesosDeCentavos(saldo)} · vence {fecha(cuenta.venceISO)} · alta {fecha(cuenta.fechaAltaISO)}
            {cuenta.tarjeta ? ` · tarjeta •••${cuenta.tarjeta.slice(-4)}` : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCerrar} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="cb-monto">Ajustar saldo ($)</Label>
          <Input id="cb-monto" type="number" inputMode="decimal" step="any" placeholder="50 o -50"
            value={monto} onChange={(e) => setMonto(e.target.value)} className="w-32" />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="cb-motivo">Motivo</Label>
          <Input id="cb-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. compensación por falla" />
        </div>
        <Button onClick={ajustar} disabled={trabajando || motivo.trim().length < 3}>Ajustar</Button>
        {cuenta.tarjeta && (
          <Button variant="outline" onClick={quitarTarjeta} disabled={trabajando}>Quitar tarjeta</Button>
        )}
      </div>
      {msg && <p className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{msg.texto}</p>}
      <div>
        <p className="mb-1 text-sm font-medium">Movimientos</p>
        {!movs ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : movs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="divide-y text-sm">
            {movs.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-1">
                <span>
                  {fecha(m.fechaISO)} · {TIPO[m.tipo] ?? m.tipo}
                  {m.tipo === "tarjeta_ligada" && m.tarjetaUltimos4 ? ` •••• ${m.tarjetaUltimos4}` : ""}
                  {m.verificadoCon ? ` (con ${m.verificadoCon})` : ""}
                  {m.estado === "usado" ? " · la venta aún no sube" : ""}
                  {m.automatico ? " · automático" : ""}
                  {m.motivo ? ` — ${m.motivo}` : ""}
                  {m.ventaId ? <span className="text-muted-foreground"> · venta {m.ventaId}</span> : null}
                  {m.nodoId && !m.ventaId ? <span className="text-muted-foreground"> · caja {m.nodoId}</span> : null}
                </span>
                {m.saldoDespuesCentavos !== undefined && (
                  <span className="tabular-nums">
                    {signo(m)}{pesosDeCentavos(Math.abs(m.centavos))}{" "}
                    <span className="text-muted-foreground">→ {pesosDeCentavos(m.saldoDespuesCentavos)}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const TIPO: Record<MovimientoCashbackMayoreo["tipo"], string> = {
  ganado: "Ganó",
  usado: "Usó",
  vencido: "Venció",
  devuelto: "Devuelto",
  ajuste: "Ajuste",
  pin_repuesto: "La caja repuso el PIN",
  tarjeta_ligada: "La caja ligó la tarjeta",
};

function signo(m: MovimientoCashbackMayoreo): string {
  if (m.tipo === "ganado" || m.tipo === "devuelto") return "+";
  if (m.tipo === "usado" || m.tipo === "vencido") return "−";
  return m.centavos < 0 ? "−" : "+";
}

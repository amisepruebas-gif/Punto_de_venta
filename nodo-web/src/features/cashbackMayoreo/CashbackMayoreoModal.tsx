import { useEffect, useRef, useState } from "react";
import { Camera, HandCoins, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/features/ventas/BarcodeScanner";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { imprimirTicket, posDisponible } from "@/lib/pos-bridge";
import {
  fnAbrirCuentaCashbackMayoreo,
  fnBuscarCuentaCashbackMayoreo,
  fnReponerPinCashbackMayoreo,
  fnVincularTarjetaCashbackMayoreo,
  type ConfigCashbackCaja,
} from "@/firebase/callable";
import {
  AVISO_CASHBACK_CORTO,
  ean13Ok,
  enmascararTelefono,
  leerQrCashback,
  normalizarTelefono10,
  pesosDeCentavos,
  textoAperturaCuenta,
} from "@shared";
import { formatearTicketCuentaCashback } from "./ticketCashbackMayoreo";
import { useCashbackMayoreo, type ClienteCbMayoreo } from "./cashbackMayoreoStore";

type Props = {
  /** Lo más que se puede descontar en esta venta (pesos). */
  maxPesos: number;
};

type Pantalla =
  | { tipo: "buscar" }
  | { tipo: "cuenta"; cliente: ClienteCbMayoreo; config: ConfigCashbackCaja }
  | { tipo: "abrir"; telefono: string; config: ConfigCashbackCaja }
  | { tipo: "pin"; cliente: ClienteCbMayoreo; pin: string; titulo: string; config: ConfigCashbackCaja };

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
    : "—";

function mensajeDe(e: unknown): string {
  const m = (e as { message?: string })?.message || "";
  if (!navigator.onLine || /internal|network|failed to fetch|unavailable/i.test(m)) {
    return "Sin internet: el cashback necesita conexión para buscar, abrir cuentas o usar saldo. Acumular sí funciona sin internet si el cliente ya está elegido.";
  }
  return m || "No se pudo completar";
}

/** Lo que llega del lector, la cámara o el teclado → cómo buscar. */
function leerEntrada(texto: string): { qr?: string; tarjeta?: string; telefono?: string } | null {
  const qr = leerQrCashback(texto);
  if (qr) return { qr };
  const d = texto.replace(/\D/g, "");
  if (d.length === 13 && ean13Ok(d)) return { tarjeta: d };
  const tel = normalizarTelefono10(texto);
  if (tel && d.length <= 13) return { telefono: tel };
  return null;
}

/**
 * Cashback de mayoreo en la caja (propio de la tienda, sin amise.mx).
 * Identifica al cliente con su QR, su tarjeta o su teléfono; con QR o
 * tarjeta puede usar saldo. Si el teléfono no tiene cuenta, la abre (con el
 * texto que el encargado le lee al cliente) e imprime el PIN.
 */
export function CashbackMayoreoModal({ maxPesos }: Props) {
  const { modalAbierto, codigoInicial, cerrar, elegir } = useCashbackMayoreo();
  const { sucursal } = useSucursal();
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: "buscar" });
  const [entrada, setEntrada] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camara, setCamara] = useState(false);
  const [usar, setUsar] = useState("");
  const [nombre, setNombre] = useState("");
  const [tarjetaAlta, setTarjetaAlta] = useState("");
  const [leido, setLeido] = useState(false);
  const [tarjetaNueva, setTarjetaNueva] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al abrir: limpio, y si vino un código del buscador, se busca solo.
  useEffect(() => {
    if (!modalAbierto) return;
    setPantalla({ tipo: "buscar" });
    setEntrada(codigoInicial ?? "");
    setError(null);
    setAviso(null);
    setUsar("");
    setNombre("");
    setTarjetaAlta("");
    setLeido(false);
    setTarjetaNueva("");
    setVerificado(false);
    if (codigoInicial) void buscar(codigoInicial);
    else setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAbierto, codigoInicial]);

  if (!modalAbierto) return null;

  async function buscar(texto: string) {
    const ident = leerEntrada(texto);
    if (!ident) {
      setError("Escanea el QR o la tarjeta del cliente, o teclea su teléfono (10 dígitos).");
      return;
    }
    setTrabajando(true);
    setError(null);
    try {
      const r = (await fnBuscarCuentaCashbackMayoreo(ident)).data;
      if (!r.existe) {
        setPantalla({ tipo: "abrir", telefono: r.telefono, config: r.config });
        return;
      }
      const cliente: ClienteCbMayoreo = { ...r, ...(ident.qr ? { qr: ident.qr } : {}), ...(ident.tarjeta ? { tarjeta: ident.tarjeta } : {}) };
      const maxCent = Math.min(r.saldoCentavos, Math.floor(maxPesos) * 100);
      setUsar(r.puedeGastar && maxCent >= 100 ? String(Math.floor(maxCent / 100)) : "");
      setPantalla({ tipo: "cuenta", cliente, config: r.config });
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setTrabajando(false);
    }
  }

  async function imprimir(p: Extract<Pantalla, { tipo: "pin" }>) {
    if (!posDisponible()) {
      setAviso("Sin impresora: dale al cliente el PIN que se ve en pantalla.");
      return;
    }
    const r = await imprimirTicket({
      formato: formatearTicketCuentaCashback({
        titulo: p.titulo,
        nombre: p.cliente.nombre,
        telefono: p.cliente.telefono,
        pin: p.pin,
        pct: p.config.pct,
        vigencia: p.config.vigencia,
        fecha: new Date().toLocaleString("es-MX"),
        sucursalNombre: sucursal?.nombre,
      }),
    });
    setAviso(r.ok ? "Ticket impreso." : `No se pudo imprimir: ${r.error}. Dale el PIN que se ve en pantalla.`);
  }

  async function abrirCuenta(telefono: string, config: ConfigCashbackCaja) {
    const t = tarjetaAlta.replace(/\D/g, "");
    if (t && !(t.length === 13 && ean13Ok(t))) {
      setError("Código de tarjeta inválido (13 dígitos).");
      return;
    }
    setTrabajando(true);
    setError(null);
    try {
      const r = (await fnAbrirCuentaCashbackMayoreo({
        telefono,
        ...(nombre.trim() ? { nombre: nombre.trim() } : {}),
        ...(t ? { tarjeta: t } : {}),
        leido: true,
      })).data;
      const p = { tipo: "pin" as const, cliente: { ...r.cuenta, ...(t ? { tarjeta: t } : {}) }, pin: r.pin, titulo: "Bienvenido", config };
      setPantalla(p);
      void imprimir(p);
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setTrabajando(false);
    }
  }

  async function reponerPin(cliente: ClienteCbMayoreo, config: ConfigCashbackCaja) {
    setTrabajando(true);
    setError(null);
    try {
      const r = (await fnReponerPinCashbackMayoreo({ telefono: cliente.telefono, verificado: true })).data;
      const p = { tipo: "pin" as const, cliente, pin: r.pin, titulo: "PIN nuevo", config };
      setPantalla(p);
      void imprimir(p);
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setTrabajando(false);
    }
  }

  async function ligarTarjeta(cliente: ClienteCbMayoreo) {
    const t = tarjetaNueva.replace(/\D/g, "");
    if (!(t.length === 13 && ean13Ok(t))) {
      setError("Código de tarjeta inválido (13 dígitos).");
      return;
    }
    setTrabajando(true);
    setError(null);
    try {
      const r = (await fnVincularTarjetaCashbackMayoreo({
        tarjeta: t,
        ...(cliente.qr ? { qr: cliente.qr } : { telefono: cliente.telefono, verificado: true }),
      })).data;
      setAviso(`Tarjeta •••${r.tarjetaUltimos4} ligada a la cuenta.`);
      setTarjetaNueva("");
      setPantalla((p) => (p.tipo === "cuenta" ? { ...p, cliente: { ...p.cliente, tarjetaUltimos4: r.tarjetaUltimos4 } } : p));
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setTrabajando(false);
    }
  }

  const contenido = (() => {
    if (pantalla.tipo === "buscar") {
      return (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void buscar(entrada);
          }}
        >
          <p className="text-sm text-muted-foreground">
            Escanea el QR del cliente (de su página) o su tarjeta. Si no tiene cuenta, teclea su
            teléfono para abrirla.
          </p>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="QR, tarjeta o teléfono"
              aria-label="QR, tarjeta o teléfono del cliente"
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={() => setCamara(true)} aria-label="Escanear con la cámara">
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          <Button type="submit" className="w-full" disabled={trabajando || !entrada.trim()}>
            {trabajando ? "Buscando…" : "Buscar"}
          </Button>
        </form>
      );
    }
    if (pantalla.tipo === "cuenta") {
      const { cliente } = pantalla;
      const maxCent = Math.min(cliente.saldoCentavos, Math.floor(maxPesos) * 100);
      const usarPesos = Math.floor(Number(usar) || 0);
      const usarInvalido = usarPesos < 0 || usarPesos * 100 > maxCent;
      return (
        <div className="space-y-3">
          <div className="rounded-lg bg-lealtad-suave p-3">
            <p className="font-semibold">{cliente.nombre || "Cliente"} · {enmascararTelefono(cliente.telefono)}</p>
            <p className="text-2xl font-bold tabular-nums text-lealtad-texto">{pesosDeCentavos(cliente.saldoCentavos)}</p>
            <p className="text-xs text-muted-foreground">
              {cliente.saldoCentavos > 0 ? `Vence el ${fecha(cliente.venceISO)}` : "Sin saldo por ahora"}
              {cliente.tarjetaUltimos4 ? ` · tarjeta •••${cliente.tarjetaUltimos4}` : ""}
            </p>
          </div>
          {cliente.puedeGastar ? (
            maxCent >= 100 ? (
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="cbm-usar">¿Cuánto usa? (hasta {pesosDeCentavos(Math.floor(maxCent / 100) * 100)})</label>
                <div className="flex gap-2">
                  <Input id="cbm-usar" type="number" inputMode="numeric" min="0" step="1" value={usar}
                    onChange={(e) => setUsar(e.target.value)} className="w-32" />
                  <Button type="button" variant="outline" onClick={() => setUsar(String(Math.floor(maxCent / 100)))}>Todo</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no tiene saldo para usar en esta venta.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Con el teléfono solo acumula. Para usar su saldo, escanea su QR o su tarjeta.
            </p>
          )}
          <div className="grid gap-2">
            {cliente.puedeGastar && usarPesos > 0 && (
              <Button disabled={usarInvalido} onClick={() => elegir(cliente, usarPesos * 100)}>
                Usar {pesosDeCentavos(usarPesos * 100)} y acumular
              </Button>
            )}
            <Button variant={cliente.puedeGastar && usarPesos > 0 ? "outline" : "default"} onClick={() => elegir(cliente, 0)}>
              Solo acumular en esta venta
            </Button>
          </div>
          <details className="rounded-md border p-2 text-sm">
            <summary className="cursor-pointer font-medium">Tarjeta y PIN</summary>
            <div className="mt-2 space-y-3">
              {!cliente.qr && (
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} />
                  Verifiqué al cliente en persona (necesario para ligar tarjeta sin su QR o reponer su PIN)
                </label>
              )}
              <div className="flex gap-2">
                <Input value={tarjetaNueva} onChange={(e) => setTarjetaNueva(e.target.value)} placeholder="Escanea la tarjeta nueva"
                  inputMode="numeric" aria-label="Tarjeta nueva" />
                <Button variant="outline" disabled={trabajando || (!cliente.qr && !verificado) || !tarjetaNueva}
                  onClick={() => void ligarTarjeta(cliente)}>Ligar</Button>
              </div>
              <Button variant="outline" className="w-full" disabled={trabajando || (!cliente.qr && !verificado)}
                onClick={() => void reponerPin(cliente, pantalla.config)}>
                Reponer PIN (olvidó el suyo)
              </Button>
            </div>
          </details>
        </div>
      );
    }
    if (pantalla.tipo === "abrir") {
      return (
        <div className="space-y-3">
          <p className="text-sm">
            <b>{enmascararTelefono(pantalla.telefono)}</b> no tiene cuenta. Para abrirla, léele esto al cliente:
          </p>
          <ol className="max-h-56 list-decimal space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3 pl-7 text-sm">
            {textoAperturaCuenta(pantalla.config).map((t) => <li key={t}>{t}</li>)}
          </ol>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (opcional)" aria-label="Nombre del cliente" />
          <Input value={tarjetaAlta} onChange={(e) => setTarjetaAlta(e.target.value)} placeholder="Tarjeta (opcional, escanéala)"
            inputMode="numeric" aria-label="Tarjeta del cliente" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={leido} onChange={(e) => setLeido(e.target.checked)} />
            Ya se lo leí al cliente y está de acuerdo
          </label>
          <Button className="w-full" disabled={!leido || trabajando} onClick={() => void abrirCuenta(pantalla.telefono, pantalla.config)}>
            {trabajando ? "Abriendo…" : "Abrir cuenta e imprimir PIN"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setPantalla({ tipo: "buscar" })}>Buscar otro</Button>
        </div>
      );
    }
    // PIN (alta o reposición)
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">PIN del cliente para entrar a su página:</p>
        <p className="text-5xl font-bold tracking-[0.3em] tabular-nums">{pantalla.pin}</p>
        <p className="text-xs text-muted-foreground">{AVISO_CASHBACK_CORTO}</p>
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => void imprimir(pantalla)}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir otra vez
          </Button>
          <Button onClick={() => elegir({ ...pantalla.cliente, puedeGastar: false }, 0)}>
            Listo: acumular en esta venta
          </Button>
        </div>
      </div>
    );
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal aria-label="Cashback mayoreo" onClick={cerrar}>
      <div className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HandCoins className="h-5 w-5 text-lealtad" /> Cashback
          </h2>
          <Button variant="ghost" size="sm" onClick={cerrar} aria-label="Cerrar"><X className="h-4 w-4" /></Button>
        </div>
        {contenido}
        {aviso && <p className="text-sm text-cobro-texto">{aviso}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <BarcodeScanner
        open={camara}
        onClose={() => setCamara(false)}
        onDetected={(t) => {
          setCamara(false);
          setEntrada(t);
          void buscar(t);
        }}
      />
    </div>
  );
}

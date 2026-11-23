import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  KeyRound,
  LogOut,
  QrCode,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import QRCode from "qrcode";
import {
  AVISO_CASHBACK,
  pesosDeCentavos,
  pinTrivial,
  textoVigencia,
} from "@shared";
import {
  cambiarPin,
  entrar,
  guardarSesion,
  leerEstado,
  leerQr,
  mensajeError,
  salir,
  sesionGuardada,
  type Estado,
  type Sesion,
} from "./api";

type Vista = "inicio" | "qr" | "pin" | "aviso";

const fechaLarga = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso))
    : "";
const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short" }).format(new Date(iso));

export function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => sesionGuardada());
  const [vista, setVista] = useState<Vista>("inicio");
  const [verAviso, setVerAviso] = useState(false);

  const cambiarSesion = useCallback((s: Sesion | null) => {
    guardarSesion(s);
    setSesion(s);
    setVista("inicio");
  }, []);
  // Tras cambiar el PIN llega otra sesión (las demás se cierran): se guarda
  // sin salir de la pantalla en la que está.
  const sesionNueva = useCallback((s: Sesion) => {
    guardarSesion(s);
    setSesion(s);
  }, []);

  if (!sesion) {
    return verAviso ? (
      <Pantalla titulo="Aviso de privacidad" onAtras={() => setVerAviso(false)}>
        <Aviso />
      </Pantalla>
    ) : (
      <Entrar onEntrar={cambiarSesion} onAviso={() => setVerAviso(true)} />
    );
  }
  return (
    <Cuenta sesion={sesion} vista={vista} setVista={setVista} onSesion={cambiarSesion} onSesionNueva={sesionNueva} />
  );
}

// ---------- Marco ----------

function Pantalla({ titulo, onAtras, children }: { titulo: string; onAtras?: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-2">
        {onAtras && (
          <button onClick={onAtras} className="-ml-2 rounded-full p-2 text-lealtad-texto active:bg-lealtad-suave" aria-label="Atrás">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-lealtad-texto">{titulo}</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
      <p className="mt-8 text-center text-xs text-black/40">
        <Store className="mr-1 inline h-3.5 w-3.5" />
        ¿Algún problema? Acude a la tienda.
      </p>
    </div>
  );
}

function Boton({ children, onClick, tipo = "principal", disabled, type = "button" }: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: "principal" | "suave";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const estilo =
    tipo === "principal"
      ? "bg-gradient-to-r from-lealtad to-[#5b2c75] text-white shadow-lg shadow-lealtad/25"
      : "bg-white text-lealtad-texto ring-1 ring-lealtad-borde";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${estilo}`}>
      {children}
    </button>
  );
}

function Campo(props: { etiqueta: string; value: string; onChange: (v: string) => void; largo: number; pin?: boolean; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-black/70">{props.etiqueta}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value.replace(/\D/g, "").slice(0, props.largo))}
        inputMode="numeric"
        autoComplete={props.pin ? "current-password" : "tel"}
        type={props.pin ? "password" : "tel"}
        autoFocus={props.autoFocus}
        className={`h-14 w-full rounded-2xl border border-lealtad-borde bg-white px-4 text-lg outline-none focus:border-lealtad focus:ring-2 focus:ring-lealtad/20 ${props.pin ? "tracking-[0.5em]" : ""}`}
      />
    </label>
  );
}

// ---------- Entrar ----------

function Entrar({ onEntrar, onAviso }: { onEntrar: (s: Sesion) => void; onAviso: () => void }) {
  const [telefono, setTelefono] = useState("");
  const [pin, setPin] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTrabajando(true);
    setError(null);
    try {
      onEntrar(await entrar({ telefono, pin }));
    } catch (err) {
      setError(mensajeError(err));
      setPin("");
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="AMISE" className="mx-auto h-14 w-auto" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-lealtad-texto">Mi cashback</h1>
        <p className="mt-2 text-black/60">Consulta tu saldo y tu QR para comprar.</p>
      </div>
      <form onSubmit={enviar} className="space-y-4 rounded-3xl bg-white p-6 shadow-xl shadow-lealtad/10">
        <Campo etiqueta="Tu teléfono (10 dígitos)" value={telefono} onChange={setTelefono} largo={10} autoFocus />
        <Campo etiqueta="Tu PIN (viene en tu ticket)" value={pin} onChange={setPin} largo={4} pin />
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <Boton type="submit" disabled={trabajando || telefono.length !== 10 || pin.length !== 4}>
          {trabajando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
      <p className="mt-6 text-center text-sm text-black/50">¿Olvidaste tu PIN? Pídelo en la tienda.</p>
      <button onClick={onAviso} className="mt-3 text-center text-sm font-medium text-lealtad-texto underline underline-offset-4">
        Aviso de privacidad y condiciones
      </button>
    </div>
  );
}

// ---------- Con sesión ----------

function Cuenta({ sesion, vista, setVista, onSesion, onSesionNueva }: {
  sesion: Sesion;
  vista: Vista;
  setVista: (v: Vista) => void;
  onSesion: (s: Sesion | null) => void;
  onSesionNueva: (s: Sesion) => void;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setEstado(await leerEstado({ sesion: sesion.sesion }));
    } catch (e) {
      if ((e as { code?: string })?.code === "functions/unauthenticated") onSesion(null);
      else setError(mensajeError(e));
    }
  }, [sesion.sesion, onSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cerrar() {
    await salir({ sesion: sesion.sesion }).catch(() => {});
    onSesion(null);
  }

  if (vista === "qr") return <MiQr sesion={sesion} onAtras={() => setVista("inicio")} onSesion={onSesion} />;
  if (vista === "pin") {
    return (
      <CambiarPin sesion={sesion} telefono4={estado?.telefono4 ?? ""} onAtras={() => setVista("inicio")}
        onSesion={onSesion} onSesionNueva={onSesionNueva} />
    );
  }
  if (vista === "aviso") {
    return (
      <Pantalla titulo="Aviso de privacidad" onAtras={() => setVista("inicio")}>
        <Aviso />
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo={estado?.nombre ? `Hola, ${estado.nombre.split(" ")[0]}` : "Mi cashback"}>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-marca via-[#5a7fd1] to-lealtad p-6 text-white shadow-xl shadow-lealtad/20">
        <Sparkles className="absolute -right-3 -top-3 h-24 w-24 text-white/15" />
        <p className="text-sm font-medium text-white/80">Tu saldo</p>
        <p className="mt-1 text-5xl font-bold tabular-nums" aria-live="polite">
          {estado ? pesosDeCentavos(estado.saldoCentavos) : "…"}
        </p>
        {estado && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-white/90">
            <CalendarClock className="h-4 w-4" />
            {estado.saldoCentavos > 0 && estado.venceISO
              ? `Vence el ${fechaLarga(estado.venceISO)}`
              : "Compra para empezar a juntar"}
          </p>
        )}
        {estado?.tarjetaUltimos4 && <p className="mt-1 text-xs text-white/70">Tarjeta •••{estado.tarjetaUltimos4}</p>}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Boton onClick={() => setVista("qr")}><QrCode className="h-5 w-5" /> Mi QR</Boton>
        <Boton tipo="suave" onClick={() => setVista("pin")}><KeyRound className="h-5 w-5" /> Cambiar PIN</Boton>
      </div>

      {estado?.config && (
        <section className="rounded-3xl bg-white p-5 text-sm text-black/70 shadow-sm">
          <p className="font-semibold text-lealtad-texto">Cómo funciona</p>
          <ul className="mt-2 space-y-1.5">
            <li>• Ganas el <b>{estado.config.pct} %</b> de lo que pagas con dinero.</li>
            <li>• Muestra tu QR o tu tarjeta al pagar para juntar o usar tu saldo.</li>
            <li>• Vence si pasan <b>{textoVigencia(estado.config.vigencia)}</b> sin comprar.</li>
            <li>• Cada <b>1 de enero</b> el saldo vuelve a $0.</li>
          </ul>
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-lealtad-texto">Lo que has ganado</p>
          <button onClick={() => void cargar()} className="rounded-full p-1.5 text-black/40 active:bg-black/5" aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {!estado ? (
          <p className="mt-3 text-sm text-black/50">Cargando…</p>
        ) : estado.ingresos.length === 0 ? (
          <p className="mt-3 text-sm text-black/50">Aún no tienes compras con cashback.</p>
        ) : (
          <ul className="mt-2 divide-y divide-black/5">
            {estado.ingresos.map((m, i) => (
              <li key={`${m.fechaISO}-${i}`} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-black/60">{fechaCorta(m.fechaISO)}</span>
                <span className="font-semibold tabular-nums text-emerald-600">+{pesosDeCentavos(m.centavos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto flex items-center justify-between pt-2 text-sm">
        <button onClick={() => setVista("aviso")} className="flex items-center gap-1 text-lealtad-texto">
          <ShieldCheck className="h-4 w-4" /> Aviso de privacidad
        </button>
        <button onClick={() => void cerrar()} className="flex items-center gap-1 text-black/50">
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </div>
    </Pantalla>
  );
}

// ---------- QR ----------

async function imagenQr(token: string): Promise<{ url: string; blob: Blob }> {
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, token, { width: 560, margin: 2, errorCorrectionLevel: "M", color: { dark: "#2b1238", light: "#ffffff" } });
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 820;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#6A2F80";
  g.font = "bold 40px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillText("Mi cashback · AMISE", 320, 70);
  g.drawImage(qr, 40, 110);
  g.fillStyle = "#555555";
  g.font = "22px system-ui, sans-serif";
  g.fillText("Muéstralo al pagar para juntar o usar tu saldo.", 320, 715);
  g.fillText("Quien tenga este QR puede usar tu saldo: cuídalo.", 320, 750);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
  return { url: c.toDataURL("image/png"), blob };
}

function MiQr({ sesion, onAtras, onSesion }: { sesion: Sesion; onAtras: () => void; onSesion: (s: Sesion | null) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async (nuevo = false) => {
    setError(null);
    try {
      const r = await leerQr({ sesion: sesion.sesion, ...(nuevo ? { nuevo: true } : {}) });
      if (!r.qr) throw new Error("Tu cuenta no tiene QR todavía. Pídelo en la tienda.");
      setToken(r.qr);
      setImg(await imagenQr(r.qr));
    } catch (e) {
      if ((e as { code?: string })?.code === "functions/unauthenticated") onSesion(null);
      else setError(mensajeError(e));
    }
  }, [sesion.sesion, onSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function compartir() {
    if (!img) return;
    const archivo = new File([img.blob], "mi-cashback-qr.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: "Mi cashback" }).catch(() => {});
    } else {
      setAviso("Tu teléfono no permite compartir desde aquí: usa «Descargar».");
    }
  }

  async function cambiar() {
    if (!window.confirm("¿Cambiar tu QR? El QR anterior dejará de servir.")) return;
    setTrabajando(true);
    await cargar(true);
    setAviso("Listo: tu QR cambió. El anterior ya no sirve.");
    setTrabajando(false);
  }

  return (
    <Pantalla titulo="Mi QR" onAtras={onAtras}>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="rounded-3xl bg-white p-4 shadow-xl shadow-lealtad/10">
        {img ? (
          <img src={img.url} alt="Tu código QR de cashback" className="w-full rounded-2xl" data-qr={token ?? ""} />
        ) : (
          <div className="flex aspect-[640/820] items-center justify-center text-black/40">Cargando…</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <a
          href={img?.url}
          download="mi-cashback-qr.png"
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lealtad to-[#5b2c75] font-semibold text-white shadow-lg shadow-lealtad/25 ${img ? "" : "pointer-events-none opacity-50"}`}
        >
          <Download className="h-5 w-5" /> Descargar
        </a>
        <Boton tipo="suave" onClick={() => void compartir()} disabled={!img}>
          <Share2 className="h-5 w-5" /> Compartir
        </Boton>
      </div>
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Quien tenga tu QR puede usar tu saldo. No lo publiques. Si crees que alguien más lo tiene, cámbialo.
      </p>
      {aviso && <p className="text-sm text-emerald-700">{aviso}</p>}
      <Boton tipo="suave" onClick={() => void cambiar()} disabled={trabajando}>
        <RefreshCw className="h-5 w-5" /> Cambiar mi QR
      </Boton>
    </Pantalla>
  );
}

// ---------- PIN ----------

function CambiarPin({ sesion, telefono4, onAtras, onSesion, onSesionNueva }: {
  sesion: Sesion;
  telefono4: string;
  onAtras: () => void;
  onSesion: (s: Sesion | null) => void;
  onSesionNueva: (s: Sesion) => void;
}) {
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [otraVez, setOtraVez] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nuevo !== otraVez) return setError("El PIN nuevo no coincide en los dos campos.");
    if (pinTrivial(nuevo, `000000${telefono4}`)) {
      return setError("Elige 4 dígitos difíciles de adivinar: nada de 1234, 0000, años ni los últimos 4 de tu teléfono.");
    }
    setTrabajando(true);
    try {
      const s = await cambiarPin({ sesion: sesion.sesion, pinActual: actual, pinNuevo: nuevo });
      setListo(true);
      onSesionNueva(s);
    } catch (err) {
      if ((err as { code?: string })?.code === "functions/unauthenticated") onSesion(null);
      else setError(mensajeError(err));
    } finally {
      setTrabajando(false);
    }
  }

  if (listo) {
    return (
      <Pantalla titulo="Cambiar PIN" onAtras={onAtras}>
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="mt-3 text-lg font-semibold">Tu PIN cambió</p>
          <p className="mt-1 text-sm text-black/60">Usa el nuevo la próxima vez. Se cerraron tus otras sesiones.</p>
        </div>
        <Boton onClick={onAtras}>Volver</Boton>
      </Pantalla>
    );
  }

  return (
    <Pantalla titulo="Cambiar PIN" onAtras={onAtras}>
      <form onSubmit={enviar} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
        <Campo etiqueta="PIN actual" value={actual} onChange={setActual} largo={4} pin autoFocus />
        <Campo etiqueta="PIN nuevo" value={nuevo} onChange={setNuevo} largo={4} pin />
        <Campo etiqueta="PIN nuevo otra vez" value={otraVez} onChange={setOtraVez} largo={4} pin />
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        <Boton type="submit" disabled={trabajando || actual.length !== 4 || nuevo.length !== 4 || otraVez.length !== 4}>
          {trabajando ? "Guardando…" : "Cambiar PIN"}
        </Boton>
      </form>
    </Pantalla>
  );
}

// ---------- Aviso ----------

function Aviso() {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-6 text-[15px] leading-relaxed text-black/75 shadow-sm">
      {AVISO_CASHBACK.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </section>
  );
}

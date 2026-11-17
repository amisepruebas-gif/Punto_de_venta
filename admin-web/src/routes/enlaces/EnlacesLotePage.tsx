import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Camera,
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNegocio } from "@/hooks/useNegocio";
import {
  msDeTimestamp,
  useEnlacesLote,
  type EnlaceLoteConId,
} from "@/features/lotes/useEnlacesLote";
import {
  apagarTodosLosEnlaces,
  borrarEnlace,
  crearEnlaceArmar,
  prenderApagarEnlace,
  renombrarEnlace,
  renovarEnlace,
} from "@/features/lotes/loteService";
import { fechaCorta } from "@/features/lotes/loteVista";
import {
  ENLACE_MAX_CANJES,
  ENLACE_RECIBIR_DURACION_MS,
  ENLACE_RECIBIR_VENTANA_MS,
  fechaISO_MX,
} from "@shared";

/** Un enlace de fotos sirve 5 min para entrar + 30 de sesión (35 min desde
 *  que se creó): pasado eso ya no deja hacer nada y no hace falta mostrarlo. */
const VIGENCIA_FOTOS_MS = ENLACE_RECIBIR_VENTANA_MS + ENLACE_RECIBIR_DURACION_MS;

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function horaDeMs(ms: number | null | undefined): string | undefined {
  return ms ? fechaCorta(fechaISO_MX(new Date(ms))) : undefined;
}

/** La hora de ahora, refrescada cada `cada` ms (para lo que vence). */
function useAhora(cada: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(t);
  }, [cada]);
  return ahora;
}

/** Último uso: el que anota la function y, si no está, la sesión más nueva. */
function ultimoUsoMs(e: EnlaceLoteConId): number | null {
  if (e.ultimoUsoMs) return e.ultimoUsoMs;
  const fechas = Object.values(e.sesiones ?? {}).map((s) => Number(s.fechaMs) || 0);
  const max = Math.max(0, ...fechas);
  return max > 0 ? max : null;
}

/** Teléfonos que entraron con la generación actual del enlace. */
function telefonosDentro(e: EnlaceLoteConId): number {
  const sesiones = Object.values(e.sesiones ?? {}).filter((s) => s.gen === e.gen).length;
  return Math.max(sesiones, Number(e.canjes) || 0);
}

/**
 * Accesos por enlace: una URL que deja entrar a un teléfono sin cuenta para
 * armar lotes de envío. Quien tenga la URL entra, así que solo se muestra al
 * crearla (se guarda su huella, no la URL) y cada acceso tiene su apagador.
 * Abajo, los accesos de fotos que abre la caja al recibir un lote.
 */
export function EnlacesLotePage() {
  const { negocioId } = useNegocio();
  const { enlaces, loading, error: errorLista } = useEnlacesLote();
  const ahora = useAhora(30_000);
  const [nombre, setNombre] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrado, setMostrado] = useState<{ titulo: string; url: string } | null>(null);

  const armar = enlaces.filter((e) => e.tipo === "armar");
  const fotos = enlaces.filter((e) => {
    if (e.tipo !== "recibir" || !e.activo) return false;
    const creado = msDeTimestamp(e.creadoEn);
    return creado === null || ahora - creado < VIGENCIA_FOTOS_MS;
  });
  const prendidos = enlaces.filter((e) => e.activo).length;

  async function correr(fn: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(false);
    }
  }

  function crear() {
    if (!negocioId) return;
    void correr(async () => {
      const letras = armar.map((e) => e.letra ?? "").filter(Boolean);
      const { url } = await crearEnlaceArmar(negocioId, nombre, letras);
      setMostrado({ titulo: `Enlace de «${nombre.trim()}»`, url });
      setNombre("");
    });
  }

  function apagarTodos() {
    if (!negocioId) return;
    if (
      !confirm(
        "¿Apagar todos los accesos?\n\nTodos los teléfonos pierden la entrada al instante. Luego los puedes prender uno por uno.",
      )
    ) {
      return;
    }
    void correr(async () => {
      const n = await apagarTodosLosEnlaces(negocioId);
      setAviso(n === 0 ? "No había accesos prendidos" : `Se apagaron ${n} accesos`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Accesos por enlace</h1>
          <p className="text-xs text-muted-foreground">
            Un enlace deja entrar a un teléfono sin cuenta para armar lotes de envío. Quien tenga el
            enlace entra: compártelo solo con quien arma.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={apagarTodos}
          disabled={trabajando || prendidos === 0 || !negocioId}
        >
          <Power className="mr-2 h-4 w-4" /> Apagar todos
        </Button>
      </div>

      {mostrado && <EnlaceMostrado {...mostrado} onCerrar={() => setMostrado(null)} />}

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-muted-foreground" /> Nuevo acceso
        </h2>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            crear();
          }}
        >
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="enl-nombre">Nombre</Label>
            <Input
              id="enl-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Teléfono del taller"
              maxLength={60}
            />
          </div>
          <Button type="submit" disabled={trabajando || !nombre.trim() || !negocioId}>
            {trabajando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Crear enlace
          </Button>
        </form>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {errorLista && (
        <p role="alert" className="text-sm text-destructive">
          No se pudieron leer los accesos: {errorLista}
        </p>
      )}
      {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <KeyRound className="h-4 w-4 text-muted-foreground" /> Para armar lotes ({armar.length})
        </h2>
        {loading && armar.length === 0 && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {!loading && armar.length === 0 && (
          <p className="rounded-md border bg-muted py-6 text-center text-sm text-muted-foreground">
            Aún no hay accesos. Crea el primero arriba.
          </p>
        )}
        {negocioId &&
          armar.map((e) => (
            <TarjetaEnlace
              key={e.id}
              enlace={e}
              negocioId={negocioId}
              onEnlace={(url) => setMostrado({ titulo: `Enlace nuevo de «${e.nombre ?? e.letra}»`, url })}
            />
          ))}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Camera className="h-4 w-4 text-muted-foreground" /> Para fotos de un lote ({fotos.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Los abre la caja al recibir un lote, para tomar fotos con un teléfono. Duran media hora.
        </p>
        {fotos.length === 0 ? (
          <p className="rounded-md border bg-muted py-4 text-center text-sm text-muted-foreground">
            No hay accesos de fotos abiertos.
          </p>
        ) : (
          negocioId &&
          fotos.map((e) => <TarjetaFotos key={e.id} enlace={e} negocioId={negocioId} ahora={ahora} />)
        )}
      </section>
    </div>
  );
}

// ---------- El enlace recién creado (se muestra una sola vez) ----------

function EnlaceMostrado({
  titulo,
  url,
  onCerrar,
}: {
  titulo: string;
  url: string;
  onCerrar: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancel = false;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((s) => !cancel && setSvg(s))
      .catch(() => !cancel && setSvg(null));
    return () => {
      cancel = true;
    };
  }, [url]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles: que lo copien a mano.
      const input = document.getElementById("enlace-mostrado") as HTMLInputElement | null;
      input?.select();
    }
  }

  return (
    <section className="space-y-3 rounded-lg border-2 border-primary/50 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Cópialo o escanéalo ahora: <b>no se vuelve a mostrar</b>. Si lo pierdes, renueva el enlace.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onCerrar} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {svg && (
          <div
            className="mx-auto h-44 w-44 shrink-0 rounded-md bg-white p-1 sm:mx-0"
            // SVG generado localmente por `qrcode` a partir de la URL.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            id="enlace-mostrado"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copiar}>
              {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar enlace"}
            </Button>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Listo, ya lo guardé
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Entra un solo teléfono por enlace. Ábrelo en el teléfono de quien va a armar.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------- Un acceso para armar ----------

function Apagador({
  activo,
  disabled,
  onCambiar,
}: {
  activo: boolean;
  disabled?: boolean;
  onCambiar: (activo: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        activo
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`relative inline-block h-4 w-7 rounded-full transition ${activo ? "bg-emerald-600" : "bg-muted-foreground/40"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${activo ? "left-3.5" : "left-0.5"}`}
        />
      </span>
      {activo ? "Prendido" : "Apagado"}
    </button>
  );
}

function TarjetaEnlace({
  enlace,
  negocioId,
  onEnlace,
}: {
  enlace: EnlaceLoteConId;
  negocioId: string;
  onEnlace: (url: string) => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(enlace.nombre ?? "");

  const dentro = telefonosDentro(enlace);
  const max = ENLACE_MAX_CANJES.armar;
  const ultimoUso = horaDeMs(ultimoUsoMs(enlace));
  const nombreVisible = enlace.nombre || `Acceso ${enlace.letra ?? ""}`;

  async function correr(fn: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setTrabajando(false);
    }
  }

  function renovar() {
    if (
      !confirm(
        `¿Renovar el enlace de «${nombreVisible}»?\n\nEl enlace de ahora deja de servir y el teléfono que ya entró se queda fuera. Sus lotes se quedan igual.`,
      )
    ) {
      return;
    }
    void correr(async () => {
      const { url } = await renovarEnlace(negocioId, enlace.id);
      onEnlace(url);
    });
  }

  function borrar() {
    if (
      !confirm(
        `¿Borrar el acceso «${nombreVisible}»?\n\nEl teléfono pierde la entrada. Sus lotes se quedan.`,
      )
    ) {
      return;
    }
    void correr(() => borrarEnlace(negocioId, enlace.id));
  }

  function guardarNombre() {
    void correr(async () => {
      await renombrarEnlace(negocioId, enlace.id, nombre);
      setEditando(false);
    });
  }

  return (
    <div className={`space-y-2 rounded-lg border bg-card p-4 ${enlace.activo ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-lg font-bold text-primary"
          title="Letra del acceso: va en el código de sus lotes"
        >
          {enlace.letra ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          {editando ? (
            <form
              className="flex gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                guardarNombre();
              }}
            >
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                autoFocus
                className="h-9"
              />
              <Button type="submit" size="sm" disabled={trabajando || !nombre.trim()}>
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditando(false);
                  setNombre(enlace.nombre ?? "");
                }}
              >
                Cancelar
              </Button>
            </form>
          ) : (
            <p className="truncate font-medium">{nombreVisible}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {dentro === 0
              ? "Nadie ha entrado con este enlace"
              : `${dentro === 1 ? "Entró 1 teléfono" : `Entraron ${dentro} teléfonos`} (de ${max})`}
            {ultimoUso ? ` · Último uso: ${ultimoUso}` : ""}
          </p>
          {dentro >= max && (
            <p className="text-xs text-muted-foreground">
              Para que entre otro teléfono, renueva el enlace.
            </p>
          )}
        </div>
        <Apagador
          activo={enlace.activo}
          disabled={trabajando}
          onCambiar={(activo) => void correr(() => prenderApagarEnlace(negocioId, enlace.id, activo))}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={renovar} disabled={trabajando}>
          <RefreshCw className="mr-2 h-4 w-4" /> Renovar enlace
        </Button>
        {!editando && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setNombre(enlace.nombre ?? "");
              setEditando(true);
            }}
            disabled={trabajando}
          >
            <Pencil className="mr-2 h-4 w-4" /> Renombrar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={borrar}
          disabled={trabajando}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Borrar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ---------- Un acceso de fotos ----------

function TarjetaFotos({
  enlace,
  negocioId,
  ahora,
}: {
  enlace: EnlaceLoteConId;
  negocioId: string;
  ahora: number;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creado = msDeTimestamp(enlace.creadoEn);
  const dentro = telefonosDentro(enlace);
  const paraEntrar = creado === null ? null : creado + ENLACE_RECIBIR_VENTANA_MS - ahora;

  async function apagar() {
    setTrabajando(true);
    setError(null);
    try {
      await prenderApagarEnlace(negocioId, enlace.id, false);
    } catch (e) {
      setError(mensaje(e));
      setTrabajando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      <Camera className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Fotos del lote <span className="font-mono">{enlace.resurtidoId ?? "—"}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Abierto {horaDeMs(creado) ?? "ahora"} ·{" "}
          {dentro === 0
            ? "nadie ha entrado"
            : `${dentro} de ${ENLACE_MAX_CANJES.recibir} teléfonos`}
          {paraEntrar !== null &&
            (paraEntrar > 0
              ? ` · quedan ${Math.ceil(paraEntrar / 60_000)} min para entrar`
              : " · ya no deja entrar teléfonos nuevos")}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={apagar} disabled={trabajando}>
        {trabajando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
        Apagar
      </Button>
    </div>
  );
}

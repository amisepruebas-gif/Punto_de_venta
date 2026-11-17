import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Camera, CheckCircle2, Clock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tiempoRestanteMs, type SesionEnlace } from "@/firebase/enlaceApp";
import { useEnlace } from "@/features/enlace/EnlaceContext";
import {
  NOTA_MAX,
  fotosRestantes,
  prepararFoto,
  subirFotoLote,
  type FotoPreparada,
} from "@/features/enlace/fotosService";
import { Aviso, AvisoError, BotonGrande, Cargando, Pantalla } from "@/features/enlace/ui";

type Subida = { fotoId: string; url: string; nota: string };

function textoRestante(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min >= 1) return `Te quedan ${min} min`;
  return "Te queda menos de 1 min";
}

/** Fotos de un lote (enlace de fotos, el QR de la caja). */
export function FotosPage() {
  const { base, sesion } = useEnlace();
  if (!sesion) return <Navigate to={base} replace />;
  if (sesion.tipo !== "recibir") return <Navigate to={`${base}/lotes`} replace />;
  return <Fotos sesion={sesion} />;
}

function Fotos({ sesion: s }: { sesion: SesionEnlace }) {
  const [restante, setRestante] = useState(() => tiempoRestanteMs(s));
  const [preparando, setPreparando] = useState(false);
  const [foto, setFoto] = useState<(FotoPreparada & { url: string }) | null>(null);
  const [nota, setNota] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [quedan, setQuedan] = useState(() => fotosRestantes(s));
  const input = useRef<HTMLInputElement>(null);

  // El reloj: cuenta con la hora del servidor, no con la del teléfono.
  useEffect(() => {
    const t = setInterval(() => setRestante(tiempoRestanteMs(s)), 10_000);
    return () => clearInterval(t);
  }, [s]);

  // Las vistas previas son URLs locales: se liberan al salir.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const vencido = restante <= 0;

  async function elegida(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparando(true);
    try {
      const p = await prepararFoto(file);
      const url = URL.createObjectURL(p.blob);
      urls.current.push(url);
      setFoto({ ...p, url });
    } catch (e) {
      setError(e);
    } finally {
      setPreparando(false);
      // Para poder elegir la misma foto otra vez.
      if (input.current) input.current.value = "";
    }
  }

  async function subir() {
    if (!foto) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await subirFotoLote(s, foto, nota);
      setSubidas((prev) => [{ fotoId: r.fotoId, url: foto.url, nota: nota.trim() }, ...prev]);
      setFoto(null);
      setNota("");
      setQuedan(fotosRestantes(s));
    } catch (e) {
      setError(e);
    } finally {
      setSubiendo(false);
      setRestante(tiempoRestanteMs(s));
    }
  }

  const titulo = s.folio ?? s.resurtidoId ?? "Lote";

  return (
    <Pantalla
      titulo={
        <>
          Fotos del lote <span className="font-mono">{titulo}</span>
        </>
      }
      subtitulo={s.sucursalDestinoNombre ? `→ ${s.sucursalDestinoNombre}` : undefined}
    >
      {vencido ? (
        <Aviso tono="mal">
          <p className="text-lg font-semibold">Se acabó el tiempo.</p>
          <p>Pide otro código en la caja.</p>
        </Aviso>
      ) : (
        <p className="flex items-center gap-2 text-lg font-medium" role="timer" aria-live="polite">
          <Clock className="h-5 w-5" /> {textoRestante(restante)}
        </p>
      )}

      {!vencido && quedan <= 0 && (
        <Aviso tono="ojo">Ya subiste el máximo de fotos desde este teléfono.</Aviso>
      )}

      {!vencido && quedan > 0 && !foto && (
        <>
          {/* El input va dentro del label: en iPhone y Android abre la cámara. */}
          <label
            className={`flex h-24 w-full cursor-pointer items-center justify-center gap-3 rounded-md bg-primary text-xl font-medium text-primary-foreground active:bg-primary/90 ${
              preparando ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Camera className="h-8 w-8" />
            {preparando ? "Preparando…" : "Tomar foto"}
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Tomar foto"
              className="sr-only"
              disabled={preparando}
              onChange={(e) => elegida(e.target.files?.[0])}
            />
          </label>
          {preparando && <Cargando texto="Preparando la foto…" />}
        </>
      )}

      {!vencido && foto && (
        <section className="space-y-3">
          <img
            src={foto.url}
            alt="Foto por subir"
            className="max-h-80 w-full rounded-md border bg-muted object-contain"
          />
          <label className="block space-y-1">
            <span className="text-base font-medium">Nota (opcional)</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, NOTA_MAX))}
              aria-label="Nota (opcional)"
              placeholder="Ej.: la caja llegó golpeada"
              maxLength={NOTA_MAX}
              rows={2}
              className="w-full rounded-md border border-input bg-background p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <BotonGrande onClick={subir} disabled={subiendo}>
            <Upload className="mr-2 h-6 w-6" />
            {subiendo ? "Subiendo…" : "Subir"}
          </BotonGrande>
          <Button
            variant="ghost"
            className="h-12 w-full text-base"
            onClick={() => {
              setFoto(null);
              setError(null);
            }}
            disabled={subiendo}
          >
            Tomar otra en su lugar
          </Button>
        </section>
      )}

      {!!error && <AvisoError error={error} onReintentar={foto && !vencido ? subir : undefined} />}

      {subidas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">
            Subiste {subidas.length} {subidas.length === 1 ? "foto" : "fotos"}
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {subidas.map((f) => (
              <li key={f.fotoId} className="overflow-hidden rounded-md border bg-card">
                <img src={f.url} alt={f.nota || "Foto subida"} className="aspect-square w-full object-cover" />
                <p className="flex items-center gap-1 p-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate">{f.nota || "Subida"}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Pantalla>
  );
}

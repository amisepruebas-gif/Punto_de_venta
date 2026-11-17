import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type MensajeEscaner = { tono: "bien" | "mal" | "info"; texto: string };

type Props = {
  open: boolean;
  titulo: string;
  /** Qué escanear, en una línea ("Escanea la etiqueta de la caja"). */
  ayuda?: string;
  /** Texto del campo para teclear el código: es su `aria-label` y su
   *  `placeholder` (en las pruebas se teclea aquí). */
  etiquetaCampo: string;
  /** Teclado del campo: las etiquetas son solo números; los artículos
   *  pueden ser `v-102-AAA`. */
  teclado?: "numeric" | "text";
  /** Para escanear una etiqueta tras otra: muestra "Terminar". En los dos
   *  modos la misma lectura no se repite mientras siga frente a la cámara. */
  continuo?: boolean;
  /** Resultado de la última lectura, lo pone quien usa el escáner. */
  mensaje?: MensajeEscaner | null;
  /** Mientras se guarda lo último leído no se acepta otra lectura. */
  ocupado?: boolean;
  /** Algo bajo el mensaje (por ejemplo "Llevas 3"). */
  pie?: React.ReactNode;
  onCodigo: (codigo: string) => void;
  onClose: () => void;
};

/** Misma lectura repetida: se ignora si se vio hace menos de esto. */
const REPETIDA_MS = 1500;

type Detector = new (opts: { formats: string[] }) => {
  detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

function mensajeDeCamara(e: unknown): string {
  const nombre = (e as { name?: string })?.name ?? "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "No hay permiso para usar la cámara. Escribe el código abajo.";
  }
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "No se encontró la cámara. Escribe el código abajo.";
  }
  if (nombre === "NotReadableError") {
    return "Otra app está usando la cámara. Ciérrala o escribe el código abajo.";
  }
  return "No se pudo abrir la cámara. Escribe el código abajo.";
}

/**
 * Escáner de códigos con la cámara, copiado de nodo-web
 * (`features/ventas/BarcodeScanner.tsx`): usa `BarcodeDetector` (Chrome
 * Android) y cae a `@zxing/browser` (iPhone y el resto), importado solo
 * cuando hace falta. Añade:
 *   - modo continuo, para escanear una etiqueta tras otra sin cerrar;
 *   - un campo para teclear el código, siempre visible: sirve cuando la
 *     cámara no abre (navegador interno de WhatsApp, sin permiso) o la
 *     etiqueta está maltratada.
 */
export function EscanerCodigo({
  open,
  titulo,
  ayuda,
  etiquetaCampo,
  teclado = "numeric",
  continuo = false,
  mensaje,
  ocupado = false,
  pie,
  onCodigo,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [camaraLista, setCamaraLista] = useState(false);
  const [tecleado, setTecleado] = useState("");

  // Refs para que el efecto de la cámara no dependa de props que cambian en
  // cada render (si no, se reiniciaría el video con cada lectura).
  const onCodigoRef = useRef(onCodigo);
  const ocupadoRef = useRef(ocupado);
  useEffect(() => {
    onCodigoRef.current = onCodigo;
    ocupadoRef.current = ocupado;
  }, [onCodigo, ocupado]);

  const ultimaRef = useRef<{ valor: string; ts: number }>({ valor: "", ts: 0 });

  useEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | null = null;
    let cancelado = false;
    setErrorCamara(null);
    setCamaraLista(false);
    ultimaRef.current = { valor: "", ts: 0 };

    /** Una lectura de la cámara. La cámara no se apaga aquí: quien usa el
     *  escáner lo cierra cuando acepta el código (si lo rechaza, por ejemplo
     *  una etiqueta ya usada, se puede escanear otra sin volver a abrir). */
    const leer = (crudo: string) => {
      const valor = crudo.trim();
      if (!valor) return;
      const ahora = Date.now();
      const ultima = ultimaRef.current;
      if (valor === ultima.valor && ahora - ultima.ts < REPETIDA_MS) {
        // Sigue frente a la cámara: se recorre el plazo para no repetirla.
        ultima.ts = ahora;
        return;
      }
      if (ocupadoRef.current) return;
      ultimaRef.current = { valor, ts: ahora };
      try {
        navigator.vibrate?.(60);
      } catch {
        /* sin vibración */
      }
      onCodigoRef.current(valor);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setErrorCamara(
            "Este navegador no abre la cámara. Escribe el código abajo o abre el enlace en Chrome o Safari.",
          );
          return;
        }
        const BD = (globalThis as unknown as { BarcodeDetector?: Detector }).BarcodeDetector;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        // Si se cerró mientras se esperaba algo, la cámara se apaga aquí: el
        // `cleanup` del efecto ya corrió y no la alcanzó.
        const apagar = () => stream.getTracks().forEach((t) => t.stop());
        if (cancelado) return apagar();
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        if (cancelado) return apagar();
        setCamaraLista(true);

        if (BD) {
          const detector = new BD({
            formats: ["code_128", "ean_13", "ean_8", "code_39", "qr_code"],
          });
          let running = true;
          const tick = async () => {
            if (!running || !videoRef.current) return;
            try {
              const res = await detector.detect(videoRef.current);
              const first = res[0];
              if (first?.rawValue) leer(first.rawValue);
            } catch {
              /* un cuadro que falla de vez en cuando: seguir */
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          cleanup = () => {
            running = false;
            apagar();
          };
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelado) return apagar();
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(stream, videoRef.current!, (result) => {
            if (result) leer(result.getText());
          });
          cleanup = () => {
            controls.stop();
            apagar();
          };
          if (cancelado) cleanup();
        }
      } catch (e) {
        if (!cancelado) setErrorCamara(mensajeDeCamara(e));
      }
    })();

    return () => {
      cancelado = true;
      if (cleanup) cleanup();
    };
  }, [open]);

  useEffect(() => {
    if (!open) setTecleado("");
  }, [open]);

  if (!open) return null;

  function enviar(e: FormEvent) {
    e.preventDefault();
    const valor = tecleado.trim();
    if (!valor || ocupado) return;
    setTecleado("");
    onCodigo(valor);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <header className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{titulo}</h2>
          {ayuda && <p className="text-sm opacity-75">{ayuda}</p>}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-12 w-12 shrink-0 text-white hover:bg-white/20"
          onClick={onClose}
          aria-label="Cerrar escáner"
        >
          <X className="h-7 w-7" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-4/5 max-w-sm rounded-lg border-2 border-white/70" />
        </div>
        {!camaraLista && !errorCamara && (
          <p className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="h-4 w-4 animate-spin" /> Abriendo la cámara…
          </p>
        )}
        {errorCamara && (
          <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-md bg-black/70 p-3 text-center text-sm text-white">
            {errorCamara}
          </p>
        )}
      </div>

      <div className="space-y-2 bg-background p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
        {(mensaje || ocupado) && (
          <p
            role="status"
            className={`flex items-start gap-2 rounded-md p-2 text-base font-medium ${
              ocupado
                ? "bg-muted text-foreground"
                : mensaje?.tono === "bien"
                  ? "bg-emerald-500/15 text-emerald-800"
                  : mensaje?.tono === "mal"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-foreground"
            }`}
          >
            {ocupado ? (
              <>
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                {mensaje?.tono === "bien" && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
                {mensaje?.tono === "mal" && <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <span>{mensaje?.texto}</span>
              </>
            )}
          </p>
        )}
        {pie}
        <form onSubmit={enviar} className="flex gap-2">
          <Input
            value={tecleado}
            onChange={(e) => setTecleado(e.target.value)}
            aria-label={etiquetaCampo}
            placeholder={etiquetaCampo}
            inputMode={teclado}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="h-12 text-base"
          />
          <Button type="submit" className="h-12 px-5 text-base" disabled={!tecleado.trim() || ocupado}>
            Usar
          </Button>
        </form>
        {continuo && (
          <Button variant="outline" className="h-12 w-full text-base" onClick={onClose}>
            Terminar
          </Button>
        )}
      </div>
    </div>
  );
}

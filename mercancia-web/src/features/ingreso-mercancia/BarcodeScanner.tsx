import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (texto: string) => void;
};

/**
 * Scanner de códigos de barras para admin-web.
 * Usa la BarcodeDetector API nativa (Chrome/Edge). En navegadores sin
 * soporte (Safari, Firefox) muestra mensaje pidiendo el modo manual.
 *
 * (admin-web no incluye fallback zxing como nodo-web — el supuesto es que
 * se opera desde un escritorio con Chrome o desde un escáner USB que
 * inyecta el codigo como teclado.)
 */
export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | null = null;
    let cancelado = false;

    (async () => {
      try {
        // BarcodeDetector no está en lib.dom estándar — acceder vía globalThis.
        const BD = (
          globalThis as unknown as {
            BarcodeDetector?: new (opts: { formats: string[] }) => {
              detect: (
                v: HTMLVideoElement,
              ) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;
        if (!BD) {
          setError(
            "Tu navegador no soporta BarcodeDetector. Usa un escáner USB que escriba el código como teclado.",
          );
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BD({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code"],
        });
        let running = true;
        const tick = async () => {
          if (!running || !videoRef.current) return;
          try {
            const res = await detector.detect(videoRef.current);
            const first = res[0];
            if (first && first.rawValue) {
              running = false;
              onDetectedRef.current(first.rawValue);
              return;
            }
          } catch {
            /* frame ocasional falla, seguir */
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        cleanup = () => {
          running = false;
          stream.getTracks().forEach((t) => t.stop());
        };
      } catch (e) {
        setError((e as Error).message);
      }
    })();

    return () => {
      cancelado = true;
      if (cleanup) cleanup();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <header className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div>
          <h2 className="text-base font-semibold">Escanear código</h2>
          <p className="text-xs opacity-60">BarcodeDetector nativo</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/20"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="h-6 w-6" />
        </Button>
      </header>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-4/5 max-w-sm rounded-lg border-2 border-primary/70" />
        </div>
      </div>
      {error && (
        <div className="bg-destructive p-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}
    </div>
  );
}

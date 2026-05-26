import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TicketQr } from "@shared";

const MAX_CONTENIDO = 1024;
const MAX_LEYENDA = 60;

export function TicketQrEditor({
  qr,
  onChange,
}: {
  qr: TicketQr | undefined;
  onChange: (qr: TicketQr | undefined) => void;
}) {
  const contenido = qr?.contenido ?? "";
  const leyenda = qr?.leyenda ?? "";

  function setContenido(v: string) {
    if (!v.trim() && !leyenda) {
      onChange(undefined);
      return;
    }
    onChange({ contenido: v, ...(leyenda ? { leyenda } : {}) });
  }

  function setLeyenda(v: string) {
    if (!contenido.trim()) {
      // sin contenido el QR no aplica; ignorar leyenda suelta
      onChange(undefined);
      return;
    }
    onChange({ contenido, ...(v ? { leyenda: v } : {}) });
  }

  function quitar() {
    onChange(undefined);
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Código QR (opcional)</h3>
        </div>
        {qr && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={quitar}
            aria-label="Quitar QR"
          >
            <Trash2 className="mr-1 h-3 w-3" /> Quitar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Se imprime al final del ticket. Si dejas el contenido vacío, no se
        imprime QR.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="qr-contenido">Contenido (URL o texto)</Label>
        <Input
          id="qr-contenido"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="https://maps.app.goo.gl/..."
          maxLength={MAX_CONTENIDO}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qr-leyenda">Leyenda (opcional)</Label>
        <Input
          id="qr-leyenda"
          value={leyenda}
          onChange={(e) => setLeyenda(e.target.value)}
          placeholder="Encuéntranos en Google"
          maxLength={MAX_LEYENDA}
          disabled={!contenido.trim()}
        />
      </div>
    </section>
  );
}

/**
 * Preview en SVG del QR. Render local con la lib `qrcode`. Nunca lanza:
 * si el contenido es inválido o supera la capacidad, devuelve null y se
 * muestra un mensaje en el preview.
 */
export function TicketQrPreview({ qr }: { qr: TicketQr | undefined }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [errorQr, setErrorQr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    if (!qr || !qr.contenido.trim()) {
      setSvg(null);
      setErrorQr(null);
      return;
    }
    QRCode.toString(qr.contenido, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((s) => {
        if (cancel) return;
        setSvg(s);
        setErrorQr(null);
      })
      .catch((e: unknown) => {
        if (cancel) return;
        setSvg(null);
        setErrorQr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancel = true;
    };
  }, [qr]);

  if (!qr || !qr.contenido.trim()) return null;

  if (errorQr) {
    return (
      <div className="space-y-1 pt-2 text-center font-mono text-[9px] text-amber-700">
        <div>(QR no se pudo generar: {errorQr})</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-2">
      {svg && (
        <div
          className="h-24 w-24"
          // svg generado localmente — sin riesgo de XSS (no toma DOM externo).
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {qr.leyenda && (
        <div className="pt-1 text-center font-mono text-[10px] text-zinc-700">
          {qr.leyenda}
        </div>
      )}
    </div>
  );
}

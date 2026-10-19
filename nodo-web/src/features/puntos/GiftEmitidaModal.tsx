import { Button } from "@/components/ui/button";
import { Gift, Copy } from "lucide-react";

export type GiftEmitidaInfo = {
  /** Crédito cargado ($). */
  balance: number;
  /** Código de acceso online EN CLARO (o null si fue reintento). */
  accessCode: string | null;
  /** ¿Se vinculó el barcode físico? Si no, la tarjeta funciona solo online. */
  cardLinked: boolean;
};

type Props = {
  info: GiftEmitidaInfo | null;
  onClose: () => void;
};

const money = (n: number) => "$" + n.toLocaleString("es-MX");

/**
 * Confirma al cajero que la tarjeta de regalo se activó y muestra el CÓDIGO DE
 * ACCESO en claro para entregárselo al cliente. NO se auto-cierra (es una
 * credencial): el cajero la cierra al terminar. Si el barcode no se vinculó, se
 * avisa (la tarjeta funciona online con el código).
 */
export function GiftEmitidaModal({ info, onClose }: Props) {
  if (!info) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Gift className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Tarjeta de regalo activada</h2>
            <p className="text-sm text-muted-foreground">
              Crédito cargado: <strong>{money(info.balance)}</strong>
            </p>
          </div>
        </div>

        {info.accessCode ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Código de acceso — entrégalo al cliente
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <p className="select-all font-mono text-2xl font-bold tracking-[0.2em] text-amber-900">
                {info.accessCode}
              </p>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(info.accessCode ?? "").catch(() => {})
                }
                aria-label="Copiar código"
                className="rounded p-1 text-amber-700 hover:bg-amber-100"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-amber-700">
              Sirve para entrar a amise.mx con su correo.
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            El cliente ya tenía acceso: usa <strong>recuperar código</strong> si lo
            necesita. El crédito quedó cargado.
          </p>
        )}

        {!info.cardLinked && (
          <p className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
            La tarjeta física NO se pudo vincular (código en uso o no válido). El
            crédito quedó en la cuenta del cliente y funciona en línea con su código;
            usa <strong>reponer tarjeta</strong> para ligar un plástico nuevo.
          </p>
        )}

        <Button type="button" className="w-full" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}

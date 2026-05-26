import { Cpu } from "lucide-react";
import { posDisponible, posVersion } from "@/lib/pos-bridge";
import { ImpresoraBluetoothSubcard } from "./ImpresoraBluetoothSubcard";

/**
 * Card raíz de hardware. Solo aparece cuando la app corre dentro de la APK
 * Android Amise POS (window.POS inyectado). En navegadores normales muestra
 * un mensaje informativo.
 *
 * Cada subsección de hardware (impresora BT, USB, cámara…) es un componente
 * propio para que crezca sin saturar este archivo.
 */
export function HardwareCard() {
  const enApk = posDisponible();
  const version = enApk ? posVersion() : null;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Hardware</h3>
        </div>
        {enApk && version && (
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            APK · v{version}
          </span>
        )}
      </div>

      {!enApk ? (
        <p className="text-xs text-muted-foreground">
          Las opciones de hardware (impresora Bluetooth, impresora USB de
          etiquetas, cámara nativa) aparecen cuando esta app corre dentro de
          la APK <strong>Amise POS</strong>. En navegador normal usa los
          fallbacks: PDF para tickets y la cámara web del navegador.
        </p>
      ) : (
        <div className="space-y-3">
          <ImpresoraBluetoothSubcard />
          {/* TODO: <ImpresoraUsbEtiquetasSubcard /> */}
          {/* TODO: <CamaraSubcard /> (configuración default) */}
        </div>
      )}
    </section>
  );
}

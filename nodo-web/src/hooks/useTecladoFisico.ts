import { useEffect, useState } from "react";
import {
  suscribirTecladoFisicoCambio,
  tieneTecladoFisico,
} from "@/lib/pos-bridge";

/**
 * Hook reactivo: `true` si hay teclado físico (USB/Bluetooth) conectado.
 * Lee el estado inicial desde el bridge nativo (`POS.tieneTecladoFisico`)
 * y se actualiza en caliente cuando el APK emite `onTecladoFisicoCambio`
 * desde `MainActivity.onConfigurationChanged` (plug/unplug).
 *
 * En navegador normal sin bridge, siempre retorna `false`.
 *
 * Uso típico — suprimir el IME virtual cuando el cajero usa un teclado
 * USB:
 *   const hayFisico = useTecladoFisico();
 *   <Input inputMode={hayFisico ? "none" : "search"} ... />
 */
export function useTecladoFisico(): boolean {
  const [tiene, setTiene] = useState<boolean>(() => tieneTecladoFisico());

  useEffect(() => {
    return suscribirTecladoFisicoCambio(setTiene);
  }, []);

  return tiene;
}

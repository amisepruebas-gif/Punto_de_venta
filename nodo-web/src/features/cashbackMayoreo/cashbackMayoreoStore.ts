import { useEffect, useState } from "react";
import { create } from "zustand";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNodoSession } from "@/hooks/useNodoSession";
import type { CuentaCashbackMayoreoCaja } from "@/firebase/callable";
import { paths, validarConfigCashback, type ConfigCashbackMayoreo } from "@shared";

/** Cliente de cashback de mayoreo de la venta en curso. `qr`/`tarjeta`: con
 *  cuál se identificó (lo pide el servidor para gastar). Este store no se
 *  guarda en la tablet (el carrito tampoco); pero un cobro con terminal Clip
 *  en curso sí guarda su venta completa, con el QR o la tarjeta, hasta que
 *  termina (para retomarla si la app se recarga). La venta nunca los guarda. */
export type ClienteCbMayoreo = CuentaCashbackMayoreoCaja & { qr?: string; tarjeta?: string };

type Estado = {
  modalAbierto: boolean;
  /** Código escaneado en el buscador (QR o tarjeta) con el que se abrió. */
  codigoInicial: string | null;
  cliente: ClienteCbMayoreo | null;
  /** Saldo que se usa en esta venta (pesos enteros, en centavos). */
  usarCentavos: number;
  abrir: (codigo?: string) => void;
  cerrar: () => void;
  elegir: (cliente: ClienteCbMayoreo, usarCentavos: number) => void;
  /** El carrito cambió: se quita el uso, el cliente se queda para acumular. */
  quitarUso: () => void;
  limpiar: () => void;
};

export const useCashbackMayoreo = create<Estado>()((set) => ({
  modalAbierto: false,
  codigoInicial: null,
  cliente: null,
  usarCentavos: 0,
  abrir: (codigo) => set({ modalAbierto: true, codigoInicial: codigo ?? null }),
  cerrar: () => set({ modalAbierto: false, codigoInicial: null }),
  elegir: (cliente, usarCentavos) =>
    set({ cliente, usarCentavos: Math.max(0, Math.floor(usarCentavos / 100) * 100), modalAbierto: false, codigoInicial: null }),
  quitarUso: () => set({ usarCentavos: 0 }),
  limpiar: () => set({ cliente: null, usarCentavos: 0, modalAbierto: false, codigoInicial: null }),
}));

/** Config del cashback de mayoreo (de la caché si no hay red). `activo` solo
 *  si existe, está prendida y es válida. Solo escucha en cajas de mayoreo. */
export function useConfigCashbackMayoreoCaja(habilitado = true) {
  const { negocioId } = useNodoSession();
  const [config, setConfig] = useState<ConfigCashbackMayoreo | null>(null);
  useEffect(() => {
    if (!negocioId || !habilitado) return;
    return onSnapshot(
      doc(db, paths.configCashbackMayoreo(negocioId)),
      (snap) => setConfig(snap.exists() ? (snap.data() as ConfigCashbackMayoreo) : null),
      (err) => console.warn("config cashback mayoreo:", err),
    );
  }, [negocioId, habilitado]);
  const activo = habilitado && !!config && config.activo === true && !validarConfigCashback(config);
  return { config, activo };
}

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import {
  DEFAULT_CONFIG_CASHBACK,
  fechaISO_MX,
  paths,
  validarConfigCashback,
  type ConfigCashbackMayoreo,
  type CuentaCashbackMayoreo,
  type MovimientoCashbackMayoreo,
} from "@shared";

/** Config del cashback de mayoreo en vivo (con el default si no existe). */
export function useConfigCashbackMayoreo() {
  const { negocioId } = useNegocio();
  const [config, setConfig] = useState<ConfigCashbackMayoreo | null>(null);
  const [existe, setExiste] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    return onSnapshot(
      doc(db, paths.configCashbackMayoreo(negocioId)),
      (snap) => {
        setExiste(snap.exists());
        setConfig(snap.exists() ? (snap.data() as ConfigCashbackMayoreo) : DEFAULT_CONFIG_CASHBACK);
        setLoading(false);
      },
      (err) => {
        console.error("useConfigCashbackMayoreo:", err);
        setLoading(false);
      },
    );
  }, [negocioId]);

  return { config, existe, loading };
}

export async function guardarConfigCashbackMayoreo(
  negocioId: string,
  c: Pick<ConfigCashbackMayoreo, "activo" | "pct" | "vigencia">,
  por: string,
): Promise<void> {
  const error = validarConfigCashback(c);
  if (error) throw new Error(error);
  await setDoc(doc(db, paths.configCashbackMayoreo(negocioId)), {
    activo: c.activo,
    pct: Number(c.pct),
    vigencia: { cantidad: Number(c.vigencia.cantidad), unidad: c.vigencia.unidad },
    actualizadoEn: fechaISO_MX(),
    actualizadoPor: por,
  } satisfies ConfigCashbackMayoreo);
}

/** Cuentas más recientes (por alta). Admin las lee; solo el servidor escribe. */
export function useCuentasCashbackMayoreo(max = 300) {
  const { negocioId } = useNegocio();
  const [cuentas, setCuentas] = useState<CuentaCashbackMayoreo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    return onSnapshot(
      query(collection(db, paths.clientesMayoreoCol(negocioId)), orderBy("fechaAltaISO", "desc"), limit(max)),
      (snap) => {
        setCuentas(snap.docs.map((d) => d.data() as CuentaCashbackMayoreo));
        setLoading(false);
      },
      (err) => {
        console.error("useCuentasCashbackMayoreo:", err);
        setLoading(false);
      },
    );
  }, [negocioId, max]);

  return { cuentas, loading };
}

export async function movimientosCashback(
  negocioId: string,
  telefono: string,
): Promise<Array<MovimientoCashbackMayoreo & { id: string }>> {
  const snap = await getDocs(
    query(collection(db, paths.movimientosCashback(negocioId, telefono)), orderBy("fechaISO", "desc"), limit(100)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as MovimientoCashbackMayoreo) }));
}

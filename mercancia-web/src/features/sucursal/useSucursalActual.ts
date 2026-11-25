import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type Sucursal } from "@shared";

/** Doc de la sucursal a la que está ligado este teléfono (es de lectura
 *  pública: lo puede abrir también el encargado). `cargando` mientras llega
 *  la primera lectura; `sucursal` null si no existe o no se pudo leer. */
export function useSucursalActual(): { sucursal: Sucursal | null; cargando: boolean } {
  const { negocioId, sucursalId } = useNegocio();
  const [sucursal, setSucursal] = useState<Sucursal | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setSucursal(null);
      setCargando(false);
      return;
    }
    setCargando(true);
    return onSnapshot(
      doc(db, paths.sucursal(negocioId, sucursalId)),
      (snap) => {
        setSucursal(snap.exists() ? (snap.data() as Sucursal) : null);
        setCargando(false);
      },
      (err) => {
        console.warn("useSucursalActual:", err);
        setCargando(false);
      },
    );
  }, [negocioId, sucursalId]);

  return { sucursal, cargando };
}

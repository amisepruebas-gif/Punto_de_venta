import { useEffect, useState } from "react";
import { useNegocio } from "@/hooks/useNegocio";
import type { MovimientoExistencias } from "@shared";
import { escucharMovimientos } from "./existenciasService";

/** Últimos movimientos entre bodega y tienda de esta sucursal, en vivo. */
export function useMovimientos() {
  const { negocioId, sucursalId } = useNegocio();
  const [movimientos, setMovimientos] = useState<MovimientoExistencias[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    return escucharMovimientos(
      negocioId,
      sucursalId,
      (m) => {
        setMovimientos(m);
        setError(null);
        setCargando(false);
      },
      (e) => {
        console.error("useMovimientos:", e);
        setError("No se pudieron leer los movimientos.");
        setCargando(false);
      },
    );
  }, [negocioId, sucursalId]);

  return { movimientos, cargando, error };
}

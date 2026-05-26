import { useEffect, useState } from "react";
import { useNodoSession } from "@/hooks/useNodoSession";
import { onApartadosPendientes } from "./apartadoService";
import type { Apartado } from "@shared";

export function useApartadosPendientes() {
  const { negocioId, sucursalId } = useNodoSession();
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !sucursalId) return;
    setLoading(true);
    const unsub = onApartadosPendientes(negocioId, sucursalId, (arr) => {
      setApartados(arr);
      setLoading(false);
    });
    return unsub;
  }, [negocioId, sucursalId]);

  return { apartados, loading };
}

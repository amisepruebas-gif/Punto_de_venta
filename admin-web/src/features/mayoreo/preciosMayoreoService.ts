import { useEffect, useState } from "react";
import { deleteField, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import {
  nivelPrecioValido,
  paths,
  type PrecioMayoreoNivel,
  type PreciosMayoreo,
} from "@shared";

/**
 * Precios de mayoreo por categoría y subcategoría (`datos/_preciosMayoreo`).
 * Es la fuente de la escalera categoría → subcategoría → artículo: al
 * cambiarlos, la function `sincronizarPreciosMayoreo` actualiza los
 * artículos «Solo mayoreo» que los heredan.
 */
export function usePreciosMayoreo(): {
  precios: PreciosMayoreo | null;
  loading: boolean;
} {
  const { negocioId } = useNegocio();
  const [precios, setPrecios] = useState<PreciosMayoreo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, paths.preciosMayoreo(negocioId)),
      (snap) => {
        trackSnapshot(snap);
        setPrecios(snap.exists() ? (snap.data() as PreciosMayoreo) : {});
        setLoading(false);
      },
      (err) => {
        console.error("usePreciosMayoreo error:", err);
        setLoading(false);
      },
    );
  }, [negocioId]);

  return { precios, loading };
}

export type NivelPrecioMayoreo = "categorias" | "subcategorias";

/**
 * Guarda el precio de una categoría o subcategoría. `valor: null` lo quita:
 * la subcategoría vuelve a usar el de su categoría (y una categoría sin
 * precio deja a sus artículos con el último que tenían).
 */
export async function guardarPrecioMayoreo(
  negocioId: string,
  nivel: NivelPrecioMayoreo,
  id: string,
  valor: PrecioMayoreoNivel | null,
): Promise<void> {
  if (!id) throw new Error("Falta la categoría");
  if (valor !== null && !nivelPrecioValido(valor)) {
    throw new Error("El precio de mayoreo y el menudeo no son válidos");
  }
  await setDoc(
    doc(db, paths.preciosMayoreo(negocioId)),
    { [nivel]: { [id]: valor ?? deleteField() } },
    { merge: true },
  );
}

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import {
  paths,
  COL_CATEGORIAS,
  COL_SUBCATEGORIAS,
  type Categoria,
  type Subcategoria,
} from "@shared";

type State = {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  loading: boolean;
};

/**
 * Suscribe a las dos colecciones universales del negocio. Devuelve listas
 * ordenadas alfabéticamente (es-MX) para que las consuma cualquier UI sin
 * tener que reordenar.
 */
export function useCategorias(): State {
  const { negocioId } = useNegocio();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingSub, setLoadingSub] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoadingCat(false);
      setLoadingSub(false);
      return;
    }

    const refCat = collection(db, `${paths.negocio(negocioId)}/${COL_CATEGORIAS}`);
    const unsubCat = onSnapshot(
      refCat,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Categoria[] = [];
        snap.forEach((d) => arr.push(d.data() as Categoria));
        arr.sort((a, b) =>
          (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
        );
        setCategorias(arr);
        setLoadingCat(false);
      },
      (err) => {
        console.error("useCategorias (categorias) error:", err);
        setLoadingCat(false);
      },
    );

    const refSub = collection(
      db,
      `${paths.negocio(negocioId)}/${COL_SUBCATEGORIAS}`,
    );
    const unsubSub = onSnapshot(
      refSub,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const arr: Subcategoria[] = [];
        snap.forEach((d) => arr.push(d.data() as Subcategoria));
        arr.sort((a, b) =>
          (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
        );
        setSubcategorias(arr);
        setLoadingSub(false);
      },
      (err) => {
        console.error("useCategorias (subcategorias) error:", err);
        setLoadingSub(false);
      },
    );

    return () => {
      unsubCat();
      unsubSub();
    };
  }, [negocioId]);

  return {
    categorias,
    subcategorias,
    loading: loadingCat || loadingSub,
  };
}

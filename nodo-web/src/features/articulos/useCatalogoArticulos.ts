import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import {
  COL_NEGOCIOS,
  COL_CATEGORIAS,
  COL_SUBCATEGORIAS,
  COL_GENEROS,
  type CatalogosVigentes,
  type Categoria,
  type Genero,
  type Subcategoria,
} from "@shared";

export type CatalogoArticulos = {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  generos: Genero[];
  nombreCategoria: Map<string, string>;
  nombreSubcategoria: Map<string, string>;
  nombreGenero: Map<string, string>;
  /** Ids vigentes para `clasificacionVigente`. Vacío mientras carga (no se
   *  valida, para no tomar todo como "sin …" un instante). */
  vigentes: CatalogosVigentes;
  loading: boolean;
};

function porNombre<T extends { nombre: string }>(a: T, b: T) {
  return (a.nombre ?? "").localeCompare(b.nombre ?? "", "es");
}

/**
 * Categorías, subcategorías y géneros del negocio para los filtros y el
 * buscador de la caja. Tres colecciones chicas con `onSnapshot`: sin
 * internet salen de la caché de la tablet. Varios componentes pueden usarlo
 * a la vez: el SDK comparte la misma escucha por consulta.
 */
export function useCatalogoArticulos(): CatalogoArticulos {
  const { negocioId } = useNodoSession();
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[] | null>(null);
  const [generos, setGeneros] = useState<Genero[] | null>(null);

  useEffect(() => {
    if (!negocioId) return;
    const escuchar = <T extends { nombre: string }>(
      col: string,
      guardar: (v: T[]) => void,
    ) => {
      const path = `${COL_NEGOCIOS}/${negocioId}/${col}`;
      return onSnapshot(
        collection(db, path),
        { includeMetadataChanges: true },
        (snap) => {
          trackSnapshot(snap, path);
          const arr: T[] = [];
          snap.forEach((d) => arr.push(d.data() as T));
          arr.sort(porNombre);
          guardar(arr);
        },
        (err) => {
          console.error(`useCatalogoArticulos (${col}) error:`, err);
          guardar([]);
        },
      );
    };
    const off = [
      escuchar<Categoria>(COL_CATEGORIAS, setCategorias),
      escuchar<Subcategoria>(COL_SUBCATEGORIAS, setSubcategorias),
      escuchar<Genero>(COL_GENEROS, setGeneros),
    ];
    return () => off.forEach((u) => u());
  }, [negocioId]);

  return useMemo(() => {
    const loading = categorias === null || subcategorias === null || generos === null;
    const cats = categorias ?? [];
    const subs = subcategorias ?? [];
    const gens = generos ?? [];
    return {
      categorias: cats,
      subcategorias: subs,
      generos: gens,
      nombreCategoria: new Map(cats.map((c) => [c.categoriaId, c.nombre])),
      nombreSubcategoria: new Map(subs.map((s) => [s.subcategoriaId, s.nombre])),
      nombreGenero: new Map(gens.map((g) => [g.generoId, g.nombre])),
      vigentes: loading
        ? {}
        : {
            categorias: new Set(cats.map((c) => c.categoriaId)),
            subcategorias: new Set(subs.map((s) => s.subcategoriaId)),
            generos: new Set(gens.map((g) => g.generoId)),
          },
      loading,
    };
  }, [categorias, subcategorias, generos]);
}

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type LoteFoto } from "@shared";
import { msDeTimestamp } from "./useEnlacesLote";

export type FotoLoteVista = LoteFoto & {
  id: string;
  /** Hora de subida en ms (null si el server aún no la escribe). */
  creadoMs: number | null;
  /** `undefined` mientras carga; `null` si no se pudo obtener. */
  url: string | null | undefined;
};

/** Fotos de un lote (las sube el teléfono con un enlace de fotos), en vivo,
 *  con la URL de descarga de cada una. */
export function useFotosLote(loteId: string | null) {
  const { negocioId } = useNegocio();
  const [docs, setDocs] = useState<Array<LoteFoto & { id: string }>>([]);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  // Rutas ya pedidas: cada snapshot trae todas las fotos y no hay que volver
  // a pedir la URL de las que ya estaban.
  const pedidas = useRef(new Set<string>());

  useEffect(() => {
    pedidas.current = new Set();
    setUrls({});
    setDocs([]);
    if (!negocioId || !loteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let vivo = true;
    const unsub = onSnapshot(
      collection(db, paths.loteFotosCol(negocioId, loteId)),
      (snap) => {
        const arr: Array<LoteFoto & { id: string }> = [];
        snap.forEach((d) => arr.push({ ...(d.data() as LoteFoto), id: d.id }));
        setDocs(arr);
        setLoading(false);
        for (const f of arr) {
          if (!f.ruta || pedidas.current.has(f.ruta)) continue;
          pedidas.current.add(f.ruta);
          getDownloadURL(ref(storage, f.ruta))
            .then((url) => vivo && setUrls((u) => ({ ...u, [f.ruta]: url })))
            .catch((e) => {
              console.warn("Foto de lote sin URL:", f.ruta, e);
              if (vivo) setUrls((u) => ({ ...u, [f.ruta]: null }));
            });
        }
      },
      (err) => {
        console.error("useFotosLote:", err);
        setLoading(false);
      },
    );
    return () => {
      vivo = false;
      unsub();
    };
  }, [negocioId, loteId]);

  const fotos: FotoLoteVista[] = docs
    .map((f) => ({
      ...f,
      creadoMs: msDeTimestamp(f.creadoEn),
      url: f.ruta in urls ? urls[f.ruta] : undefined,
    }))
    .sort((a, b) => (a.creadoMs ?? Infinity) - (b.creadoMs ?? Infinity) || a.id.localeCompare(b.id));

  return { fotos, loading };
}

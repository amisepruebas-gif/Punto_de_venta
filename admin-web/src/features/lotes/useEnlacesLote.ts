import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type EnlaceLote } from "@shared";

export type EnlaceLoteConId = EnlaceLote & { id: string };

/** Milisegundos de un Timestamp de Firestore (o `null` mientras el server
 *  todavía no lo escribe: `serverTimestamp()` llega vacío en el primer
 *  snapshot local). */
export function msDeTimestamp(t: unknown): number | null {
  if (t && typeof (t as { toMillis?: unknown }).toMillis === "function") {
    return (t as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Todos los accesos por enlace del negocio (de armar y de fotos), en vivo. */
export function useEnlacesLote() {
  const { negocioId } = useNegocio();
  const [enlaces, setEnlaces] = useState<EnlaceLoteConId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, paths.enlacesLoteCol(negocioId)),
      (snap) => {
        const arr: EnlaceLoteConId[] = [];
        snap.forEach((d) => arr.push({ ...(d.data() as EnlaceLote), id: d.id }));
        // Los de armar por letra (A, B… AA); luego las impresoras por nombre;
        // los de fotos, el más nuevo primero.
        const ORDEN: Record<string, number> = { armar: 0, imprimir: 1, recibir: 2 };
        arr.sort((a, b) => {
          if (a.tipo !== b.tipo) return (ORDEN[a.tipo] ?? 3) - (ORDEN[b.tipo] ?? 3);
          if (a.tipo === "armar") {
            const la = a.letra ?? "";
            const lb = b.letra ?? "";
            return la.length - lb.length || la.localeCompare(lb);
          }
          if (a.tipo === "imprimir") return (a.nombre ?? "").localeCompare(b.nombre ?? "", "es");
          return (msDeTimestamp(b.creadoEn) ?? Infinity) - (msDeTimestamp(a.creadoEn) ?? Infinity);
        });
        setEnlaces(arr);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("useEnlacesLote:", err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { enlaces, loading, error };
}

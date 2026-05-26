import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useNegocio } from "@/features/negocio/useNegocio";
import {
  COL_NEGOCIOS,
  COL_ARTICULOS,
  canonicalStoragePath,
  type Articulo,
} from "@shared";
import { podarCacheImagenes, posDisponible } from "@/lib/pos-bridge";

/**
 * Entrada del índice de búsqueda del POS. Mínima por diseño: contiene solo
 * lo necesario para que el `BuscadorArticulo` filtre por texto y muestre
 * la sugerencia. El resto de la información se lee de `byId` al click.
 */
export type SearchEntry = {
  kind: "articulo";
  /** id 8-dig del padre, usado por byId para localizar el artículo completo. */
  idPadre: string;
  /** Texto a mostrar en la sugerencia. */
  titulo: string;
  /** Lowercase de `titulo + sigla + referencia + etiquetas + nombres/codigos
   *  de subvariaciones` para `String.includes`. Permite encontrar al padre
   *  tipeando el nombre de una variación. */
  blob: string;
  /** True si el padre tiene subvariaciones (POS abre el picker al elegirlo). */
  tieneVariaciones: boolean;
};

type State = {
  articulos: Articulo[];
  byId: Map<string, Articulo>;
  bySigla: Map<string, Articulo>;
  /** Lista plana de items "vendibles" para el autocomplete. Cuando el padre
   *  tiene variaciones, no entra él sino sus variaciones. Cuando no las
   *  tiene, entra el padre. Construida en el mismo onSnapshot que `byId`.
   *  Ordenada ascendente por `idPadre`; las variaciones de un mismo padre
   *  quedan agrupadas en el orden del array embebido. */
  searchIndex: SearchEntry[];
  loading: boolean;
  fromCache: boolean;
};

export function useArticulos(): State {
  const { negocioId } = useNodoSession();
  const { negocio } = useNegocio();
  const usaSubvariacionesV2 = !!negocio?.usaSubvariacionesV2;

  const [state, setState] = useState<State>({
    articulos: [],
    byId: new Map(),
    bySigla: new Map(),
    searchIndex: [],
    loading: true,
    fromCache: true,
  });

  // GC del cache nativo de imágenes — debounced. Cada vez que llega un
  // snapshot estable de Firestore, programamos una poda 5 s después con la
  // lista de paths canónicos vigentes. Si llegan más snapshots dentro de
  // ese ventana, reseteamos el timer (debounce). Esto evita pelearle al
  // WebView durante la primera carga: si la web está descargando imágenes
  // por primera vez, queremos que el GC corra cuando ya no haya tráfico.
  // El timer se cancela en el cleanup del effect principal (cambio de
  // negocioId) y al desmontar — evita que un timer pendiente prune con
  // el catálogo del negocio anterior.
  const podarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!negocioId) return;
    const ref = collection(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_ARTICULOS}`,
    );
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(
          snap,
          `${COL_NEGOCIOS}/${negocioId}/${COL_ARTICULOS}`,
        );
        const arr: Articulo[] = [];
        const byId = new Map<string, Articulo>();
        const bySigla = new Map<string, Articulo>();
        snap.forEach((doc) => {
          const a = doc.data() as Articulo;
          arr.push(a);
          byId.set(a.id, a);
          if (a.sigla) bySigla.set(a.sigla.toLowerCase(), a);
        });
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre));

        // Index del autocomplete — construido aquí mismo (no en useMemo
        // separado) para garantizar que se reconstruye en cada snapshot,
        // incluso cuando solo cambian las variaciones embebidas de un
        // artículo (cambio que no altera arr.length).
        //
        // Nuevo comportamiento (Fase 6): el padre SIEMPRE entra al index,
        // tenga o no variaciones. El blob incluye nombres/códigos de las
        // subvariaciones para que tipear "rojo" encuentre al padre cuya
        // variación se llama "Rojo". El POS abre un picker de variaciones
        // cuando el padre elegido tiene subvariaciones (con V2 activo).
        const ordenIdAsc = [...arr].sort((a, b) => a.id.localeCompare(b.id));
        const searchIndex: SearchEntry[] = [];
        for (const a of ordenIdAsc) {
          const tieneVariaciones = (a.subvariaciones?.length ?? 0) > 0;
          const blobParts: string[] = [
            a.nombre,
            a.sigla ?? "",
            a.id,
            a.referencia ?? "",
            ...(a.etiquetas ?? []),
          ];
          if (tieneVariaciones) {
            for (const sv of a.subvariaciones!) {
              blobParts.push(sv.nombre);
              if (sv.codigo) blobParts.push(sv.codigo);
              if (sv.referencia) blobParts.push(sv.referencia);
            }
          }
          searchIndex.push({
            kind: "articulo",
            idPadre: a.id,
            titulo: a.nombre,
            blob: blobParts.join(" ").toLowerCase(),
            tieneVariaciones: tieneVariaciones && usaSubvariacionesV2,
          });
        }

        setState({
          articulos: arr,
          byId,
          bySigla,
          searchIndex,
          loading: false,
          fromCache: snap.metadata.fromCache,
        });

        // GC del cache nativo de imágenes (solo en APK). Solo disparamos
        // sobre snapshots estables del servidor — ignoramos cache local y
        // writes pendientes para evitar borrar entradas que la web sigue
        // necesitando durante el primer pintado o tras un edit local.
        if (
          posDisponible()
          && !snap.metadata.fromCache
          && !snap.metadata.hasPendingWrites
        ) {
          if (podarTimerRef.current) clearTimeout(podarTimerRef.current);
          const articulosSnapshot = arr;
          podarTimerRef.current = setTimeout(() => {
            podarTimerRef.current = null;
            const paths = recolectarPathsVigentes(articulosSnapshot);
            // Salvaguarda extra (la nativa también la tiene): nunca podar
            // con lista vacía. Catálogo realmente vacío y catálogo aún no
            // cargado se ven igual desde aquí.
            if (paths.length === 0) return;
            const r = podarCacheImagenes(paths);
            if (!r.ok) {
              // No es crítico — el cache simplemente no se poda esta vez.
              console.warn("[useArticulos] podar cache:", r.error);
            }
          }, 5000);
        }
      },
      (err) => {
        console.error("useArticulos error:", err);
        setState((s) => ({ ...s, loading: false }));
      },
    );
    return () => {
      unsub();
      if (podarTimerRef.current) {
        clearTimeout(podarTimerRef.current);
        podarTimerRef.current = null;
      }
    };
  }, [negocioId, usaSubvariacionesV2]);

  return state;
}

/**
 * Convierte la lista actual de artículos en el conjunto de paths Storage
 * canónicos referenciados (principal + cada subvariación). El cache nativo
 * borra cualquier entrada cuyo path no esté aquí.
 */
function recolectarPathsVigentes(articulos: Articulo[]): string[] {
  const paths = new Set<string>();
  for (const a of articulos) {
    if (a.imagenUrl) {
      const p = canonicalStoragePath(a.imagenUrl);
      if (p) paths.add(p);
    }
    if (a.subvariaciones) {
      for (const sv of a.subvariaciones) {
        if (sv.imagenUrl) {
          const p = canonicalStoragePath(sv.imagenUrl);
          if (p) paths.add(p);
        }
      }
    }
  }
  return Array.from(paths);
}

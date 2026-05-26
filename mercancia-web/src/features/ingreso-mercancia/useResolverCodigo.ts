import { useCallback, useMemo } from "react";
import { useArticulos } from "@/features/articulos/useArticulos";
import {
  parseVariacionCodigo,
  type Articulo,
  type ArticuloSubvariacion,
} from "@shared";

export type ResolveResult =
  | {
      ok: true;
      articulo: Articulo;
      subvariacion?: ArticuloSubvariacion;
    }
  | {
      ok: false;
      codigo: string;
      razon:
        | "no-encontrado"
        | "padre-con-variaciones"
        | "subvariacion-no-encontrada";
    };

/**
 * Mismo algoritmo que `nodo-web/useBarcodeBusqueda` pero con propósito
 * distinto: aquí no se agrega al carrito, sino que se devuelve el
 * artículo + subvariación resueltos para que la UI pueda preguntar
 * "¿cuánto sumar al stock?".
 *
 * Diferencias vs POS:
 *   - el padre con variaciones SE RECHAZA siempre (no depende de la
 *     bandera `usaSubvariacionesV2`) — admin debería escanear la variación
 *     específica;
 *   - los códigos `v-NN-XXX` se resuelven siempre.
 *
 * Construye su propio `Map<id, Articulo>` localmente porque el
 * `useArticulos` de admin-web no lo expone (a diferencia de nodo-web).
 */
export function useResolverCodigo() {
  const { articulos } = useArticulos();
  const byId = useMemo(() => {
    const m = new Map<string, Articulo>();
    for (const a of articulos) m.set(a.id, a);
    return m;
  }, [articulos]);

  const resolver = useCallback(
    (codigo: string): ResolveResult => {
      const limpio = codigo.trim();
      if (!limpio) {
        return { ok: false, codigo: limpio, razon: "no-encontrado" };
      }

      // Codigo v-NN-XXX
      if (limpio.startsWith("v-")) {
        const parts = parseVariacionCodigo(limpio);
        if (!parts) {
          return { ok: false, codigo: limpio, razon: "no-encontrado" };
        }
        const padre = byId.get(parts.idPadre);
        if (!padre) {
          return { ok: false, codigo: limpio, razon: "no-encontrado" };
        }
        const sv = padre.subvariaciones?.find(
          (s: ArticuloSubvariacion) => s.codigo === limpio,
        );
        if (!sv) {
          return {
            ok: false,
            codigo: limpio,
            razon: "subvariacion-no-encontrada",
          };
        }
        return { ok: true, articulo: padre, subvariacion: sv };
      }

      // Id 8-dig de un padre
      const padre = byId.get(limpio);
      if (!padre) {
        return { ok: false, codigo: limpio, razon: "no-encontrado" };
      }
      if ((padre.subvariaciones?.length ?? 0) > 0) {
        return { ok: false, codigo: limpio, razon: "padre-con-variaciones" };
      }
      return { ok: true, articulo: padre };
    },
    [byId],
  );

  return { resolver };
}

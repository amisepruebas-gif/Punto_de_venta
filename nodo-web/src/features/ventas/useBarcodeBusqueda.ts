import { useCallback } from "react";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useNegocio } from "@/features/negocio/useNegocio";
import { useCarrito } from "./carritoStore";
import { parseVariacionCodigo, type Articulo } from "@shared";

type Resultado =
  | {
      ok: true;
      articulo: Articulo;
      subvariacionCodigo?: string;
      subvariacionNombre?: string;
    }
  | { ok: false; codigo: string; razon?: "padre-inhabilitado" | "no-encontrado" };

/**
 * Resuelve un código escaneado o tecleado:
 *   - `12300011` → artículo padre por id (rechaza si tiene variaciones y la
 *     bandera `usaSubvariacionesV2` está activa).
 *   - `v-NN-XXX` → reconstruye `idPadre` y busca la subvariación dentro del
 *     array embebido del padre.
 *   - sigla → fallback a `bySigla` (solo aplica al modo legacy o artículos
 *     sin variaciones).
 */
export function useBarcodeBusqueda() {
  const { byId, bySigla } = useArticulos();
  const { negocio } = useNegocio();
  const usaSubvariacionesV2 = !!negocio?.usaSubvariacionesV2;
  const { agregar } = useCarrito();

  const buscar = useCallback(
    (codigo: string): Resultado => {
      const limpio = codigo.trim();

      // 1) ¿Es un código de subvariación `v-NN-XXX`?
      if (limpio.startsWith("v-")) {
        const parts = parseVariacionCodigo(limpio);
        if (!parts) {
          return { ok: false, codigo: limpio, razon: "no-encontrado" };
        }
        const padre = byId.get(parts.idPadre);
        if (!padre) {
          return { ok: false, codigo: limpio, razon: "no-encontrado" };
        }
        const sv = padre.subvariaciones?.find((s) => s.codigo === limpio);
        if (!sv) {
          return { ok: false, codigo: limpio, razon: "no-encontrado" };
        }
        // Aceptado solo cuando la bandera v2 está activa. En modo legacy,
        // los codigos `v-NN-XXX` no son escaneables.
        if (!usaSubvariacionesV2) {
          return { ok: false, codigo: limpio, razon: "no-encontrado" };
        }
        return {
          ok: true,
          articulo: padre,
          subvariacionCodigo: sv.codigo,
          subvariacionNombre: sv.nombre,
        };
      }

      // 2) ¿Es un id 8-dig de un padre?
      const porId = byId.get(limpio);
      if (porId) {
        const tieneVariaciones = (porId.subvariaciones?.length ?? 0) > 0;
        if (tieneVariaciones && usaSubvariacionesV2) {
          return { ok: false, codigo: limpio, razon: "padre-inhabilitado" };
        }
        return { ok: true, articulo: porId };
      }

      // 3) Match por sigla (insensitive). Mismo guard contra padres con
      //    variaciones cuando la bandera v2 está activa.
      const porSigla = bySigla.get(limpio.toLowerCase());
      if (porSigla) {
        const tieneVariaciones = (porSigla.subvariaciones?.length ?? 0) > 0;
        if (tieneVariaciones && usaSubvariacionesV2) {
          return { ok: false, codigo: limpio, razon: "padre-inhabilitado" };
        }
        return { ok: true, articulo: porSigla };
      }

      return { ok: false, codigo: limpio, razon: "no-encontrado" };
    },
    [byId, bySigla, usaSubvariacionesV2],
  );

  const escanear = useCallback(
    (codigo: string): Resultado => {
      const r = buscar(codigo);
      if (r.ok) {
        // Si hay subvariación con imagen propia, la prefiere sobre la del padre.
        const imagenUrl = r.subvariacionCodigo
          ? r.articulo.subvariaciones?.find(
              (s) => s.codigo === r.subvariacionCodigo,
            )?.imagenUrl ?? r.articulo.imagenUrl
          : r.articulo.imagenUrl;
        agregar(r.articulo, {
          subvariacionCodigo: r.subvariacionCodigo,
          subvariacionNombre: r.subvariacionNombre,
          ...(imagenUrl ? { imagenUrl } : {}),
        });
      }
      return r;
    },
    [buscar, agregar],
  );

  return { buscar, escanear };
}

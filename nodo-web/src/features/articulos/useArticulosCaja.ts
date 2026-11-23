import { useMemo } from "react";
import { nombreEnCaja, type Articulo } from "@shared";
import { useArticulos, type SearchEntry } from "./useArticulos";

type ArticulosCaja = ReturnType<typeof useArticulos>;

/**
 * Artículos para COBRAR: igual que `useArticulos`, pero con la categoría
 * antes del nombre ("Llavero" + "vegueta" → "Llavero vegueta", ver
 * `nombreEnCaja`) en `byId`, `bySigla` y el `titulo` del `searchIndex`.
 *
 * Lo usan el buscador y el panel de filtros de la venta; de ahí el nombre
 * pasa al carrito (`nombrePublico`), los tickets, la venta y el apartado.
 * Las pantallas de inventario (recibir lotes, resurtidos, etiquetas de
 * precio) siguen con `useArticulos` y el nombre tal cual. Son copias solo
 * para mostrar: nada las escribe de vuelta a Firestore. `articulos` (lista
 * ordenada) queda sin cambios: la venta no la usa.
 *
 * `nombreCategoria` viene del `useCatalogoArticulos` que el componente ya
 * tiene (así no se abren más listeners). Si la categoría cambia de nombre,
 * la caja lo toma sola.
 */
export function useArticulosCaja(
  nombreCategoria: ReadonlyMap<string, string>,
): ArticulosCaja {
  const base = useArticulos();
  return useMemo(() => conCategoria(base, nombreCategoria), [base, nombreCategoria]);
}

function conCategoria(
  base: ArticulosCaja,
  nombreCategoria: ReadonlyMap<string, string>,
): ArticulosCaja {
  if (nombreCategoria.size === 0) return base;
  const byId = new Map<string, Articulo>();
  for (const [id, a] of base.byId) {
    const nombre = nombreEnCaja(
      a.nombre,
      a.categoriaId ? nombreCategoria.get(a.categoriaId) : undefined,
    );
    byId.set(id, nombre === a.nombre ? a : { ...a, nombre });
  }
  const bySigla = new Map<string, Articulo>();
  for (const [sigla, a] of base.bySigla) bySigla.set(sigla, byId.get(a.id) ?? a);
  const searchIndex: SearchEntry[] = base.searchIndex.map((e) => {
    const nombre = byId.get(e.idPadre)?.nombre;
    return nombre && nombre !== e.titulo ? { ...e, titulo: nombre } : e;
  });
  return { ...base, byId, bySigla, searchIndex };
}

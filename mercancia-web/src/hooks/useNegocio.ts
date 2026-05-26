import { useSession } from "./useSession";

/**
 * Wrapper de `useSession` que devuelve sólo `negocioId` y `sucursalId` con
 * la misma forma que el hook de admin-web (`{ negocioId }`). Pensado para
 * que los servicios portados (useArticulos, articuloService) consuman la
 * misma API sin reescritura.
 */
export function useNegocio() {
  const { binding } = useSession();
  return {
    negocioId: binding?.negocioId ?? null,
    sucursalId: binding?.sucursalId ?? null,
    negocioNombre: binding?.negocioNombre ?? null,
    sucursalNombre: binding?.sucursalNombre ?? null,
  };
}

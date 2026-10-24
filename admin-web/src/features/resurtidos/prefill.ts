import type { ResurtidoLinea } from "@shared";

/**
 * Datos para abrir "Nuevo resurtido" (embarque) ya llenado, p. ej. desde
 * Fabricación → "Enviar a sucursal". Viaja en el state del router:
 * `navigate("/resurtidos/nuevo", { state: { prefillResurtido } })`.
 */
export type PrefillResurtido = {
  destinoId?: string;
  lineas: Array<Omit<ResurtidoLinea, "disposicion">>;
  notas?: string;
};

/** Lee y valida el prefill del state del router (`null` si no hay o no
 *  tiene la forma esperada). */
export function leerPrefillResurtido(state: unknown): PrefillResurtido | null {
  const p = (state as { prefillResurtido?: unknown } | null)?.prefillResurtido;
  if (!p || typeof p !== "object") return null;
  const { destinoId, lineas, notas } = p as Record<string, unknown>;
  if (!Array.isArray(lineas)) return null;
  const validas = lineas.filter(
    (l): l is Omit<ResurtidoLinea, "disposicion"> =>
      !!l &&
      typeof l === "object" &&
      typeof (l as ResurtidoLinea).articuloId === "string" &&
      typeof (l as ResurtidoLinea).nombreSnapshot === "string" &&
      Number.isInteger((l as ResurtidoLinea).cantidadEnviada) &&
      (l as ResurtidoLinea).cantidadEnviada > 0,
  );
  if (validas.length === 0) return null;
  return {
    ...(typeof destinoId === "string" && destinoId ? { destinoId } : {}),
    lineas: validas,
    ...(typeof notas === "string" && notas ? { notas } : {}),
  };
}

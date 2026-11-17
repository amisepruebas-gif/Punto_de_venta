import {
  claveArticulo,
  contenidoDePaquete,
  infoArticuloLote,
  partirClaveArticulo,
  sesionDeConteo,
  type Articulo,
  type LotePaquete,
  type LoteSesion,
  type Resurtido,
} from "@shared";
import type { SesionSellada } from "./recepcionStore";

/**
 * El lote como lo ve la caja: lo guardado en el servidor MÁS lo sellado en
 * la tablet que aún no sube. Así un paquete de una sesión pendiente de subir
 * sale como "ya recibido" y el avance no regresa al terminar sin internet.
 * Si la sesión ya llegó al servidor, la misma llave la reemplaza (no cuenta
 * doble).
 */
export function loteConSelladas<T extends Resurtido>(lote: T, selladas: SesionSellada[]): T {
  if (selladas.length === 0) return lote;
  const sesiones: Record<string, LoteSesion> = { ...(lote.recepcion?.sesiones ?? {}) };
  for (const s of selladas) {
    if (sesiones[s.sesionId]) continue;
    sesiones[s.sesionId] = sesionDeConteo(s.conteo, s.meta);
  }
  return { ...lote, recepcion: { sesiones } };
}

/** Nombre legible de un artículo del lote: la foto de la lista (`lineas`)
 *  o, si no viene ahí, el catálogo de la tablet. */
export function nombresDeLote(
  lote: Pick<Resurtido, "lineas">,
  byId: ReadonlyMap<string, Articulo>,
): (clave: string) => string {
  const deLineas = new Map<string, string>();
  for (const l of lote.lineas ?? []) {
    deLineas.set(claveArticulo(l.articuloId, l.subvariacionCodigo), l.nombreSnapshot);
  }
  return (clave: string) => {
    const guardado = deLineas.get(clave);
    if (guardado) return guardado;
    const { articuloId, subvariacionCodigo } = partirClaveArticulo(clave);
    return infoArticuloLote(byId.get(articuloId), subvariacionCodigo)?.nombre ?? clave;
  };
}

/** `12 × Llavero, 3 × Taza`. */
export function textoContenido(p: LotePaquete, nombre: (clave: string) => string): string {
  const partes: string[] = [];
  for (const [clave, n] of contenidoDePaquete(p)) partes.push(`${n} × ${nombre(clave)}`);
  return partes.join(", ") || "Sin contenido";
}

/** Piezas de un mapa `clave → n`. */
export function sumaPiezas(mapa: Record<string, number> | undefined): number {
  let t = 0;
  for (const n of Object.values(mapa ?? {})) t += n;
  return t;
}

/** `5 pzas` / `1 pza`. */
export function pzas(n: number): string {
  return `${n.toLocaleString("es-MX")} ${n === 1 ? "pza" : "pzas"}`;
}

import {
  esLote,
  leerStockTienda,
  loteAbierto,
  pendientePorArticuloId,
  type Articulo,
  type Resurtido,
  type Sucursal,
} from "@shared";

export type ExistenciaSucursal = {
  sucursalId: string;
  nombre: string;
  cantidad: number;
};

export type ExistenciasFabricado = {
  /** Bodega global (`cantidadBodega`), "Taller" en Fabricación. */
  taller: number;
  /** Enviado y aún sin cerrar (resurtidos en tránsito o recibidos, y lo
   *  pendiente de los lotes enviados). */
  enTransito: number;
  sucursales: ExistenciaSucursal[];
  total: number;
};

/** Lo que hace falta de un resurtido para saber qué va en camino. Un lote
 *  trae además sus paquetes y sesiones (lo recibido ya está en la sucursal). */
export type EmbarqueExistencias = Pick<Resurtido, "estado" | "lineas"> &
  Partial<Pick<Resurtido, "cajas" | "paquetes" | "sueltas" | "recepcion">>;

/** Embarques que todavía no suman (todo) al stock de la sucursal destino. */
export function embarqueAbierto(r: Pick<Resurtido, "estado">): boolean {
  return r.estado === "en_transito" || r.estado === "recibido" || loteAbierto(r);
}

// La lista de Fabricación pregunta por cada artículo contra cada lote: el
// resumen de un lote se calcula una vez por snapshot (cada snapshot trae
// objetos nuevos, así que el caché nunca queda viejo).
const pendientes = new WeakMap<object, Map<string, number>>();
function pendienteDeLote(lote: EmbarqueExistencias): Map<string, number> {
  let m = pendientes.get(lote);
  if (!m) {
    m = pendientePorArticuloId(lote);
    pendientes.set(lote, m);
  }
  return m;
}

/**
 * Piezas de `articuloId` que van en camino en este embarque. Un resurtido
 * simple suma a la sucursal hasta cerrarse, así que cuenta todo lo enviado.
 * Un lote se recibe por partes y cada parte entra al stock de la sucursal
 * en ese momento: solo cuenta lo que sigue pendiente.
 */
export function piezasEnTransito(r: EmbarqueExistencias, articuloId: string): number {
  if (!embarqueAbierto(r)) return 0;
  if (esLote(r)) return pendienteDeLote(r).get(articuloId) ?? 0;
  let n = 0;
  for (const l of r.lineas) {
    if (l.articuloId === articuloId) n += l.cantidadEnviada;
  }
  return n;
}

/**
 * Dónde está cada pieza de un artículo: taller, en tránsito y la tienda de
 * cada sucursal. "En tránsito" ya salió del taller (`marcarEnTransito` o la
 * confirmación del lote) y entra a la sucursal al recibirse.
 */
export function calcularExistencias(
  art: Articulo,
  sucursales: Pick<Sucursal, "sucursalId" | "nombre">[],
  defaultSucursalId: string | undefined,
  resurtidos: EmbarqueExistencias[],
): ExistenciasFabricado {
  const taller = Number(art.cantidadBodega) || 0;
  let enTransito = 0;
  for (const r of resurtidos) enTransito += piezasEnTransito(r, art.id);
  const porSucursal = sucursales.map((s) => ({
    sucursalId: s.sucursalId,
    nombre: s.nombre,
    cantidad: leerStockTienda(art, s.sucursalId, s.sucursalId === defaultSucursalId),
  }));
  const total =
    taller + enTransito + porSucursal.reduce((acc, s) => acc + s.cantidad, 0);
  return { taller, enTransito, sucursales: porSucursal, total };
}

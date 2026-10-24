import {
  leerStockTienda,
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
  /** Enviado y aún sin cerrar (resurtidos en tránsito o recibidos). */
  enTransito: number;
  sucursales: ExistenciaSucursal[];
  total: number;
};

/** Embarques que todavía no suman al stock de la sucursal destino. */
export function embarqueAbierto(r: Pick<Resurtido, "estado">): boolean {
  return r.estado === "en_transito" || r.estado === "recibido";
}

/**
 * Dónde está cada pieza de un artículo: taller, en tránsito y la tienda de
 * cada sucursal. "En tránsito" ya salió del taller (`marcarEnTransito`) y
 * entra a la sucursal al cerrar el embarque.
 */
export function calcularExistencias(
  art: Articulo,
  sucursales: Pick<Sucursal, "sucursalId" | "nombre">[],
  defaultSucursalId: string | undefined,
  resurtidos: Pick<Resurtido, "estado" | "lineas">[],
): ExistenciasFabricado {
  const taller = Number(art.cantidadBodega) || 0;
  let enTransito = 0;
  for (const r of resurtidos) {
    if (!embarqueAbierto(r)) continue;
    for (const l of r.lineas) {
      if (l.articuloId === art.id) enTransito += l.cantidadEnviada;
    }
  }
  const porSucursal = sucursales.map((s) => ({
    sucursalId: s.sucursalId,
    nombre: s.nombre,
    cantidad: leerStockTienda(art, s.sucursalId, s.sucursalId === defaultSucursalId),
  }));
  const total =
    taller + enTransito + porSucursal.reduce((acc, s) => acc + s.cantidad, 0);
  return { taller, enTransito, sucursales: porSucursal, total };
}

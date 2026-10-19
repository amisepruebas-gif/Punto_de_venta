/**
 * Helpers para decrementar / re-incrementar stock de artículos dentro de
 * una transacción de Firestore. Compartido entre `ventaService` (al
 * cobrar) y `apartadoService` (al crear o cancelar apartados).
 *
 * Stock por sucursal: todo opera sobre la `UbicacionStock` que se pasa a
 * `leerStockEnTx`. La sucursal default usa `cantidad` (padre y
 * subvariaciones); las demás usan `cantidadPorSucursal[sid]`.
 *
 * Convenciones de uso (impuestas por Firestore):
 *
 *   0. Resolver la ubicación con `cargarUbicacionStock(negocioId, sid)`
 *      ANTES de `runTransaction` (lee el negocio y la colección de
 *      sucursales; las tx no pueden leer colecciones).
 *   1. Llamar `leerStockEnTx(tx, …, ubicacion)` ANTES de cualquier
 *      `tx.set/update`.
 *   2. Llamar `planearDecremento` o `planearIncremento` (puro, sin tx).
 *   3. Llamar `aplicarStockEnTx(tx, estados)` al final, después de las
 *      otras escrituras de la transacción.
 */

import { doc } from "firebase/firestore";
import type { DocumentReference, Transaction } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  conStockTienda,
  leerStockTienda,
  paths,
  type Articulo,
  type ArticuloSubvariacion,
  type UbicacionStock,
} from "@shared";

/** Item mínimo del carrito / apartado que toca stock. */
export type ItemStock = {
  /** ID del artículo padre (8 dígitos `123XXXXX`). */
  id: string;
  /** Cantidad (string como en VentaArticulo, o number). */
  cantidad: string | number;
  /** Código de subvariación si aplica. */
  subvariacionCodigo?: string;
  /** Nombre legible para mensajes de error. */
  nombrePublico?: string;
};

export type StockEstado = {
  ref: DocumentReference<Articulo>;
  data: Articulo;
  ubicacion: UbicacionStock;
  /** Stock de tienda del padre en `ubicacion` (`cantidad` o
   *  `cantidadPorSucursal[sid]`). */
  cantidad: number;
  subvariaciones: ArticuloSubvariacion[];
  tocado: boolean;
  /** `cantidad` (stock del padre en la sucursal) cambió y hay que
   *  escribirla. En la default siempre acompaña a `tocado`. */
  padreTocado: boolean;
};

type Grupo = {
  articuloId: string;
  subvariacionCodigo: string | null;
  cantidad: number;
  nombreLegible: string;
};

/** Acumula la cantidad pedida por (articuloId, subvariacionCodigo). El
 *  carrito puede traer la misma combinación en filas separadas; hay que
 *  sumarlas antes de validar contra stock. Items "no registrados"
 *  (`id === "00000000"`) o sin id se ignoran. */
function agruparItems(items: ItemStock[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const it of items) {
    if (!it.id || it.id === "00000000") continue;
    const subKey = it.subvariacionCodigo ?? "";
    const key = `${it.id}|${subKey}`;
    const cur =
      map.get(key) ??
      ({
        articuloId: it.id,
        subvariacionCodigo: it.subvariacionCodigo ?? null,
        cantidad: 0,
        nombreLegible: it.nombrePublico ?? it.id,
      } as Grupo);
    cur.cantidad += Number(it.cantidad) || 0;
    map.set(key, cur);
  }
  return Array.from(map.values());
}

/** **Solo lecturas.** Trae los docs de los artículos referenciados y
 *  toma el stock de la sucursal indicada en `ubicacion`. */
export async function leerStockEnTx(
  tx: Transaction,
  negocioId: string,
  items: ItemStock[],
  ubicacion: UbicacionStock,
): Promise<Map<string, StockEstado>> {
  const grupos = agruparItems(items);
  const estados = new Map<string, StockEstado>();
  if (grupos.length === 0) return estados;

  const idsUnicos = Array.from(new Set(grupos.map((g) => g.articuloId)));
  const refs = idsUnicos.map(
    (id) => doc(db, paths.articulo(negocioId, id)) as DocumentReference<Articulo>,
  );
  const snaps = await Promise.all(refs.map((r) => tx.get(r)));
  refs.forEach((ref, i) => {
    const snap = snaps[i];
    if (!snap.exists()) return;
    const data = snap.data() as Articulo;
    estados.set(idsUnicos[i], {
      ref,
      data,
      ubicacion,
      cantidad: leerStockTienda(data, ubicacion.sucursalId, ubicacion.esDefault),
      subvariaciones: (data.subvariaciones ?? []).map((s) => ({ ...s })),
      tocado: false,
      padreTocado: false,
    });
  });
  return estados;
}

/**
 * Aplica decremento sobre el `Map` de estados. Lanza si el stock es
 * insuficiente o si el artículo / variación no existe. En la sucursal
 * default mantiene la `cantidad` del padre = suma de
 * `subvariaciones[].cantidad`; en las demás sólo cambia
 * `cantidadPorSucursal[sid]` de la subvariación (igual que
 * `cerrarResurtido`).
 */
export function planearDecremento(
  estados: Map<string, StockEstado>,
  items: ItemStock[],
  opts?: { permitirSobreventa?: boolean },
): { sobreventa: boolean } {
  // Sobreventa: al COBRAR permitimos vender aunque el stock sea insuficiente
  // (decisión de negocio). En vez de lanzar, el stock se reduce hasta 0 (clamp)
  // y se REPORTA (return.sobreventa) para auditarlo. Apartados u otros callers
  // NO pasan el flag → siguen validando estricto (lanzan).
  const sobreventa = opts?.permitirSobreventa ?? false;
  let huboSobreventa = false;
  const grupos = agruparItems(items);
  for (const g of grupos) {
    const e = estados.get(g.articuloId);
    if (!e) {
      throw new Error(`Artículo "${g.nombreLegible}" ya no existe`);
    }
    if (g.subvariacionCodigo) {
      const idx = e.subvariaciones.findIndex(
        (s) => s.codigo === g.subvariacionCodigo,
      );
      if (idx === -1) {
        throw new Error(
          `Variación ${g.subvariacionCodigo} de "${g.nombreLegible}" ya no existe`,
        );
      }
      const { sucursalId, esDefault } = e.ubicacion;
      const sv = e.subvariaciones[idx];
      const stockSv = leerStockTienda(sv, sucursalId, esDefault);
      if (stockSv < g.cantidad) {
        if (!sobreventa) {
          const etiqueta = sv.nombre || g.subvariacionCodigo;
          throw new Error(
            `Stock insuficiente: "${g.nombreLegible} · ${etiqueta}" — hay ${stockSv}, pides ${g.cantidad}`,
          );
        }
        huboSobreventa = true;
      }
      e.subvariaciones[idx] = conStockTienda(
        sv,
        sucursalId,
        esDefault,
        Math.max(0, stockSv - g.cantidad),
      );
      if (esDefault) {
        e.cantidad = Math.max(0, e.cantidad - g.cantidad);
        e.padreTocado = true;
      }
      e.tocado = true;
    } else {
      if (e.cantidad < g.cantidad) {
        if (!sobreventa) {
          throw new Error(
            `Stock insuficiente: "${g.nombreLegible}" — hay ${e.cantidad}, pides ${g.cantidad}`,
          );
        }
        huboSobreventa = true;
      }
      e.cantidad = Math.max(0, e.cantidad - g.cantidad);
      e.padreTocado = true;
      e.tocado = true;
    }
  }
  return { sobreventa: huboSobreventa };
}

/**
 * Aplica incremento sobre el `Map` de estados (devolución de stock al
 * cancelar un apartado, por ejemplo). NO valida — sumar nunca falla.
 * Misma regla por sucursal que `planearDecremento`.
 * Si el artículo o subvariación ya no existe, ignora silenciosamente
 * (caso edge: el artículo se borró del catálogo después de reservar).
 */
export function planearIncremento(
  estados: Map<string, StockEstado>,
  items: ItemStock[],
): void {
  const grupos = agruparItems(items);
  for (const g of grupos) {
    const e = estados.get(g.articuloId);
    if (!e) continue;
    if (g.subvariacionCodigo) {
      const idx = e.subvariaciones.findIndex(
        (s) => s.codigo === g.subvariacionCodigo,
      );
      if (idx === -1) continue;
      const { sucursalId, esDefault } = e.ubicacion;
      const sv = e.subvariaciones[idx];
      const stockSv = leerStockTienda(sv, sucursalId, esDefault);
      e.subvariaciones[idx] = conStockTienda(
        sv,
        sucursalId,
        esDefault,
        stockSv + g.cantidad,
      );
      if (esDefault) {
        e.cantidad = e.cantidad + g.cantidad;
        e.padreTocado = true;
      }
      e.tocado = true;
    } else {
      e.cantidad = e.cantidad + g.cantidad;
      e.padreTocado = true;
      e.tocado = true;
    }
  }
}

/** **Solo escrituras.** Aplica los `tx.update` resultantes del plan. El
 *  stock del padre va a `cantidad` (default) o al mapa completo
 *  `cantidadPorSucursal` (otra sucursal; se leyó en la misma tx). */
export function aplicarStockEnTx(
  tx: Transaction,
  estados: Map<string, StockEstado>,
): void {
  for (const e of estados.values()) {
    if (!e.tocado) continue;
    const { sucursalId, esDefault } = e.ubicacion;
    const update: Partial<Articulo> = {};
    if (e.padreTocado) {
      const padre = conStockTienda(e.data, sucursalId, esDefault, e.cantidad);
      if (esDefault) update.cantidad = padre.cantidad;
      else update.cantidadPorSucursal = padre.cantidadPorSucursal;
    }
    if (e.data.subvariaciones && e.data.subvariaciones.length > 0) {
      update.subvariaciones = e.subvariaciones;
    }
    tx.update(e.ref, update);
  }
}

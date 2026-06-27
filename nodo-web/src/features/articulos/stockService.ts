/**
 * Helpers para decrementar / re-incrementar stock de artículos dentro de
 * una transacción de Firestore. Compartido entre `ventaService` (al
 * cobrar) y `apartadoService` (al crear o cancelar apartados).
 *
 * Convenciones de uso (impuestas por Firestore):
 *
 *   1. Llamar `leerStockEnTx(tx, …)` ANTES de cualquier `tx.set/update`.
 *   2. Llamar `planearDecremento` o `planearIncremento` (puro, sin tx).
 *   3. Llamar `aplicarStockEnTx(tx, estados)` al final, después de las
 *      otras escrituras de la transacción.
 */

import { doc } from "firebase/firestore";
import type { DocumentReference, Transaction } from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  paths,
  type Articulo,
  type ArticuloSubvariacion,
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
  cantidad: number;
  subvariaciones: ArticuloSubvariacion[];
  tocado: boolean;
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

/** **Solo lecturas.** Trae los docs de los artículos referenciados. */
export async function leerStockEnTx(
  tx: Transaction,
  negocioId: string,
  items: ItemStock[],
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
      cantidad: Number(data.cantidad) || 0,
      subvariaciones: (data.subvariaciones ?? []).map((s) => ({ ...s })),
      tocado: false,
    });
  });
  return estados;
}

/**
 * Aplica decremento sobre el `Map` de estados. Lanza si el stock es
 * insuficiente o si el artículo / variación no existe. Mantiene la
 * `cantidad` del padre = suma de `subvariaciones[].cantidad` cuando
 * aplica.
 */
export function planearDecremento(
  estados: Map<string, StockEstado>,
  items: ItemStock[],
  opts?: { permitirSobreventa?: boolean },
): void {
  // Sobreventa: al COBRAR permitimos vender aunque el stock sea insuficiente
  // (decisión de negocio). En vez de lanzar, el stock se reduce hasta 0 (clamp).
  // Apartados u otros callers NO pasan el flag → siguen validando estricto.
  const sobreventa = opts?.permitirSobreventa ?? false;
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
      const sv = e.subvariaciones[idx];
      const stockSv = Number(sv.cantidad) || 0;
      if (stockSv < g.cantidad && !sobreventa) {
        const etiqueta = sv.nombre || g.subvariacionCodigo;
        throw new Error(
          `Stock insuficiente: "${g.nombreLegible} · ${etiqueta}" — hay ${stockSv}, pides ${g.cantidad}`,
        );
      }
      e.subvariaciones[idx] = {
        ...sv,
        cantidad: String(Math.max(0, stockSv - g.cantidad)),
      };
      e.cantidad = Math.max(0, e.cantidad - g.cantidad);
      e.tocado = true;
    } else {
      if (e.cantidad < g.cantidad && !sobreventa) {
        throw new Error(
          `Stock insuficiente: "${g.nombreLegible}" — hay ${e.cantidad}, pides ${g.cantidad}`,
        );
      }
      e.cantidad = Math.max(0, e.cantidad - g.cantidad);
      e.tocado = true;
    }
  }
}

/**
 * Aplica incremento sobre el `Map` de estados (devolución de stock al
 * cancelar un apartado, por ejemplo). NO valida — sumar nunca falla.
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
      const sv = e.subvariaciones[idx];
      const stockSv = Number(sv.cantidad) || 0;
      e.subvariaciones[idx] = {
        ...sv,
        cantidad: String(stockSv + g.cantidad),
      };
      e.cantidad = e.cantidad + g.cantidad;
      e.tocado = true;
    } else {
      e.cantidad = e.cantidad + g.cantidad;
      e.tocado = true;
    }
  }
}

/** **Solo escrituras.** Aplica los `tx.update` resultantes del plan. */
export function aplicarStockEnTx(
  tx: Transaction,
  estados: Map<string, StockEstado>,
): void {
  for (const e of estados.values()) {
    if (!e.tocado) continue;
    const update: Partial<Articulo> = { cantidad: String(e.cantidad) };
    if (e.data.subvariaciones && e.data.subvariaciones.length > 0) {
      update.subvariaciones = e.subvariaciones;
    }
    tx.update(e.ref, update);
  }
}

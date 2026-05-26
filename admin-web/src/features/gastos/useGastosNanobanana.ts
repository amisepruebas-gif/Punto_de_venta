/**
 * Lee TODOS los artículos del negocio en vivo y aplana sus
 * `imagenProcesos` (del padre + de cada subvariación) en una lista
 * unificada de eventos para el reporte de gastos.
 *
 * Se hace client-side sobre el listener existente de `useArticulos`
 * (compartido con la página de Artículos) — no añade lecturas.
 */

import { useMemo } from "react";
import { useArticulos } from "@/features/articulos/useArticulos";
import type { RegistroImagenProcesada } from "@shared";

export type GastoEvento = {
  /** Registro original (fecha ISO, costos, usuario, imagen). */
  registro: RegistroImagenProcesada;
  /** ID del artículo padre. */
  articuloId: string;
  /** Nombre legible del artículo padre. */
  articuloNombre: string;
  /** Si el registro es de una subvariación, su código `v-NN-XXX`. */
  subvariacionCodigo?: string;
  /** Nombre legible de la subvariación si aplica. */
  subvariacionNombre?: string;
};

export function useGastosNanobanana() {
  const { articulos, loading } = useArticulos();

  const eventos = useMemo<GastoEvento[]>(() => {
    const out: GastoEvento[] = [];
    for (const a of articulos) {
      for (const r of a.imagenProcesos ?? []) {
        out.push({
          registro: r,
          articuloId: a.id,
          articuloNombre: a.nombre,
        });
      }
      for (const sv of a.subvariaciones ?? []) {
        for (const r of sv.imagenProcesos ?? []) {
          out.push({
            registro: r,
            articuloId: a.id,
            articuloNombre: a.nombre,
            subvariacionCodigo: sv.codigo,
            subvariacionNombre: sv.nombre,
          });
        }
      }
    }
    out.sort((x, y) => y.registro.fecha.localeCompare(x.registro.fecha));
    return out;
  }, [articulos]);

  return { eventos, loading };
}

/** Devuelve los eventos cuya fecha cae en `y-m` (mes 1-indexed). */
export function filtrarPorMes(
  eventos: GastoEvento[],
  y: number,
  m: number,
): GastoEvento[] {
  return eventos.filter((e) => {
    const d = new Date(e.registro.fecha);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  });
}

/** Agrupa eventos por día del mes y devuelve totales en MXN. */
export function totalesPorDia(
  eventos: GastoEvento[],
): Map<number, { count: number; mxn: number; usd: number }> {
  const map = new Map<number, { count: number; mxn: number; usd: number }>();
  for (const e of eventos) {
    const d = new Date(e.registro.fecha).getDate();
    const cur = map.get(d) ?? { count: 0, mxn: 0, usd: 0 };
    cur.count += 1;
    cur.mxn += e.registro.costoMxn || 0;
    cur.usd += e.registro.costoUsd || 0;
    map.set(d, cur);
  }
  return map;
}

/** Devuelve los eventos cuya fecha cae en el día concreto. */
export function filtrarPorDia(
  eventos: GastoEvento[],
  y: number,
  m: number,
  d: number,
): GastoEvento[] {
  return eventos.filter((e) => {
    const dt = new Date(e.registro.fecha);
    return (
      dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d
    );
  });
}

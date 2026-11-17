import { resumenLote, totalesLote, type Resurtido } from "@shared";

// Cómo se le muestra un lote a admin (lista y detalle). Puro.

type LoteParaVista = Pick<
  Resurtido,
  "estado" | "listo" | "cajas" | "paquetes" | "sueltas" | "recepcion"
>;

export type EtapaLote = "armando" | "listo" | "enviado" | "parcial" | "cerrado";

/** La etapa del lote: `creando` se parte en "armándose" y "listo". */
export function etapaLote(lote: Pick<Resurtido, "estado" | "listo">): EtapaLote {
  switch (lote.estado) {
    case "creando":
      return lote.listo ? "listo" : "armando";
    case "enviado":
      return "enviado";
    case "parcial":
      return "parcial";
    default:
      // Un lote nunca usa `en_transito` / `recibido` (las reglas no lo dejan).
      return "cerrado";
  }
}

export const ETAPA_LOTE_PALABRAS: Record<EtapaLote, string> = {
  armando: "Se está armando",
  listo: "Listo para enviar",
  enviado: "Enviado",
  parcial: "Recibido en parte",
  cerrado: "Cerrado",
};

export const ETAPA_LOTE_COLOR: Record<EtapaLote, string> = {
  armando: "bg-muted text-muted-foreground",
  listo: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  enviado: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  parcial: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  cerrado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export function estadoLotePalabras(lote: Pick<Resurtido, "estado" | "listo">): string {
  return ETAPA_LOTE_PALABRAS[etapaLote(lote)];
}

/** "1 pieza" / "3 piezas". */
export function piezas(n: number): string {
  return `${n} ${n === 1 ? "pieza" : "piezas"}`;
}

/**
 * Avance corto para la lista: lo armado mientras se arma; paquetes
 * recibidos o piezas pendientes ya enviado. OJO: un lote armándose tiene
 * `lineas: []`, todo sale de sus cajas.
 */
export function avanceLote(lote: LoteParaVista): string {
  const etapa = etapaLote(lote);
  if (etapa === "armando" || etapa === "listo") {
    const t = totalesLote(lote);
    return `${t.cajas} ${t.cajas === 1 ? "caja" : "cajas"} · ${piezas(t.piezas)}`;
  }
  const r = resumenLote(lote);
  if (etapa === "cerrado") {
    const faltaron = r.totales.noLlego;
    return faltaron > 0
      ? `${piezas(r.totales.declarado)} · ${faltaron} no llegaron`
      : `${piezas(r.totales.declarado)} · completo`;
  }
  const llegados = r.paquetesRecibidos + r.paquetesDanados;
  if (r.paquetesTotal > 0) {
    return `${llegados} de ${r.paquetesTotal} paquetes · faltan ${piezas(r.totales.pendiente)}`;
  }
  return `faltan ${piezas(r.totales.pendiente)} de ${r.totales.declarado}`;
}

/** `2026-11-16 13:05:09` → `2026-11-16 13:05`. */
export function fechaCorta(fecha: string | undefined): string | undefined {
  return fecha ? fecha.slice(0, 16).replace("T", " ") : undefined;
}

// Partes puras del manejo de impresoras de Windows (sin Electron): se prueban
// con vitest.
import type { PuertoUsb } from "../compartido/api";

/** Nombre de la impresora que crea "Preparar impresora". */
export const NOMBRE_IMPRESORA_GENERICA = "Etiquetas AMISE";
/** Driver que trae Windows y deja pasar los bytes tal cual. */
export const DRIVER_GENERICO = "Generic / Text Only";

export const RE_PUERTO_USB = /^USB\d{3}$/;

/** Texto entre comillas simples de PowerShell. */
export function psq(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function lista<T>(x: T | T[] | null | undefined): T[] {
  if (x === null || x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * Lo que devuelve el script de PowerShell de los puertos USB:
 * `{puertos: ["USB001"], impresoras: [{nombre, puerto}], dispositivos: [{puerto, descripcion}]}`.
 * ConvertTo-Json a veces da un solo objeto en vez de una lista: se aguantan
 * las dos formas.
 */
export function parsearPuertos(json: string): PuertoUsb[] {
  let d: {
    puertos?: string | string[];
    impresoras?: { nombre?: string; puerto?: string } | Array<{ nombre?: string; puerto?: string }>;
    dispositivos?:
      | { puerto?: string; descripcion?: string }
      | Array<{ puerto?: string; descripcion?: string }>;
  };
  try {
    d = JSON.parse(json.replace(/^﻿/, "").trim() || "{}");
  } catch {
    return [];
  }
  const puertos = lista(d.puertos).filter((p): p is string => typeof p === "string" && RE_PUERTO_USB.test(p));
  const impresoras = lista(d.impresoras);
  const dispositivos = lista(d.dispositivos);
  return [...new Set(puertos)].sort().map((puerto) => {
    const desc = dispositivos.find((x) => x?.puerto === puerto)?.descripcion?.trim();
    return {
      puerto,
      ...(desc ? { dispositivo: desc } : {}),
      impresoras: impresoras
        .filter((i) => i?.puerto === puerto && typeof i?.nombre === "string")
        .map((i) => i.nombre as string),
    };
  });
}

/** Mensaje en español sencillo para lo que contestó `raw-print.exe`. */
export function mensajeErrorRaw(salida: string, impresora: string): string {
  const m = /ERROR\s+(\d+)\s*(.*)/s.exec(salida);
  const codigo = m ? Number(m[1]) : NaN;
  const detalle = (m?.[2] ?? salida).trim().slice(0, 160);
  switch (codigo) {
    case 1801:
      return `No encuentro la impresora "${impresora}" en Windows. Elígela otra vez en el programa.`;
    case 1804:
      return `La impresora "${impresora}" no acepta comandos directos. Usa "Preparar impresora USB" o el driver de la marca.`;
    case 5:
      return `Windows no dejó usar la impresora "${impresora}" (permisos).`;
    default:
      return `Windows no pudo imprimir en "${impresora}": ${detalle || "error desconocido"}`;
  }
}

/** Para nombres de archivo del modo de prueba. */
export function limpiarNombreArchivo(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "trabajo";
}

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

type DispositivoCrudo = { puerto?: string; descripcion?: string; conectada?: boolean };

/**
 * Lo que devuelve el script de PowerShell de los puertos USB:
 * `{puertos: ["USB001"], impresoras: [{nombre, puerto}], dispositivos: [{puerto, descripcion, conectada}]}`.
 * ConvertTo-Json a veces da un solo objeto en vez de una lista: se aguantan
 * las dos formas. Primero van los puertos con la impresora conectada ahora
 * (Windows guarda puertos viejos sin nada detrás: elegir uno de esos no
 * imprime).
 */
export function parsearPuertos(json: string): PuertoUsb[] {
  let d: {
    puertos?: string | string[];
    impresoras?: { nombre?: string; puerto?: string } | Array<{ nombre?: string; puerto?: string }>;
    dispositivos?: DispositivoCrudo | DispositivoCrudo[];
  };
  try {
    d = JSON.parse(json.replace(/^﻿/, "").trim() || "{}");
  } catch {
    return [];
  }
  const puertos = lista(d.puertos).filter((p): p is string => typeof p === "string" && RE_PUERTO_USB.test(p));
  const impresoras = lista(d.impresoras);
  const dispositivos = lista(d.dispositivos);
  return [...new Set(puertos)]
    .sort()
    .map((puerto): PuertoUsb => {
      const aparatos = dispositivos.filter((x) => x?.puerto === puerto);
      // Si Windows recuerda varios aparatos en el mismo puerto, el conectado.
      const aparato = aparatos.find((x) => x?.conectada === true) ?? aparatos[0];
      const desc = aparato?.descripcion?.trim();
      return {
        puerto,
        ...(desc ? { dispositivo: desc } : {}),
        ...(aparato?.conectada === true ? { conectada: true } : {}),
        impresoras: impresoras
          .filter((i) => i?.puerto === puerto && typeof i?.nombre === "string")
          .map((i) => i.nombre as string),
      };
    })
    .sort((a, b) => Number(b.conectada === true) - Number(a.conectada === true));
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

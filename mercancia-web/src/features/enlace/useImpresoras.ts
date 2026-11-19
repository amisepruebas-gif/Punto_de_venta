import { useCallback, useEffect, useState } from "react";
import type { SesionEnlace } from "@/firebase/enlaceApp";
import {
  escucharImpresoras,
  escucharMisOrdenesAbiertas,
  type ImpresoraVista,
  type TrabajoVista,
} from "./etiquetasService";

/** `Date.now()` que se pone al día cada `cada` ms (para "Conectada"). */
export function useAhora(cada: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(t);
  }, [cada]);
  return ahora;
}

function leerElegida(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? "";
  } catch {
    return "";
  }
}

/**
 * Lo que comparten las pantallas que mandan a la impresora de etiquetas: las
 * impresoras (en vivo), la elegida (recordada en el equipo con `clave`) y las
 * órdenes abiertas de este acceso. `actualizar` vuelve a abrir las escuchas
 * (el botón "Actualizar" o "Reintentar" después de un error).
 */
export function useImpresorasDelEnlace(s: SesionEnlace, clave: string) {
  const [vuelta, setVuelta] = useState(0);
  const [impresoras, setImpresoras] = useState<ImpresoraVista[] | null>(null);
  const [errorLista, setErrorLista] = useState<unknown>(null);
  const [elegida, setElegida] = useState(() => leerElegida(clave));
  const [abiertas, setAbiertas] = useState<TrabajoVista[]>([]);
  const [errorAbiertas, setErrorAbiertas] = useState<unknown>(null);

  useEffect(() => {
    setErrorLista(null);
    return escucharImpresoras(
      s,
      (lista) => {
        setImpresoras(lista);
        // Si solo hay una (o la recordada ya no existe), la primera.
        setElegida((x) => (lista.some((i) => i.id === x) ? x : lista.length === 1 ? lista[0]!.id : ""));
      },
      setErrorLista,
    );
  }, [s, vuelta]);

  useEffect(() => {
    setErrorAbiertas(null);
    return escucharMisOrdenesAbiertas(s, setAbiertas, setErrorAbiertas);
  }, [s, vuelta]);

  const actualizar = useCallback(() => setVuelta((v) => v + 1), []);

  /** Se recuerda la impresora a la que se mandó, para la próxima vez. */
  const recordarElegida = useCallback(
    (id: string) => {
      try {
        localStorage.setItem(clave, id);
      } catch {
        /* sin almacenamiento */
      }
    },
    [clave],
  );

  return {
    impresoras,
    errorLista,
    elegida,
    setElegida,
    abiertas,
    errorAbiertas,
    actualizar,
    recordarElegida,
  };
}

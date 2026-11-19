import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { EnlaceLoteTipo } from "@shared";
import type { SesionEnlace } from "@/firebase/enlaceApp";

export type EnlaceCtx = {
  negocioId: string;
  enlaceId: string;
  /** `/enlace/{negocioId}/{enlaceId}` (o `/precio/…` en la página de
   *  etiquetas de precio). */
  base: string;
  sesion: SesionEnlace | null;
  setSesion: (s: SesionEnlace | null) => void;
  /** El secreto de la URL, si vino en ella (solo en memoria). */
  secreto: string | null;
};

export const EnlaceContext = createContext<EnlaceCtx | null>(null);

export function useEnlace(): EnlaceCtx {
  const c = useContext(EnlaceContext);
  if (!c) throw new Error("useEnlace fuera de /enlace");
  return c;
}

/** La pantalla de cada tipo de sesión: armar → sus lotes, fotos → las
 *  fotos, etiquetas de precio → su página aparte (`/precio`). Cada pantalla
 *  manda aquí a una sesión que no es la suya (sin dar vueltas entre ellas). */
export function rutaDeSesion(negocioId: string, enlaceId: string, tipo: EnlaceLoteTipo): string {
  const n = encodeURIComponent(negocioId);
  const e = encodeURIComponent(enlaceId);
  if (tipo === "precio") return `/precio/${n}/${e}`;
  return `/enlace/${n}/${e}/${tipo === "armar" ? "lotes" : "fotos"}`;
}

type EstadoHistorial = { pantallaEnlace?: true } | null;

/**
 * Una pantalla encima de la vista (escanear, capturar un paquete…) que el
 * botón "atrás" del teléfono cierra en vez de sacarte del lote: al abrirla
 * se agrega una entrada al historial con la misma dirección.
 */
export function usePantalla<T>() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pantalla, setPantalla] = useState<T | null>(null);
  const enHistorial = !!(location.state as EstadoHistorial)?.pantallaEnlace;
  // Solo se regresa (-1) si la entrada la puso esta página: una que quedó de
  // antes de recargar podría sacar de la app.
  const empujada = useRef(false);

  useEffect(() => {
    if (!enHistorial) {
      empujada.current = false;
      setPantalla(null);
    }
  }, [enHistorial]);

  // Entrada vieja (se recargó con una pantalla abierta): se limpia.
  useEffect(() => {
    if (enHistorial && !empujada.current) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrir(p: T) {
    setPantalla(p);
    if (!empujada.current) {
      empujada.current = true;
      navigate(location.pathname + location.search, {
        state: { pantallaEnlace: true } satisfies EstadoHistorial,
      });
    }
  }

  /** Cambia de pantalla sin tocar el historial (un paso dentro del mismo flujo). */
  function cambiar(p: T) {
    setPantalla(p);
  }

  function cerrar() {
    if (empujada.current && enHistorial) {
      empujada.current = false;
      navigate(-1);
    } else {
      empujada.current = false;
      setPantalla(null);
    }
  }

  /** Cierra y va a otra dirección (la pantalla no queda en el historial). */
  function irA(destino: string) {
    const reemplazar = empujada.current && enHistorial;
    empujada.current = false;
    setPantalla(null);
    navigate(destino, { replace: reemplazar });
  }

  return { pantalla, abrir, cambiar, cerrar, irA };
}

/** Regresa una vista: con historial de la app, como "atrás"; si se entró
 *  directo a esta dirección, a `destino` (sin salir de la app). */
export function useVolver() {
  const navigate = useNavigate();
  const location = useLocation();
  return (destino: string) => {
    if (location.key !== "default") navigate(-1);
    else navigate(destino, { replace: true });
  };
}

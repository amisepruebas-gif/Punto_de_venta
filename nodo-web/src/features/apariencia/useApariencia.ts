import { useEffect, useState } from "react";

/**
 * Catálogo de fondos disponibles. Las imágenes viven en `public/img/fondos/`
 * (copiadas de `nodo_1/.../drawable/`). El `id` es el filename sin extensión.
 */
export type FondoOpcion = {
  id: string;
  nombre: string;
  src: string;
};

export type CabeceraOpcion = {
  id: string;
  nombre: string;
  src: string;
};

export type LogoOpcion = {
  id: string;
  nombre: string;
  src: string;
};

export const FONDOS: FondoOpcion[] = [
  { id: "ninguno", nombre: "Sin fondo", src: "" },
  { id: "fondo_uno", nombre: "Fondo 1", src: "/img/fondos/fondo_uno.jpg" },
  { id: "fondo_dos", nombre: "Fondo 2", src: "/img/fondos/fondo_dos.jpg" },
  { id: "fondo_tres", nombre: "Fondo 3", src: "/img/fondos/fondo_tres.jpg" },
  { id: "fondo_cuatro", nombre: "Fondo 4", src: "/img/fondos/fondo_cuatro.jpg" },
  { id: "fondo_cinco", nombre: "Fondo 5", src: "/img/fondos/fondo_cinco.jpg" },
  { id: "fondo_seis", nombre: "Fondo 6", src: "/img/fondos/fondo_seis.png" },
  { id: "fondo_cero", nombre: "Fondo 7", src: "/img/fondos/fondo_cero.jpg" },
];

export const CABECERAS: CabeceraOpcion[] = [
  { id: "ninguna", nombre: "Sin cabecera", src: "" },
  {
    id: "cabecera_uno",
    nombre: "Cabecera 1",
    src: "/img/cabeceras/cabecera_uno.png",
  },
  {
    id: "cabecera_dos",
    nombre: "Cabecera 2",
    src: "/img/cabeceras/cabecera_dos.png",
  },
];

export const LOGOS: LogoOpcion[] = [
  { id: "ninguno", nombre: "Sin logo", src: "" },
  {
    id: "amise_pant_principal",
    nombre: "Amise principal",
    src: "/img/logos/amise_pant_principal.png",
  },
  {
    id: "amiselogo",
    nombre: "Amise logo",
    src: "/img/logos/amiselogo.jpeg",
  },
  {
    id: "amisetpeq",
    nombre: "Amise pequeño",
    src: "/img/logos/amisetpeq.png",
  },
];

const KEY_FONDO = "apariencia.fondo";
const KEY_FONDO_OP = "apariencia.fondo.opacidad";
const KEY_CABECERA = "apariencia.cabecera";
const KEY_CABECERA_OP = "apariencia.cabecera.opacidad";
const KEY_LOGO = "apariencia.logo";

const DEFAULT_FONDO = "ninguno";
const DEFAULT_FONDO_OPACIDAD = 0.4;
const DEFAULT_CABECERA = "ninguna";
const DEFAULT_CABECERA_OPACIDAD = 0.5;
const DEFAULT_LOGO = "amise_pant_principal";

/**
 * Hook que expone la apariencia seleccionada (fondo + cabecera + opacidades)
 * y permite cambiarla. Se persiste en localStorage del dispositivo (no en
 * Firestore, porque es preferencia per-tablet, no del negocio).
 *
 * Sincroniza entre componentes a través del evento `storage` del browser.
 */
export function useApariencia() {
  const [fondoId, setFondoIdState] = useState(() =>
    leerLs(KEY_FONDO, DEFAULT_FONDO),
  );
  const [fondoOpacidad, setFondoOpacidadState] = useState(() =>
    leerLsNumero(KEY_FONDO_OP, DEFAULT_FONDO_OPACIDAD),
  );
  const [cabeceraId, setCabeceraIdState] = useState(() =>
    leerLs(KEY_CABECERA, DEFAULT_CABECERA),
  );
  const [cabeceraOpacidad, setCabeceraOpacidadState] = useState(() =>
    leerLsNumero(KEY_CABECERA_OP, DEFAULT_CABECERA_OPACIDAD),
  );
  const [logoId, setLogoIdState] = useState(() =>
    leerLs(KEY_LOGO, DEFAULT_LOGO),
  );

  // Sincronización entre tabs / componentes — escucha cambios en localStorage.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY_FONDO && e.newValue !== null) {
        setFondoIdState(e.newValue);
      } else if (e.key === KEY_FONDO_OP && e.newValue !== null) {
        setFondoOpacidadState(Number(e.newValue));
      } else if (e.key === KEY_CABECERA && e.newValue !== null) {
        setCabeceraIdState(e.newValue);
      } else if (e.key === KEY_CABECERA_OP && e.newValue !== null) {
        setCabeceraOpacidadState(Number(e.newValue));
      } else if (e.key === KEY_LOGO && e.newValue !== null) {
        setLogoIdState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function setFondo(id: string) {
    setFondoIdState(id);
    escribirLs(KEY_FONDO, id);
  }
  function setFondoOpacidad(v: number) {
    setFondoOpacidadState(v);
    escribirLs(KEY_FONDO_OP, String(v));
  }
  function setCabecera(id: string) {
    setCabeceraIdState(id);
    escribirLs(KEY_CABECERA, id);
  }
  function setCabeceraOpacidad(v: number) {
    setCabeceraOpacidadState(v);
    escribirLs(KEY_CABECERA_OP, String(v));
  }
  function setLogo(id: string) {
    setLogoIdState(id);
    escribirLs(KEY_LOGO, id);
  }

  const fondo = FONDOS.find((f) => f.id === fondoId) ?? FONDOS[0];
  const cabecera =
    CABECERAS.find((c) => c.id === cabeceraId) ?? CABECERAS[0];
  const logo = LOGOS.find((l) => l.id === logoId) ?? LOGOS[0];

  return {
    fondo,
    fondoOpacidad,
    setFondo,
    setFondoOpacidad,
    cabecera,
    cabeceraOpacidad,
    setCabecera,
    setCabeceraOpacidad,
    logo,
    setLogo,
  };
}

function leerLs(k: string, def: string): string {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(k) ?? def
      : def;
  } catch {
    return def;
  }
}
function leerLsNumero(k: string, def: number): number {
  try {
    if (typeof localStorage === "undefined") return def;
    const raw = localStorage.getItem(k);
    if (raw === null) return def;
    const n = Number(raw);
    return Number.isFinite(n) ? n : def;
  } catch {
    return def;
  }
}
function escribirLs(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* noop */
  }
}

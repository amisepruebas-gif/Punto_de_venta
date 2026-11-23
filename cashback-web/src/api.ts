import { initializeApp } from "firebase/app";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import type { VigenciaCashback } from "@shared";

// Solo functions (sin Firestore ni Auth): la página no guarda nada del
// cliente salvo la sesión opaca en sessionStorage.
const EMU = import.meta.env.VITE_EMULADORES === "1";
const app = initializeApp(
  EMU
    ? { apiKey: "demo", projectId: "demo-caja", appId: "demo" }
    : {
        apiKey: "AIzaSyD3pRnsJrWA0jek25ygtUnt48z-BCWwkTs",
        authDomain: "amisetienda-c7eab.firebaseapp.com",
        projectId: "amisetienda-c7eab",
        appId: "1:201997907687:web:8cd1664bb9a917cf959442",
      },
);
const functions = getFunctions(app, "us-central1");
if (EMU) connectFunctionsEmulator(functions, "127.0.0.1", 5111);

export const NEGOCIO_ID = import.meta.env.VITE_NEGOCIO_ID || "amise";

export type Sesion = { sesion: string; venceMs: number };
export type Estado = {
  nombre: string;
  telefono4: string;
  saldoCentavos: number;
  venceISO: string | null;
  ultimaCompraISO: string | null;
  tarjetaUltimos4: string | null;
  ingresos: Array<{ fechaISO: string; centavos: number }>;
  config: { pct: number; vigencia: VigenciaCashback; activo: boolean } | null;
};

function llamar<I, O>(nombre: string) {
  return async (data: I): Promise<O> =>
    (await httpsCallable<I & { negocioId: string }, O>(functions, nombre)({ ...data, negocioId: NEGOCIO_ID })).data;
}

export const entrar = llamar<{ telefono: string; pin: string }, Sesion>("entrarCashbackCliente");
export const leerEstado = llamar<{ sesion: string }, Estado>("estadoCashbackCliente");
export const cambiarPin = llamar<{ sesion: string; pinActual: string; pinNuevo: string }, Sesion>(
  "cambiarPinCashbackCliente",
);
export const leerQr = llamar<{ sesion: string; nuevo?: boolean }, { qr: string | null }>("qrCashbackCliente");
export const salir = llamar<{ sesion: string }, { ok: boolean }>("salirCashbackCliente");

/** Mensaje para el cliente (en español sencillo). */
export function mensajeError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const msg = (e as { message?: string })?.message ?? "";
  if (!navigator.onLine || code === "functions/internal" || code === "functions/unavailable") {
    return "No hay conexión. Revisa tu internet e intenta otra vez.";
  }
  if (code === "functions/unauthenticated") return "Tu sesión terminó. Vuelve a entrar.";
  return msg || "Algo salió mal. Intenta otra vez.";
}

const CLAVE = "cashback_sesion";

export function sesionGuardada(): Sesion | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) || "null") as Sesion | null;
    return s && s.sesion && s.venceMs > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null): void {
  try {
    if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
}

import { useState } from "react";
import {
  fnRegistrarNodo,
  fnListarSucursales,
  fnRebindNodo,
  fnListarNodos,
  fnAsegurarLlaveNodo,
  type RegistrarNodoInput,
} from "@/firebase/callable";
import { loginConCustomToken } from "@/firebase/auth";
import { requestPersistentStorage } from "@/firebase/config";
import { NEGOCIO_ID } from "@/config";
import { saveSession, type NodoSession } from "@/hooks/useNodoSession";

export type Sucursal = {
  sucursalId: string;
  nombre: string;
  direccion: string;
};

export type NodoItem = {
  nodoId: string;
  nombre: string;
  registradoPor: string;
  fechaRegistro: string | null;
};

/**
 * Llave de re-auth de la tablet. Un servidor anterior a la llave no la
 * devuelve: se pide con la sesión de caja recién abierta.
 */
async function llaveDe(llave?: string | null): Promise<string | undefined> {
  if (llave) return llave;
  try {
    return (await fnAsegurarLlaveNodo({})).data.llave ?? undefined;
  } catch {
    return undefined;
  }
}

export function useRegistroNodo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Valida el código de alta; null si el servidor lo rechazó. */
  async function listarSucursales(codigo: string): Promise<Sucursal[] | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await fnListarSucursales({ negocioId: NEGOCIO_ID, codigo });
      return res.data.sucursales;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function listarNodos(
    sucursalId: string,
    codigo: string,
  ): Promise<NodoItem[]> {
    setLoading(true);
    setError(null);
    try {
      const res = await fnListarNodos({
        negocioId: NEGOCIO_ID,
        sucursalId,
        codigo,
      });
      return res.data.nodos;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function registrar(params: {
    sucursalId?: string;
    nuevaSucursal?: { nombre: string; direccion: string; telefono?: string };
    nombreNodo: string;
    registradoPor: string;
    codigo: string;
  }): Promise<NodoSession | null> {
    setLoading(true);
    setError(null);
    try {
      const input: RegistrarNodoInput = {
        negocioId: NEGOCIO_ID,
        ...params,
        userAgent: navigator.userAgent,
      };
      const res = await fnRegistrarNodo(input);
      const { nodoId, sucursalId, negocioId, customToken } = res.data;
      await loginConCustomToken(customToken);
      // FIX A6: pedir persistencia permanente tras registro exitoso.
      void requestPersistentStorage().catch(() => {});
      const session: NodoSession = {
        nodoId,
        sucursalId,
        negocioId,
        nombreNodo: params.nombreNodo,
        llave: await llaveDe(res.data.llave),
      };
      saveSession(session);
      return session;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function rebind(params: {
    nodoId: string;
    registradoPor: string;
    nombreNodo: string;
    codigo: string;
  }): Promise<NodoSession | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await fnRebindNodo({
        negocioId: NEGOCIO_ID,
        nodoId: params.nodoId,
        userAgent: navigator.userAgent,
        registradoPor: params.registradoPor,
        codigo: params.codigo,
      });
      const { nodoId, sucursalId, negocioId, customToken } = res.data;
      await loginConCustomToken(customToken);
      // FIX A6: pedir persistencia permanente tras rebind exitoso.
      void requestPersistentStorage().catch(() => {});
      const session: NodoSession = {
        nodoId,
        sucursalId,
        negocioId,
        nombreNodo: params.nombreNodo,
        llave: await llaveDe(res.data.llave),
      };
      saveSession(session);
      return session;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    listarSucursales,
    listarNodos,
    registrar,
    rebind,
  };
}

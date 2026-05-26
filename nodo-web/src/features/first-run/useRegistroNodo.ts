import { useState } from "react";
import {
  fnRegistrarNodo,
  fnListarSucursales,
  fnRebindNodo,
  fnListarNodos,
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

export function useRegistroNodo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function listarSucursales(): Promise<Sucursal[]> {
    setLoading(true);
    setError(null);
    try {
      const res = await fnListarSucursales({ negocioId: NEGOCIO_ID });
      return res.data.sucursales;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function listarNodos(sucursalId: string): Promise<NodoItem[]> {
    setLoading(true);
    setError(null);
    try {
      const res = await fnListarNodos({ negocioId: NEGOCIO_ID, sucursalId });
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
  }): Promise<NodoSession | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await fnRebindNodo({
        negocioId: NEGOCIO_ID,
        nodoId: params.nodoId,
        userAgent: navigator.userAgent,
        registradoPor: params.registradoPor,
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

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import {
  COL_USUARIOS_MERCANCIA,
  fechaISO_MX,
  generarID,
  hashPin,
  paths,
  type UsuarioMercancia,
} from "@shared";

function colRef(negocioId: string, sucursalId: string) {
  return collection(
    db,
    `${paths.sucursalData(negocioId, sucursalId)}/${COL_USUARIOS_MERCANCIA}`,
  );
}

export function useUsuariosMercancia(
  negocioId: string | null,
  sucursalId: string | null,
) {
  const [usuarios, setUsuarios] = useState<UsuarioMercancia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setUsuarios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      colRef(negocioId, sucursalId),
      (snap) => {
        const arr: UsuarioMercancia[] = [];
        snap.forEach((d) => arr.push(d.data() as UsuarioMercancia));
        arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setUsuarios(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useUsuariosMercancia:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId, sucursalId]);

  return { usuarios, loading };
}

/**
 * Verifica que el PIN no esté ya usado por OTRO registro en la misma
 * sucursal. Hace un query directo (no usa la suscripción) para detectar
 * incluso en latencia. Devuelve true si está libre.
 *
 * Race window conocida: query + setDoc no son atómicos. Dos admins creando
 * simultáneamente con el mismo PIN pueden ambos ver "libre" y crear dos
 * docs con el mismo hash. Daño: el login toma el primero que devuelva
 * Firestore (no determinístico). Mitigación correcta: cuando se cierre el
 * flujo con la CF `loginMercanciaConPin` (Fase 3B en
 * `docs/13-rules-pendientes-produccion.md`), validar unicidad allá con
 * runTransaction o un doc índice por hash.
 */
async function pinDisponible(
  negocioId: string,
  sucursalId: string,
  pinHash: string,
  ignorarUid?: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(colRef(negocioId, sucursalId), where("pinHash", "==", pinHash)),
  );
  for (const d of snap.docs) {
    if (d.id !== ignorarUid) return false;
  }
  return true;
}

export type CrearUsuarioInput = {
  nombre: string;
  pin: string;
  habilitado: boolean;
  creadoPor?: string;
};

export async function crearUsuarioMercancia(
  negocioId: string,
  sucursalId: string,
  input: CrearUsuarioInput,
): Promise<UsuarioMercancia> {
  const pinHash = await hashPin(input.pin);
  const libre = await pinDisponible(negocioId, sucursalId, pinHash);
  if (!libre) {
    throw new Error("Ese PIN ya está asignado en esta sucursal");
  }
  const id = generarID();
  const usuario: UsuarioMercancia = {
    id,
    nombre: input.nombre.trim(),
    pinHash,
    habilitado: input.habilitado,
    fechaCreacion: fechaISO_MX(),
    ...(input.creadoPor ? { creadoPor: input.creadoPor } : {}),
  };
  await setDoc(
    doc(db, paths.usuarioMercancia(negocioId, sucursalId, id)),
    usuario,
  );
  return usuario;
}

export type ActualizarUsuarioInput = {
  uid: string;
  nombre?: string;
  /** PIN nuevo en plano (opcional — si no se cambia, no se toca el hash). */
  pinNuevo?: string;
  habilitado?: boolean;
};

export async function actualizarUsuarioMercancia(
  negocioId: string,
  sucursalId: string,
  input: ActualizarUsuarioInput,
): Promise<void> {
  const patch: Record<string, unknown> = {
    fechaActualizacion: fechaISO_MX(),
  };
  if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
  if (input.habilitado !== undefined) patch.habilitado = input.habilitado;
  if (input.pinNuevo) {
    const pinHash = await hashPin(input.pinNuevo);
    const libre = await pinDisponible(
      negocioId,
      sucursalId,
      pinHash,
      input.uid,
    );
    if (!libre) {
      throw new Error("Ese PIN ya está asignado en esta sucursal");
    }
    patch.pinHash = pinHash;
  }
  await updateDoc(
    doc(db, paths.usuarioMercancia(negocioId, sucursalId, input.uid)),
    patch,
  );
}

export async function eliminarUsuarioMercancia(
  negocioId: string,
  sucursalId: string,
  uid: string,
): Promise<void> {
  await deleteDoc(
    doc(db, paths.usuarioMercancia(negocioId, sucursalId, uid)),
  );
}

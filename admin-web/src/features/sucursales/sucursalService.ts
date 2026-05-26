import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/firebase/config";
import { fnCrearSucursal } from "@/firebase/callables";
import { paths } from "@shared";
import type { DatosTransferencia, TicketConfig } from "@shared";

export async function crearSucursal(params: {
  negocioId: string;
  nombre: string;
  direccion: string;
  telefono?: string;
}): Promise<string> {
  const res = await fnCrearSucursal(params);
  return res.data.sucursalId;
}

export type EditSucursalCambios = {
  nombre?: string;
  direccion?: string;
  telefono?: string;
  cobrarComision?: boolean;
  comisionTarjetaPct?: number;
  /** `null` para borrar el campo (Firestore deleteField). */
  datosTransferencia?: DatosTransferencia | null;
  /** `null` para borrar la configuración (volver al ticket por defecto). */
  ticketConfig?: TicketConfig | null;
};

export async function editarSucursal(
  negocioId: string,
  sucursalId: string,
  cambios: EditSucursalCambios,
): Promise<void> {
  // deleteField sentinel cuando se pase null (limpiar la cuenta).
  const payload: Record<string, unknown> = { ...cambios };
  if (cambios.datosTransferencia === null) {
    payload.datosTransferencia = deleteField();
  }
  if (cambios.ticketConfig === null) {
    payload.ticketConfig = deleteField();
  }
  await updateDoc(doc(db, paths.sucursal(negocioId, sucursalId)), payload);
}

/**
 * Guarda únicamente la configuración del ticket de la sucursal. Si se
 * pasa `null` se borra el campo (vuelve al ticket por defecto).
 */
export async function guardarTicketSucursal(
  negocioId: string,
  sucursalId: string,
  config: TicketConfig | null,
): Promise<void> {
  await editarSucursal(negocioId, sucursalId, { ticketConfig: config });
}

export async function desactivarSucursal(
  negocioId: string,
  sucursalId: string,
): Promise<void> {
  await updateDoc(doc(db, paths.sucursal(negocioId, sucursalId)), {
    activa: false,
  });
}

export async function activarSucursal(
  negocioId: string,
  sucursalId: string,
): Promise<void> {
  await updateDoc(doc(db, paths.sucursal(negocioId, sucursalId)), {
    activa: true,
  });
}

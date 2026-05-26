import { deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, DOC_EQUIPO, genNodoId, type EquipoDeTrabajoItem } from "@shared";

export async function agregarAEquipo(
  negocioId: string,
  item: Omit<EquipoDeTrabajoItem, "idUsuario">,
): Promise<string> {
  const idUsuario = "u_" + genNodoId().slice(0, 10);
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_EQUIPO)),
    {
      [idUsuario]: { ...item, idUsuario },
    },
    { merge: true },
  );
  return idUsuario;
}

export async function actualizarEnEquipo(
  negocioId: string,
  idUsuario: string,
  cambios: Partial<EquipoDeTrabajoItem>,
): Promise<void> {
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_EQUIPO)),
    {
      [idUsuario]: { ...cambios, idUsuario },
    },
    { merge: true },
  );
}

/**
 * FIX E1: para quitar el flag `admin` hay que usar deleteField explícito
 * porque `undefined` con `ignoreUndefinedProperties: true` se ignora y
 * no borra el campo existente.
 */
export async function setAdminFlag(
  negocioId: string,
  idUsuario: string,
  esAdmin: boolean,
): Promise<void> {
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_EQUIPO)),
    {
      [idUsuario]: esAdmin
        ? { admin: "", idUsuario }
        : { admin: deleteField(), idUsuario },
    },
    { merge: true },
  );
}

export async function quitarDeEquipo(
  negocioId: string,
  idUsuario: string,
): Promise<void> {
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_EQUIPO)),
    { [idUsuario]: deleteField() },
    { merge: true },
  );
}

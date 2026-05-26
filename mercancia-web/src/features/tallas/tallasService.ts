import { deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { paths, DOC_TALLAS } from "@shared";

/**
 * Schema tentativo de datos_web_new_version/tallas:
 *   { [nombreGrupo]: string[] }
 * Ej:
 *   { "Camisetas": ["S","M","L","XL"], "Zapatos": ["25","26","27"] }
 */
export async function guardarGrupoTallas(
  negocioId: string,
  nombreGrupo: string,
  tallas: string[],
): Promise<void> {
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_TALLAS)),
    { [nombreGrupo]: tallas },
    { merge: true },
  );
}

export async function renombrarGrupo(
  negocioId: string,
  viejo: string,
  nuevo: string,
  tallas: string[],
): Promise<void> {
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_TALLAS)),
    {
      [viejo]: deleteField(),
      [nuevo]: tallas,
    },
    { merge: true },
  );
}

export async function borrarGrupo(
  negocioId: string,
  nombreGrupo: string,
): Promise<void> {
  await setDoc(
    doc(db, paths.dato(negocioId, DOC_TALLAS)),
    { [nombreGrupo]: deleteField() },
    { merge: true },
  );
}

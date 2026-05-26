import {
  fnAgregarAdminWhitelist,
  fnQuitarAdminWhitelist,
} from "@/firebase/callables";

export async function agregarAdminWhitelist(
  negocioId: string,
  email: string,
): Promise<void> {
  await fnAgregarAdminWhitelist({ negocioId, email });
}

export async function quitarAdminWhitelist(
  negocioId: string,
  email: string,
): Promise<void> {
  await fnQuitarAdminWhitelist({ negocioId, email });
}

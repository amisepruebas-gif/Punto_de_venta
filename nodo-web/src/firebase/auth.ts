import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "./config";

/** Sign-in con el customToken devuelto por registrarNodo/rebindNodo. */
export async function loginConCustomToken(token: string): Promise<void> {
  await signInWithCustomToken(auth, token);
}

/** Cierra sesión de Firebase Auth (no toca el localStorage del nodo). */
export async function logout(): Promise<void> {
  await signOut(auth);
}

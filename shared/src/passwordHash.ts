/**
 * Hash de passwords para `id-colaborador`. Usado tanto por admin-web (al
 * crear/editar colaborador desde el panel) como por la Cloud Function
 * `loginColaborador` (al validar credenciales). Ambos lados deben usar
 * EXACTAMENTE la misma función para que el hash coincida.
 *
 * NO es seguridad de producción — el salt es global y vive en código
 * cliente, igual que `pinHash.ts`. Sirve para que un admin curioso o un
 * dev viendo Firestore no vea el password en plano. Para producción real
 * habrá que migrar a bcrypt/argon2 server-side con salt por usuario; ver
 * deuda en `docs/14-chat-arquitectura.md`.
 *
 * Salt distinto al de `pinHash` para evitar que un PIN reutilizado como
 * password coincida en hash entre tablas.
 */

const SALT = "amise.colaborador.v1";
const MIN_LEN = 8;

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${SALT}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Password válido = al menos 8 caracteres. Cualquier carácter permitido. */
export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= MIN_LEN;
}

export const PASSWORD_MIN_LENGTH = MIN_LEN;

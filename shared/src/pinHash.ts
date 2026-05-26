/**
 * Hash de PINs para `mercancia-web`. Usado tanto en admin-web (donde el
 * admin establece el PIN al crear/editar el registro) como en mercancia-web
 * (donde el usuario ingresa el PIN para entrar). Ambos lados deben usar
 * EXACTAMENTE la misma función para que el hash coincida.
 *
 * NO es seguridad real — el salt es global y vive en código cliente. Sirve
 * para que un admin curioso (o un dev viendo Firestore) no vea el PIN en
 * plano. La seguridad real se delega a una Cloud Function al cerrar reglas
 * (ver `docs/13-rules-pendientes-produccion.md` Fase 3B).
 */

const SALT = "amise.mercancia.v1";

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${SALT}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** PIN válido = exactamente 5 dígitos numéricos. */
export function isValidPin(pin: string): boolean {
  return /^\d{5}$/.test(pin);
}

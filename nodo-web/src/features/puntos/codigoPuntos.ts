// Genera la "contraseña temporal" (código de apertura) del cliente de puntos,
// LOCALMENTE en el POS para robustez offline: el ticket siempre la imprime y
// amise.mx guarda su hash cuando la llamada pasa. Mismo alfabeto que amise.mx
// (sin caracteres ambiguos) y ≥6 chars (válido como contraseña Firebase).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LEN = 6;

export function generarCodigoPuntos(): string {
  let s = "";
  const g = globalThis.crypto;
  if (g && typeof g.getRandomValues === "function") {
    const arr = new Uint32Array(LEN);
    g.getRandomValues(arr);
    for (let i = 0; i < LEN; i++) s += ALPHABET[arr[i] % ALPHABET.length];
    return s;
  }
  for (let i = 0; i < LEN; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

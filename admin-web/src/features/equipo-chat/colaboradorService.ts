import {
  fnCrearColaborador,
  fnActualizarColaborador,
  fnEliminarColaborador,
} from "@/firebase/callables";

export async function crearColaborador(params: {
  negocioId: string;
  username: string;
  password: string;
  nombre?: string;
}): Promise<{ colaboradorId: string }> {
  const res = await fnCrearColaborador(params);
  return { colaboradorId: res.data.colaboradorId };
}

export async function actualizarColaborador(params: {
  negocioId: string;
  colaboradorId: string;
  nombre?: string;
  habilitado?: boolean;
  nuevoPassword?: string;
}): Promise<void> {
  await fnActualizarColaborador(params);
}

export async function eliminarColaborador(params: {
  negocioId: string;
  colaboradorId: string;
}): Promise<{ gruposLimpiados: number }> {
  const res = await fnEliminarColaborador(params);
  return { gruposLimpiados: res.data.gruposLimpiados };
}

/**
 * Genera un password aleatorio razonable para que el admin lo asigne sin
 * pensarlo. 12 chars de un alfabeto sin caracteres ambiguos (0/O, l/1).
 */
export function generarPasswordAleatorio(len = 12): string {
  const ALPHABET =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

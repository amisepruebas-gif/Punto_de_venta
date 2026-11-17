import type { TonoEscaneo } from "@shared";

/**
 * Un sonido distinto por respuesta del escaneo, para que quien recibe no
 * tenga que voltear a la pantalla en cada pieza. Con WebAudio (sin
 * archivos). Si el navegador no deja sonar (sin un toque previo, o sin
 * WebAudio), simplemente no suena.
 */

type Nota = { hz: number; ms: number; tipo?: OscillatorType };

const NOTAS: Record<TonoEscaneo, Nota[]> = {
  // Corto y agudo: todo bien.
  bien: [{ hz: 1320, ms: 90 }],
  // Dos iguales: ya estaba.
  repetido: [
    { hz: 880, ms: 90 },
    { hz: 880, ms: 90 },
  ],
  // Subiendo: hay de más.
  sobrante: [
    { hz: 660, ms: 110 },
    { hz: 990, ms: 140 },
  ],
  // Grave y largo: no se reconoce.
  desconocido: [{ hz: 220, ms: 380, tipo: "square" }],
  // Dos que suben suave: hay que elegir.
  pregunta: [
    { hz: 740, ms: 100 },
    { hz: 1110, ms: 100 },
  ],
};

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (ctx) return ctx;
  const AC =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function sonarTono(tono: TonoEscaneo): void {
  try {
    const c = contexto();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    let t = c.currentTime + 0.01;
    for (const n of NOTAS[tono]) {
      const osc = c.createOscillator();
      const vol = c.createGain();
      osc.type = n.tipo ?? "sine";
      osc.frequency.value = n.hz;
      // Entrada y salida suaves para que no truene la bocina.
      const fin = t + n.ms / 1000;
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      vol.gain.exponentialRampToValueAtTime(0.0001, fin);
      osc.connect(vol).connect(c.destination);
      osc.start(t);
      osc.stop(fin + 0.02);
      t = fin + 0.05;
    }
  } catch {
    // Sin sonido no pasa nada.
  }
}

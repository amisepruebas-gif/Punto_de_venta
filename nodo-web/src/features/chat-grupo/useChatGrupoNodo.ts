import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNodoSession } from "@/hooks/useNodoSession";
import { fnAsegurarChatGrupoNodo } from "@/firebase/callable";
// trackSnapshot requiere `path`; lo pasamos para telemetría per-doc.
import {
  fechaISOStrict,
  paths,
  type ChatMensaje,
  type ChatMeta,
} from "@shared";
import { leerMensajesDia, ymdKeyAnterior, ymdKeyHoy } from "./chatGrupoService";

export type MensajeRender = ChatMensaje & { ymd: string };

/** Tipo del valor de retorno del hook — se exporta para que `Ventas.tsx`
 *  pueda subir la instancia y pasarla como prop a `ChatGrupoModal`. Si se
 *  invocara el hook en dos lugares (Ventas y Modal), el efecto del audio
 *  reproduciría el sonido dos veces solapado. La instancia única evita eso. */
export type ChatGrupoNodoData = ReturnType<typeof useChatGrupoNodo>;

/**
 * Snapshot del meta del grupo + mensajes del día actual y días anteriores
 * cargados a demanda. Asegura que el doc del grupo exista (backfill via CF
 * si el nodo se registró antes de que existiera el sistema de chat).
 */
export function useChatGrupoNodo() {
  const { negocioId, nodoId } = useNodoSession();
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const [mensajesHoy, setMensajesHoy] = useState<ChatMensaje[]>([]);
  const [diasAnteriores, setDiasAnteriores] = useState<
    Array<{ ymd: string; mensajes: ChatMensaje[] }>
  >([]);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMasDias, setHayMasDias] = useState(true);
  const intentosVaciosRef = useRef(0);

  const ymdHoy = ymdKeyHoy();

  // Bootstrap del grupo (idempotente). Se ejecuta una vez al tener nodoId.
  useEffect(() => {
    if (!negocioId || !nodoId) return;
    let cancelado = false;
    setBootstrapping(true);
    setBootstrapError(null);
    fnAsegurarChatGrupoNodo({ negocioId, nodoId })
      .catch((err: unknown) => {
        if (cancelado) return;
        setBootstrapError(
          err instanceof Error ? err.message : "Error inicializando chat",
        );
      })
      .finally(() => {
        if (!cancelado) setBootstrapping(false);
      });
    return () => {
      cancelado = true;
    };
  }, [negocioId, nodoId]);

  // Snapshot del meta.
  useEffect(() => {
    if (!negocioId || !nodoId) {
      setMetaLoading(false);
      return;
    }
    const path = paths.chatGrupoMeta(negocioId, nodoId);
    const ref = doc(db, path);
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap, path);
        setMeta(snap.exists() ? (snap.data() as ChatMeta) : null);
        setMetaLoading(false);
      },
      (err) => {
        console.error("useChatGrupoNodo meta error:", err);
        setMetaLoading(false);
      },
    );
    return unsub;
  }, [negocioId, nodoId]);

  // Snapshot del día actual (mensajes en vivo).
  useEffect(() => {
    if (!negocioId || !nodoId) return;
    const path = paths.chatGrupoDia(negocioId, nodoId, ymdHoy);
    const ref = doc(db, path);
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap, path);
        if (!snap.exists()) {
          setMensajesHoy([]);
          return;
        }
        const data = snap.data() as { mensajes?: ChatMensaje[] };
        setMensajesHoy(Array.isArray(data.mensajes) ? data.mensajes : []);
      },
      (err) => {
        console.error("useChatGrupoNodo dia error:", err);
      },
    );
    return unsub;
  }, [negocioId, nodoId, ymdHoy]);

  /**
   * Carga el día anterior al más viejo cargado. Si encuentra 7 días vacíos
   * consecutivos, marca `hayMasDias=false` para parar la paginación.
   */
  const cargarDiaAnterior = useCallback(async () => {
    if (!negocioId || !nodoId || cargandoMas || !hayMasDias) return;
    setCargandoMas(true);
    try {
      const ultimo =
        diasAnteriores.length > 0
          ? diasAnteriores[diasAnteriores.length - 1].ymd
          : ymdHoy;
      let ymd = ymdKeyAnterior(ultimo);
      let intentos = intentosVaciosRef.current;
      // Cargar hasta encontrar un día con mensajes o agotarnos.
      while (intentos < 7) {
        const mensajes = await leerMensajesDia({ negocioId, nodoId, ymd });
        if (mensajes.length > 0) {
          intentosVaciosRef.current = 0;
          setDiasAnteriores((prev) => [...prev, { ymd, mensajes }]);
          return;
        }
        intentos++;
        ymd = ymdKeyAnterior(ymd);
      }
      // 7 días vacíos seguidos = asumimos que ya no hay más.
      intentosVaciosRef.current = intentos;
      setHayMasDias(false);
    } finally {
      setCargandoMas(false);
    }
  }, [negocioId, nodoId, ymdHoy, diasAnteriores, cargandoMas, hayMasDias]);

  // Concatena días anteriores (más viejos primero) + día de hoy.
  const mensajes: MensajeRender[] = [];
  for (let i = diasAnteriores.length - 1; i >= 0; i--) {
    const dia = diasAnteriores[i];
    for (const m of dia.mensajes) {
      mensajes.push({ ...m, ymd: dia.ymd });
    }
  }
  for (const m of mensajesHoy) {
    mensajes.push({ ...m, ymd: ymdHoy });
  }

  // ============================================================
  // Notificación al recibir mensaje nuevo no-propio (sonido).
  // ============================================================
  // Replica nodo_1.apk: cada mensaje nuevo de OTRO miembro dispara
  // `notificacion_1.mp3`. Usamos refs para:
  //   - `audioRef`: cachear el Audio() entre renders.
  //   - `mountedAtRef`: timestamp ISO de cuándo se montó el hook. Solo
  //     reproducimos sonido para mensajes con `fechaISO > mountedAt`.
  //     Esto cubre dos escenarios sin un guard de "primera ejecución":
  //       (a) Mount con mensajes históricos del día — todos tienen
  //           fechaISO anterior al mount, ninguno suena. ✓
  //       (b) Mount con mensajes=[] y llega el primero del día más
  //           tarde — su fechaISO > mountedAt, suena. ✓ (este caso
  //           lo arruinaba el guard previo basado en "primera ref").
  //   - `ultimaHuellaTocadaRef`: idempotencia. Si el mismo huella aparece
  //     dos veces (snapshot re-fire sin cambios), no re-reproducir.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mismo formato que el `fechaISO` de cada ChatMensaje (timezone MX) —
  // sin esto, comparar lex un timestamp UTC vs uno -06:00 da resultados
  // incorrectos en algunas franjas del día.
  const mountedAtRef = useRef<string>(fechaISOStrict());
  const ultimaHuellaTocadaRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      audioRef.current = new Audio("/sound/notificacion_1.mp3");
      audioRef.current.preload = "auto";
    }
  }, []);

  useEffect(() => {
    if (mensajesHoy.length === 0) return;
    const ultimo = mensajesHoy[mensajesHoy.length - 1];
    if (ultimo.huella === ultimaHuellaTocadaRef.current) return;
    ultimaHuellaTocadaRef.current = ultimo.huella;

    // Skip histórico: cualquier mensaje creado ANTES de que el hook
    // montara queda fuera (no reproducimos sonidos para mensajes que
    // el cajero ya había recibido en sesiones anteriores).
    if (ultimo.fechaISO <= mountedAtRef.current) return;

    // No reproducir si el mensaje es del propio nodo (lo escribí yo).
    if (ultimo.remitenteId === nodoId) return;

    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch((e) => {
      // Algunos browsers bloquean autoplay sin gesto previo. Como el
      // cajero ya interactuó (click/scan), suele estar OK; pero ante un
      // primer mensaje sin interacción previa puede fallar silencioso.
      console.warn("[chat] notificación audio bloqueada:", e);
    });
  }, [mensajesHoy, nodoId]);

  // ============================================================
  // Contador "no leídos" del día actual.
  // ============================================================
  // Cuenta mensajes de OTROS miembros con fechaISO > ultimaApertura.
  // Solo cuenta el día de hoy — días anteriores se consideran leídos.
  const ultimaApertura = nodoId
    ? meta?.estadoPorMiembro?.[nodoId]?.ultimaApertura
    : undefined;
  let noLeidos = 0;
  for (const m of mensajesHoy) {
    if (m.remitenteId === nodoId) continue;
    if (ultimaApertura && m.fechaISO <= ultimaApertura) continue;
    noLeidos++;
  }

  return {
    negocioId,
    nodoId,
    meta,
    mensajes,
    loading: metaLoading || bootstrapping,
    bootstrapError,
    cargandoMas,
    hayMasDias,
    cargarDiaAnterior,
    noLeidos,
  };
}

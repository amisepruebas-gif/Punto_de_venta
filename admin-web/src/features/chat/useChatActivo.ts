import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useNegocio } from "@/hooks/useNegocio";
import {
  paths,
  ymdMX,
  type ChatMensaje,
  type ChatMeta,
  type ChatTipo,
} from "@shared";
import { leerMensajesDia, ymdKeyAnterior } from "./chatAdminService";

export type MensajeRender = ChatMensaje & { ymd: string };

function ymdKeyHoy(): string {
  const { y, m, d } = ymdMX();
  return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
}

/**
 * Suscripción al chat activo (grupo o directo). Paginación día por día
 * (misma estrategia que `useChatGrupoNodo` en nodo-web: heurístico de 7
 * días vacíos consecutivos para detener el "Ver anteriores").
 *
 * Cuando `chatId` es null, no se suscribe.
 */
export function useChatActivo(args: {
  chatId: string | null;
  tipo: ChatTipo;
}) {
  const { chatId, tipo } = args;
  const { negocioId } = useNegocio();
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [mensajesHoy, setMensajesHoy] = useState<ChatMensaje[]>([]);
  const [diasAnteriores, setDiasAnteriores] = useState<
    Array<{ ymd: string; mensajes: ChatMensaje[] }>
  >([]);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMasDias, setHayMasDias] = useState(true);
  const intentosVaciosRef = useRef(0);

  const ymdHoy = ymdKeyHoy();

  // Reset al cambiar de chat.
  useEffect(() => {
    setMeta(null);
    setMetaLoading(true);
    setMensajesHoy([]);
    setDiasAnteriores([]);
    setHayMasDias(true);
    intentosVaciosRef.current = 0;
  }, [chatId, tipo]);

  // Meta.
  useEffect(() => {
    if (!negocioId || !chatId) {
      setMetaLoading(false);
      return;
    }
    const path =
      tipo === "grupo"
        ? paths.chatGrupoMeta(negocioId, chatId)
        : paths.chatDirectoMeta(negocioId, chatId);
    const ref = doc(db, path);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setMeta(snap.exists() ? (snap.data() as ChatMeta) : null);
        setMetaLoading(false);
      },
      (err) => {
        console.error("useChatActivo meta:", err);
        setMetaLoading(false);
      },
    );
    return unsub;
  }, [negocioId, chatId, tipo]);

  // Día actual.
  useEffect(() => {
    if (!negocioId || !chatId) return;
    const path =
      tipo === "grupo"
        ? paths.chatGrupoDia(negocioId, chatId, ymdHoy)
        : paths.chatDirectoDia(negocioId, chatId, ymdHoy);
    const ref = doc(db, path);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setMensajesHoy([]);
          return;
        }
        const data = snap.data() as { mensajes?: ChatMensaje[] };
        setMensajesHoy(Array.isArray(data.mensajes) ? data.mensajes : []);
      },
      (err) => {
        console.error("useChatActivo dia:", err);
      },
    );
    return unsub;
  }, [negocioId, chatId, tipo, ymdHoy]);

  const cargarDiaAnterior = useCallback(async () => {
    if (!negocioId || !chatId || cargandoMas || !hayMasDias) return;
    setCargandoMas(true);
    try {
      const ultimo =
        diasAnteriores.length > 0
          ? diasAnteriores[diasAnteriores.length - 1].ymd
          : ymdHoy;
      let ymd = ymdKeyAnterior(ultimo);
      let intentos = intentosVaciosRef.current;
      while (intentos < 7) {
        const mensajes = await leerMensajesDia({
          negocioId,
          chatId,
          tipo,
          ymd,
        });
        if (mensajes.length > 0) {
          intentosVaciosRef.current = 0;
          setDiasAnteriores((prev) => [...prev, { ymd, mensajes }]);
          return;
        }
        intentos++;
        ymd = ymdKeyAnterior(ymd);
      }
      intentosVaciosRef.current = intentos;
      setHayMasDias(false);
    } finally {
      setCargandoMas(false);
    }
  }, [negocioId, chatId, tipo, ymdHoy, diasAnteriores, cargandoMas, hayMasDias]);

  // Concatena días anteriores (más viejos primero) + hoy.
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

  return {
    negocioId,
    meta,
    mensajes,
    loading: metaLoading,
    cargandoMas,
    hayMasDias,
    cargarDiaAnterior,
  };
}

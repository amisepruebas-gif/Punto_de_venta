import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { useNegocio } from "@/hooks/useNegocio";
import {
  COL_CHAT_DIRECTOS,
  COL_CHAT_GRUPOS,
  paths,
  type ChatMeta,
} from "@shared";

export type ChatListItem = ChatMeta & {
  /** Doc id en Firestore. Para grupos = nodoId; para directos = pairId. */
  docId: string;
};

/**
 * Normaliza `fechaActividad` a milisegundos para poder ordenar.
 *
 * OJO: aunque el tipo `ChatMeta` declara `fechaActividad: string`, en runtime
 * el campo llega como un `Timestamp` de Firestore, porque tanto la CF
 * `inicializarChatGrupoNodo` como `chatAdminService` lo escriben con
 * `serverTimestamp()`. Un `Timestamp` NO tiene `.localeCompare`, así que
 * compararlo como string truena el callback de `onSnapshot` y vacía la lista
 * entera (sólo se notaba con ≥2 chats: `Array.sort` no invoca el comparador
 * con 0/1 elementos). Por eso normalizamos a número antes de ordenar.
 */
function tiempoOrden(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof v === "object") {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  return 0;
}

/**
 * Lista de chats accesibles al admin actual. Suscribe a `onSnapshot` para
 * mantener el preview del último mensaje en vivo.
 *
 * Reglas de visibilidad (replica el spec del doc 14):
 *   - `grupos`: el admin-real (superadmin) ve **todos** los grupos del
 *     negocio aunque no esté en `miembros` (decisión documentada en doc
 *     15 línea 128-132). El admin-delegado ve sólo los grupos donde está
 *     en `miembros`.
 *   - `directos`: ambos roles ven sólo aquellos donde el uid está en
 *     `miembros` — un admin no espía los 1-a-1 de otros admins.
 */
export function useChatList() {
  const auth = useAuth();
  const { negocioId } = useNegocio();
  const uid = auth.user?.user.uid ?? null;
  const role = auth.user?.claims.role ?? null;

  const [grupos, setGrupos] = useState<ChatListItem[]>([]);
  const [directos, setDirectos] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId || !uid) {
      setGrupos([]);
      setDirectos([]);
      setLoading(false);
      return;
    }

    const gruposCol = collection(
      db,
      `${paths.negocio(negocioId)}/${COL_CHAT_GRUPOS}`,
    );
    // Spec doc 14: tanto admin-real (superadmin) como admin-delegado ven
    // TODOS los grupos del negocio — el delegado "entra automáticamente
    // a todos los grupos". Solo los nodos/colaboradores se filtran por
    // miembros (no aplica aquí porque admin-web es exclusivo para roles
    // admin/superadmin). El auto-add a `meta.miembros` ocurre cuando el
    // delegado abre el grupo, vía `marcarAperturaAdmin(autoAddMember)`.
    const verTodos = role === "superadmin" || role === "admin";
    const gruposQuery = verTodos
      ? query(gruposCol)
      : query(gruposCol, where("miembros", "array-contains", uid));

    const unsubG = onSnapshot(
      gruposQuery,
      (snap) => {
        const arr: ChatListItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as ChatMeta;
          arr.push({ ...data, docId: d.id });
        });
        // Orden descendente por fechaActividad para que el chat más reciente
        // aparezca arriba.
        arr.sort(
          (a, b) => tiempoOrden(b.fechaActividad) - tiempoOrden(a.fechaActividad),
        );
        setGrupos(arr);
        setLoading(false);
      },
      (err) => {
        console.error("useChatList grupos:", err);
        setLoading(false);
      },
    );

    const directosCol = collection(
      db,
      `${paths.negocio(negocioId)}/${COL_CHAT_DIRECTOS}`,
    );
    const directosQuery = query(
      directosCol,
      where("miembros", "array-contains", uid),
    );
    const unsubD = onSnapshot(
      directosQuery,
      (snap) => {
        const arr: ChatListItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as ChatMeta;
          arr.push({ ...data, docId: d.id });
        });
        arr.sort(
          (a, b) => tiempoOrden(b.fechaActividad) - tiempoOrden(a.fechaActividad),
        );
        setDirectos(arr);
      },
      (err) => {
        console.error("useChatList directos:", err);
      },
    );

    return () => {
      unsubG();
      unsubD();
    };
  }, [negocioId, uid, role]);

  return { grupos, directos, loading, uid, role };
}

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import { trackSnapshot } from "@/lib/firestoreStats";
import { useNegocio } from "@/hooks/useNegocio";
import { paths, type AdminWhitelistEntry } from "@shared";

export type AdminWhitelistRow = AdminWhitelistEntry & {
  /** doc id (= emailKey). */
  id: string;
};

/**
 * Listener en vivo de los emails delegados habilitados/deshabilitados del
 * negocio. Usado por la pantalla de gestión y por el guardia de login
 * (no implementado todavía).
 */
export function useAdminWhitelist() {
  const { negocioId } = useNegocio();
  const [items, setItems] = useState<AdminWhitelistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }
    const ref = collection(db, paths.chatWhitelistAdminCol(negocioId));
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        trackSnapshot(snap);
        const rows: AdminWhitelistRow[] = [];
        snap.forEach((d) => {
          rows.push({ id: d.id, ...(d.data() as AdminWhitelistEntry) });
        });
        rows.sort((a, b) => a.email.localeCompare(b.email, "es"));
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error("useAdminWhitelist error:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, [negocioId]);

  return { items, loading };
}

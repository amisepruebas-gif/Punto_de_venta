import { useEffect, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/firebase/config";
import { enLineaOAvisar } from "@/lib/sinInternet";
import {
  paths,
  validarRenglonesPrecio,
  type Impresora,
  type RenglonEtiquetaPrecio,
  type TrabajoImpresion,
} from "@shared";

// ============================================================
// Etiquetas de precio desde la caja (como la app "codigos")
// ============================================================
//
// La caja deja una orden en la cola de impresión para la impresora de
// etiquetas de SU sucursal (PC con el programa "AMISE Impresora"). Solo con
// internet: la orden se crea en una transacción con su id fijo, así un
// reintento no manda dos veces.

export type ImpresoraVista = Impresora & { id: string };
export type TrabajoVista = TrabajoImpresion & { id: string };

const SIN_INTERNET = "Sin internet no se puede mandar a imprimir. Vuelve a intentar cuando regrese la conexión.";
const APAGADA =
  "Esa impresora está apagada en admin o ya no es de esta sucursal. Pide al administrador que la revise (Accesos → Impresoras de etiquetas).";

/** Firestore dijo que no: con la caja trabajando bien, es que la impresora
 *  está apagada (o se borró, o la cambiaron de sucursal). */
function traducirPermiso(e: unknown): never {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "permission-denied") throw new Error(APAGADA);
  throw e;
}

/** Las impresoras de etiquetas de esta sucursal, en vivo. */
export function useImpresorasSucursal(negocioId: string | null, sucursalId: string | null) {
  const [impresoras, setImpresoras] = useState<ImpresoraVista[] | null>(null);
  useEffect(() => {
    if (!negocioId || !sucursalId) {
      setImpresoras([]);
      return;
    }
    return onSnapshot(
      query(collection(db, paths.impresorasCol(negocioId)), where("sucursalId", "==", sucursalId)),
      (snap) => {
        const arr = snap.docs.map((d) => ({ ...(d.data() as Impresora), id: d.id }));
        arr.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
        setImpresoras(arr);
      },
      (err) => {
        console.warn("Impresoras de la sucursal:", err);
        setImpresoras([]);
      },
    );
  }, [negocioId, sucursalId]);
  return impresoras;
}

/** Una orden en vivo (su avance). */
export function useTrabajo(negocioId: string | null, trabajoId: string | null): TrabajoVista | null {
  const [trabajo, setTrabajo] = useState<TrabajoVista | null>(null);
  useEffect(() => {
    setTrabajo(null);
    if (!negocioId || !trabajoId) return;
    return onSnapshot(
      doc(db, paths.impresion(negocioId, trabajoId)),
      (s) => setTrabajo(s.exists() ? { ...(s.data() as TrabajoImpresion), id: s.id } : null),
      (err) => console.warn("Orden de impresión:", err),
    );
  }, [negocioId, trabajoId]);
  return trabajo;
}

/** Un id nuevo para una orden. La pantalla lo guarda: si sale "Sin internet"
 *  pero la orden sí llegó, al reintentar con lo mismo usa el MISMO id y la
 *  transacción la encuentra ya creada (no sale doble). */
export function idNuevaOrden(negocioId: string): string {
  return doc(collection(db, paths.impresionesCol(negocioId))).id;
}

export async function mandarEtiquetasPrecio(args: {
  negocioId: string;
  sucursalId: string;
  nodoId: string;
  impresoraId: string;
  renglones: RenglonEtiquetaPrecio[];
  quien?: string;
  /** De `idNuevaOrden`; el mismo en cada reintento de la misma orden. */
  trabajoId: string;
}): Promise<string> {
  const problemas = validarRenglonesPrecio(args.renglones);
  if (problemas.length > 0) throw new Error(problemas.join(". "));
  // Solo lo que se imprime (el nombre es de la pantalla).
  const renglones = args.renglones.map((r) => ({
    ...(r.codigo ? { codigo: r.codigo } : {}),
    precio: r.precio,
    piezas: r.piezas,
  }));
  // Las reglas piden que `creadoPor` sea el uid de la sesión (en una caja
  // re-vinculada puede no ser su nodoId).
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("La caja no tiene sesión. Cierra y vuelve a abrir la app.");
  return enLineaOAvisar(
    SIN_INTERNET,
    async (ctl) => {
      const ref = doc(db, paths.impresion(args.negocioId, args.trabajoId));
      await runTransaction(db, async (tx) => {
        ctl.siAbandonada();
        const ya = await tx.get(ref);
        if (ya.exists()) return;
        ctl.vaAEscribir();
        tx.set(ref, {
          tipo: "etiquetas_precio",
          impresoraId: args.impresoraId,
          estado: "pendiente",
          origen: "nodo",
          creadoPor: uid,
          ...(args.quien?.trim() ? { quien: args.quien.trim().slice(0, 80) } : {}),
          creadoEn: serverTimestamp(),
          renglones,
          nodoId: args.nodoId,
          sucursalId: args.sucursalId,
        });
      }).catch(traducirPermiso);
      return ref.id;
    },
    { limiteMs: 15_000 },
  );
}

/** "Reimprimir": la regresa a la cola. */
export async function reimprimirEtiquetas(negocioId: string, trabajoId: string): Promise<void> {
  await enLineaOAvisar(SIN_INTERNET, async (ctl) => {
    const ref = doc(db, paths.impresion(negocioId, trabajoId));
    await runTransaction(db, async (tx) => {
      ctl.siAbandonada();
      const s = await tx.get(ref);
      if (!s.exists()) throw new Error("Esa orden ya no existe");
      const t = s.data() as TrabajoImpresion;
      if (t.estado === "pendiente" || t.estado === "imprimiendo") return;
      ctl.vaAEscribir();
      tx.update(ref, { estado: "pendiente", error: deleteField() });
    }).catch(traducirPermiso);
  });
}

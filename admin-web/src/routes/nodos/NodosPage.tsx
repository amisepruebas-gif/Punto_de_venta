import { useEffect, useMemo, useState } from "react";
import { Ban, Smartphone, History, RefreshCw } from "lucide-react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { useNodos } from "@/features/nodos/useNodos";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { fnRevocarNodo } from "@/firebase/callables";
import { Button } from "@/components/ui/button";
import { db } from "@/firebase/config";
import {
  COL_NEGOCIOS,
  COL_DATOS,
  DOC_REFRESCO_RENDER,
  fechaISO_MX,
  generarID,
  type Nodo,
} from "@shared";

export function NodosPage() {
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { nodos, loading } = useNodos();
  const { sucursales } = useSucursales();
  const [filtroSucursal, setFiltroSucursal] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Nodo | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);
  const [forzando, setForzando] = useState(false);
  const [ultimoRefresco, setUltimoRefresco] = useState<{
    fecha?: string;
    by?: string;
  } | null>(null);

  // Subscribe al doc para mostrar cuándo fue la última recarga forzada y
  // por quién — feedback útil cuando hay varios admins.
  useEffect(() => {
    if (!negocioId) return;
    const ref = doc(
      db,
      `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_REFRESCO_RENDER}`,
    );
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setUltimoRefresco(null);
          return;
        }
        const d = snap.data() as { fecha?: string; by?: string };
        setUltimoRefresco({ fecha: d.fecha, by: d.by });
      },
      () => setUltimoRefresco(null),
    );
  }, [negocioId]);

  async function onForzarRecarga() {
    if (!negocioId || forzando) return;
    if (
      !confirm(
        "¿Forzar recarga del renderizado en TODOS los nodos del negocio?\n\n" +
          "Cada tablet desregistrará su Service Worker, borrará el caché de " +
          "JS/CSS/HTML y recargará la app. La caché de imágenes y los datos " +
          "del negocio NO se tocan.",
      )
    ) return;
    setForzando(true);
    try {
      const ref = doc(
        db,
        `${COL_NEGOCIOS}/${negocioId}/${COL_DATOS}/${DOC_REFRESCO_RENDER}`,
      );
      await setDoc(
        ref,
        {
          huella: generarID(),
          fecha: fechaISO_MX(),
          fechaServer: serverTimestamp(),
          ...(user?.user.email ? { by: user.user.email } : {}),
        },
        { merge: true },
      );
    } catch (err) {
      alert("Error al forzar recarga: " + (err as Error).message);
    } finally {
      setForzando(false);
    }
  }

  const filtrados = useMemo(() => {
    return filtroSucursal
      ? nodos.filter((n) => n.sucursalId === filtroSucursal)
      : nodos;
  }, [nodos, filtroSucursal]);

  const sucursalesMap = useMemo(() => {
    const m = new Map<string, string>();
    sucursales.forEach((s) => m.set(s.sucursalId, s.nombre));
    return m;
  }, [sucursales]);

  async function onRevocar(n: Nodo) {
    if (!negocioId) return;
    if (
      !confirm(
        `Revocar nodo "${n.nombre}"?\nSe invalidarán sus tokens y la tablet perderá acceso. Podrá re-vincularse a otro nodo.`,
      )
    ) return;
    setRevocando(n.nodoId);
    try {
      await fnRevocarNodo({ negocioId, nodoId: n.nodoId });
    } catch (err) {
      alert("Error: " + (err as Error).message);
    } finally {
      setRevocando(null);
    }
  }

  return (
    <div className="container max-w-5xl space-y-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nodos</h1>
          <p className="text-sm text-muted-foreground">
            Tablets registradas ({nodos.length} total)
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            onClick={onForzarRecarga}
            disabled={forzando || !negocioId}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${forzando ? "animate-spin" : ""}`}
            />
            {forzando ? "Forzando…" : "Forzar recarga de nodos"}
          </Button>
          {ultimoRefresco?.fecha && (
            <p className="text-[11px] text-muted-foreground">
              Última: {ultimoRefresco.fecha}
              {ultimoRefresco.by ? ` · ${ultimoRefresco.by}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Filtro por sucursal */}
      {sucursales.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filtroSucursal === null ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroSucursal(null)}
          >
            Todas
          </Button>
          {sucursales.map((s) => (
            <Button
              key={s.sucursalId}
              variant={filtroSucursal === s.sucursalId ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroSucursal(s.sucursalId)}
            >
              {s.nombre}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Smartphone className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Sin nodos</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Sucursal</th>
                <th className="px-4 py-2 font-medium">Registrado por</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((n) => (
                <tr key={n.nodoId} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{n.nombre}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {sucursalesMap.get(n.sucursalId) ?? n.sucursalId}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {n.registradoPor}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        n.estado === "activo"
                          ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                      }
                    >
                      {n.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetalle(n)}
                      >
                        <History className="mr-1 h-3 w-3" /> Historial
                      </Button>
                      {n.estado === "activo" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onRevocar(n)}
                          disabled={revocando === n.nodoId}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          {revocando === n.nodoId ? "…" : "Revocar"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && <NodoDetalleModal nodo={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

function NodoDetalleModal({ nodo, onClose }: { nodo: Nodo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="w-full max-w-lg space-y-4 rounded-lg bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold">{nodo.nombre}</h2>
          <p className="text-sm text-muted-foreground">
            ID: {nodo.nodoId.slice(0, 12)}…
          </p>
        </div>
        <div className="space-y-1 rounded-md border bg-background p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Registrado por:</span>{" "}
            {nodo.registradoPor}
          </p>
          <p>
            <span className="text-muted-foreground">User agent:</span>{" "}
            <span className="text-xs">{nodo.userAgent}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Estado:</span> {nodo.estado}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Historial</h3>
          <ul className="space-y-1 rounded-md border bg-background p-3 text-xs">
            {(nodo.historial ?? []).length === 0 && (
              <li className="text-muted-foreground">Sin eventos</li>
            )}
            {(nodo.historial ?? []).map((h, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  <strong>{h.tipo}</strong>{" "}
                  {h.detalle && (
                    <span className="text-muted-foreground">· {h.detalle}</span>
                  )}
                </span>
                <span className="text-muted-foreground">{h.fecha}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={onClose} className="w-full">
          Cerrar
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Database, Layers } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { FirestoreStatsCard } from "@/features/ajustes/FirestoreStatsCard";
import { useAuth } from "@/hooks/useAuth";
import { useNegocio } from "@/hooks/useNegocio";
import { paths } from "@shared";

export function AjustesPage() {
  const { user } = useAuth();
  const { negocio, negocioId } = useNegocio();
  const [savingFlag, setSavingFlag] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  async function toggleSubvariacionesV2(activar: boolean) {
    if (!negocioId) return;
    if (activar) {
      if (
        !confirm(
          "¿Activar subvariaciones v2?\n\n" +
            "Los nodos de esta sucursal pasan a:\n" +
            "  • bloquear el escaneo de artículos padre con variaciones,\n" +
            "  • resolver códigos v-NN-XXX y vender la variación específica,\n" +
            "  • mostrar variaciones (no padres) en el autocomplete.\n\n" +
            "Asegúrate de haber corrido la migración Fase 4 antes.",
        )
      )
        return;
    }
    setSavingFlag(true);
    setFlagError(null);
    try {
      await updateDoc(doc(db, paths.negocio(negocioId)), {
        usaSubvariacionesV2: activar,
      });
    } catch (err) {
      setFlagError((err as Error).message);
    } finally {
      setSavingFlag(false);
    }
  }

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Configuración, estadísticas y herramientas
        </p>
      </div>

      <FirestoreStatsCard />

      <section className="rounded-lg border bg-card p-5 space-y-2">
        <h3 className="font-semibold">Cuenta</h3>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Email: </span>
            {user?.user.email}
          </p>
          <p>
            <span className="text-muted-foreground">Rol: </span>
            {user?.claims.role ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Negocio: </span>
            {negocio?.nombre ?? negocioId ?? "—"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">Subvariaciones v2 en POS</p>
            <p className="text-xs text-muted-foreground">
              Activa la nueva ruta de subvariaciones en los nodos: el padre
              con variaciones se inhabilita al escaneo, y los códigos
              <code className="mx-1 font-mono">v-NN-XXX</code>
              resuelven a la variación. Sin esta bandera, el POS opera en
              modo legacy y los códigos nuevos se ignoran.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Requiere haber corrido las migraciones Fase 3 y Fase 4.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
          <span className="font-medium">
            {negocio?.usaSubvariacionesV2
              ? "✓ Activa para este negocio"
              : "Inactiva (modo legacy)"}
          </span>
          <input
            type="checkbox"
            checked={!!negocio?.usaSubvariacionesV2}
            onChange={(e) => toggleSubvariacionesV2(e.target.checked)}
            disabled={savingFlag || !negocioId}
            className="h-4 w-4"
          />
        </label>
        {flagError && (
          <p className="text-xs text-destructive">{flagError}</p>
        )}
      </section>

      <section className="rounded-lg border bg-card overflow-hidden">
        <h3 className="p-5 pb-2 font-semibold">Herramientas</h3>
        <Link
          to="/ajustes/migracion"
          className="flex items-center gap-3 border-t px-5 py-3 text-sm hover:bg-accent"
        >
          <Database className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">Migración legacy</p>
            <p className="text-xs text-muted-foreground">
              Copiar datos del Android antiguo al namespace nuevo
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}

import { Cloud, HardDrive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirestoreStats } from "@/lib/firestoreStats";

/**
 * Badge/card que muestra cuántos snapshots Firestore han salido desde el
 * caché local (IndexedDB) vs desde la nube. Útil para auditar el trabajo
 * de Persistent Cache: tras un F5 lo normal es que la primera vez haya más
 * "nube" y en recargas siguientes predominio de "local".
 */
export function FirestoreStatsCard() {
  const { cacheHits, serverHits, lastResetAt, reset } = useFirestoreStats();
  const total = cacheHits + serverHits;
  const pctCache = total > 0 ? Math.round((cacheHits / total) * 100) : 0;
  const pctServer = total > 0 ? 100 - pctCache : 0;

  const elapsed = formatElapsed(Date.now() - lastResetAt);

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">Tráfico Firestore</h3>
          <p className="text-xs text-muted-foreground">
            Snapshots locales vs nube desde hace {elapsed}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          title="Reiniciar contadores"
        >
          <RotateCcw className="mr-1 h-3 w-3" /> Resetear
        </Button>
      </div>

      {total === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Sin snapshots registrados todavía. Navega por la app para ver tráfico.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                Local (cache)
              </span>
              <span className="font-semibold">
                {pctCache}% · {cacheHits}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pctCache}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-blue-500" />
                Nube (servidor)
              </span>
              <span className="font-semibold">
                {pctServer}% · {serverHits}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${pctServer}%` }}
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              ({pctCache}% local / {pctServer}% nube)
            </p>
            <p className="mt-1">
              Total: {total} snapshots.{" "}
              {pctCache >= 70
                ? "El cache está trabajando bien."
                : pctCache >= 30
                  ? "Balance mixto — normal tras primer load o al cambiar filtros."
                  : "Predominio de nube — probable cache vacío o datos recientes."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

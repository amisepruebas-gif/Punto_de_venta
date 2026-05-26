import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  estadisticasCacheImagenes,
  posDisponible,
  type EstadisticasCacheImagenes,
} from "@/lib/pos-bridge";

const REFRESH_MS = 5_000;

/**
 * Panel de telemetría del cache nativo de imágenes (solo en APK).
 *
 * Muestra hits/misses/bytes evitados acumulados — persistidos a disco, así
 * que sobreviven reinicios de la app. Útil para verificar empíricamente
 * que el ahorro de facturación de Firebase Storage está ocurriendo
 * después de desplegar la Fase 2 (re-key por path canónico + GC
 * reconciliador).
 *
 * En navegador normal (no APK) la card se oculta — los contadores no
 * aplican porque ahí no hay cache nativo.
 */
export function CacheStatsCard() {
  const enApk = posDisponible();
  const [stats, setStats] = useState<EstadisticasCacheImagenes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enApk) return;
    let cancelado = false;
    function refrescar() {
      const r = estadisticasCacheImagenes();
      if (cancelado) return;
      if (r.ok) {
        setStats(r.data);
        setError(null);
      } else {
        setError(r.error);
      }
    }
    refrescar();
    const t = setInterval(refrescar, REFRESH_MS);
    return () => {
      cancelado = true;
      clearInterval(t);
    };
  }, [enApk]);

  if (!enApk) return null;

  const total = stats ? stats.hits + stats.misses : 0;
  const hitRate = total > 0 ? Math.round((stats!.hits / total) * 100) : 0;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Caché de imágenes (APK)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Estadísticas del caché nativo de catálogo y chat. Persisten entre
        reinicios; se reinician al "Vaciar caché de imágenes".
      </p>
      {error && !stats && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {stats && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Stat label="Hits" valor={stats.hits.toLocaleString()} />
          <Stat label="Misses" valor={stats.misses.toLocaleString()} />
          <Stat
            label="Hit rate"
            valor={total > 0 ? `${hitRate}%` : "—"}
          />
          <Stat
            label="Bytes evitados"
            valor={bytesHuman(stats.bytesEvitados)}
          />
          <Stat
            label="Archivos en caché"
            valor={stats.archivosEnCache.toLocaleString()}
          />
          <Stat
            label="Espacio en disco"
            valor={bytesHuman(stats.bytesEnDisco)}
          />
        </dl>
      )}
    </section>
  );
}

function Stat({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{valor}</dd>
    </div>
  );
}

function bytesHuman(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

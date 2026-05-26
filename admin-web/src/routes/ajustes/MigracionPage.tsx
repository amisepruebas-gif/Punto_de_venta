import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  Layers,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  fnMigrarDataLegacy,
  fnMigrarArticulosLegacy,
  fnMigrarSubvariacionesLegacy,
  fnLimpiarLegacyArticulos,
  type MigrarDataLegacyOutput,
  type MigrarArticulosLegacyOutput,
  type MigrarSubvariacionesLegacyOutput,
  type LimpiarLegacyArticulosOutput,
} from "@/firebase/callables";

// "datos" removido del default — la nueva arquitectura los maneja distinto.
// Si se necesitase migrar manualmente, llamar la CF con solo: "datos".
type Tipo = "articulos" | "ventas" | "cortes" | "mensajes" | "";

export function MigracionPage() {
  const { negocioId } = useNegocio();
  const { sucursales } = useSucursales();
  const [sucursalId, setSucursalId] = useState<string>("");
  const [tipo, setTipo] = useState<Tipo>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrarDataLegacyOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correr(dryRun: boolean) {
    if (!negocioId || !sucursalId) {
      setError("Selecciona una sucursal donde mapear ventas/cortes/apartados");
      return;
    }
    if (!dryRun) {
      if (
        !confirm(
          "¿Ejecutar migración REAL?\n\n" +
            "Se escribirán los docs legacy al namespace nuevo. Es idempotente " +
            "(re-runs no duplican), pero es buena idea correr 'dry-run' primero.",
        )
      ) {
        return;
      }
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fnMigrarDataLegacy({
        negocioId,
        sucursalId,
        dryRun,
        ...(tipo ? { solo: tipo } : {}),
      });
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container max-w-3xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Migración de datos legacy
        </h1>
        <p className="text-sm text-muted-foreground">
          Copia las colecciones del Android antiguo al namespace web nuevo
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Antes de migrar</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs">
            <li>Corre primero "Dry-run" para ver los conteos sin escribir.</li>
            <li>
              La sucursal seleccionada será el destino de{" "}
              <strong>ventas, cortes y apartados</strong> legacy. Los artículos
              y mensajes se asignan al negocio (no a una sucursal).
            </li>
            <li>
              La migración es idempotente: puedes re-ejecutarla y no duplica
              (usa la huella del doc original como ID).
            </li>
            <li>
              Procesa años completos (una sola vez típicamente basta). El
              timeout del Cloud Function es 9 min.
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Sucursal destino (ventas/cortes/apartados)</Label>
          <select
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Elige sucursal…</option>
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
          {sucursales.length === 0 && (
            <p className="text-xs text-destructive">
              Crea una sucursal primero (p.ej. "Legacy")
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Solo un tipo (opcional)</Label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Tipo)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todo</option>
            <option value="articulos">articulos_n</option>
            <option value="ventas">ventas_n</option>
            <option value="cortes">corte_1</option>
            <option value="mensajes">mensajes_n</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => correr(true)}
          disabled={running || !sucursalId}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Ejecutando…" : "Dry-run (reporta sin escribir)"}
        </Button>
        <Button
          onClick={() => correr(false)}
          disabled={running || !sucursalId}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Migrando…" : "Migrar ahora"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.errores.length === 0
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            {result.errores.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <h3 className="font-semibold">
              {result.dryRun ? "Dry-run completo" : "Migración completa"}
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
            <Stat label="articulos" value={result.articulos} />
            <Stat label="ventas" value={result.ventas} />
            <Stat label="cortes" value={result.cortes} />
            <Stat label="mensajes" value={result.mensajes} />
            <Stat label="apartados" value={result.apartados} />
            <Stat label="datos" value={result.datos} />
          </div>
          {result.errores.length > 0 && (
            <div className="mt-3 space-y-1 rounded-md border bg-background p-3 text-sm">
              <p className="font-medium text-destructive">
                Errores ({result.errores.length})
              </p>
              <ul className="list-disc pl-4 text-xs">
                {result.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <MigrarArticulosV2Section />
      <MigrarSubvariacionesV2Section />
      <LimpiarLegacySection />
    </div>
  );
}

// ============================================================
// Migración Fase 3 — artículos a categorías v2
// ============================================================
function MigrarArticulosV2Section() {
  const { negocioId } = useNegocio();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrarArticulosLegacyOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correr(dryRun: boolean) {
    if (!negocioId) return;
    if (!dryRun) {
      if (
        !confirm(
          "¿Migrar artículos a categorías v2 (REAL)?\n\n" +
            "Convierte género/subgénero en categorías y subcategorías universales, " +
            "y hashtags en etiquetas[]. Idempotente. No borra los campos legacy.",
        )
      ) {
        return;
      }
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fnMigrarArticulosLegacy({ negocioId, dryRun });
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-8 space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <FolderTree className="h-5 w-5" />
        <h2 className="text-xl font-semibold tracking-tight">
          Artículos → Categorías v2
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Convierte los campos legacy <code>genero</code>, <code>subgenero</code> y{" "}
        <code>hashtags</code> de cada artículo en{" "}
        <code>categoriaId</code>, <code>subcategoriaId</code> y{" "}
        <code>etiquetas[]</code>. Crea las colecciones <code>categorias</code> y{" "}
        <code>subcategorias</code> automáticamente. Idempotente: re-ejecutar no
        duplica nada. <strong>No borra los campos legacy</strong> (eso ocurre en
        la Fase 6).
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => correr(true)}
          disabled={running || !negocioId}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Ejecutando…" : "Dry-run"}
        </Button>
        <Button onClick={() => correr(false)} disabled={running || !negocioId}>
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Migrando…" : "Migrar ahora"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.errores.length === 0
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            {result.errores.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <h3 className="font-semibold">
              {result.dryRun ? "Dry-run completo" : "Migración completa"}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Stat label="leídos" value={result.articulosLeidos} />
            <Stat label="actualizados" value={result.articulosTocados} />
            <Stat label="categorías" value={result.categoriasCreadas} />
            <Stat label="subcategorías" value={result.subcategoriasCreadas} />
            <Stat label="etiquetas" value={result.etiquetasPobladas} />
          </div>
          {result.errores.length > 0 && (
            <div className="mt-3 space-y-1 rounded-md border bg-background p-3 text-sm">
              <p className="font-medium text-destructive">
                Errores ({result.errores.length})
              </p>
              <ul className="list-disc pl-4 text-xs">
                {result.errores.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">#{e.articuloId}</span> —{" "}
                    {e.error}
                  </li>
                ))}
                {result.errores.length > 20 && (
                  <li>… y {result.errores.length - 20} más</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Migración Fase 4 — subvariaciones a codigos v-NN-XXX + Storage
// ============================================================
function MigrarSubvariacionesV2Section() {
  const { negocioId } = useNegocio();
  const [running, setRunning] = useState(false);
  const [result, setResult] =
    useState<MigrarSubvariacionesLegacyOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correr(dryRun: boolean) {
    if (!negocioId) return;
    if (!dryRun) {
      if (
        !confirm(
          "¿Migrar subvariaciones a v2 (REAL)?\n\n" +
            "Asigna codigo v-NN-XXX a cada subvariación existente y mueve sus " +
            "imágenes en Storage al path estable. Idempotente. Sin rollback " +
            "automático del move — corre primero el dry-run.",
        )
      ) {
        return;
      }
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fnMigrarSubvariacionesLegacy({ negocioId, dryRun });
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-8 space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5" />
        <h2 className="text-xl font-semibold tracking-tight">
          Subvariaciones → v-NN-XXX
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Asigna codigos escaneables <code>v-NN-XXX</code> a las subvariaciones
        existentes y mueve sus imágenes en Storage de{" "}
        <code>_sv&#123;idx&#125;.webp</code> a{" "}
        <code>_v-NN-XXX.webp</code>. También calcula{" "}
        <code>articulo.cantidad = sum(subvariaciones.cantidad)</code> como
        snapshot informativo. <strong>Idempotente</strong>: re-ejecutar no
        re-asigna codigos ni mueve archivos ya movidos.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => correr(true)}
          disabled={running || !negocioId}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Ejecutando…" : "Dry-run"}
        </Button>
        <Button onClick={() => correr(false)} disabled={running || !negocioId}>
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Migrando…" : "Migrar ahora"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.errores.length === 0
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            {result.errores.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <h3 className="font-semibold">
              {result.dryRun ? "Dry-run completo" : "Migración completa"}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Stat label="leídos" value={result.articulosLeidos} />
            <Stat label="actualizados" value={result.articulosTocados} />
            <Stat label="codigos" value={result.codigosAsignados} />
            <Stat label="archivos OK" value={result.archivosMovidos} />
            <Stat label="archivos err" value={result.archivosFallidos} />
          </div>
          {result.errores.length > 0 && (
            <div className="mt-3 space-y-1 rounded-md border bg-background p-3 text-sm">
              <p className="font-medium text-destructive">
                Errores ({result.errores.length})
              </p>
              <ul className="list-disc pl-4 text-xs">
                {result.errores.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">#{e.articuloId}</span> —{" "}
                    {e.error}
                  </li>
                ))}
                {result.errores.length > 20 && (
                  <li>… y {result.errores.length - 20} más</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Limpieza Fase 6 — borrar campos legacy genero/subgenero/hashtags
// ============================================================
function LimpiarLegacySection() {
  const { negocioId } = useNegocio();
  const [running, setRunning] = useState(false);
  const [result, setResult] =
    useState<LimpiarLegacyArticulosOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correr(dryRun: boolean) {
    if (!negocioId) return;
    if (!dryRun) {
      if (
        !confirm(
          "ATENCIÓN — operación DESTRUCTIVA\n\n" +
            "Borrará permanentemente los campos genero, subgenero y hashtags " +
            "de todos los artículos del negocio. ¿Tienes BACKUP de Firestore?",
        )
      ) {
        return;
      }
      if (
        !confirm(
          "Confirma de nuevo: ¿proceder con la limpieza? No hay vuelta atrás " +
            "sin restaurar desde backup.",
        )
      ) {
        return;
      }
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fnLimpiarLegacyArticulos({ negocioId, dryRun });
      setResult(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-8 space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-destructive" />
        <h2 className="text-xl font-semibold tracking-tight">
          Limpieza legacy (Fase 6)
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Borra los campos <code>genero</code>, <code>subgenero</code> y{" "}
        <code>hashtags</code> de todos los artículos. Solo correr <strong>
          después
        </strong>{" "}
        de validar que la migración Fase 3 quedó completa y que el negocio ha
        operado sin esos campos. <strong className="text-destructive">
          Operación destructiva
        </strong>{" "}
        — exige backup de Firestore previo.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => correr(true)}
          disabled={running || !negocioId}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          {running ? "Ejecutando…" : "Dry-run (cuenta sin borrar)"}
        </Button>
        <Button
          variant="destructive"
          onClick={() => correr(false)}
          disabled={running || !negocioId}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {running ? "Limpiando…" : "Limpiar ahora"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.errores.length === 0
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            {result.errores.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <h3 className="font-semibold">
              {result.dryRun ? "Dry-run completo" : "Limpieza completa"}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Stat label="leídos" value={result.articulosLeidos} />
            <Stat label="actualizados" value={result.articulosTocados} />
            <Stat label="genero" value={result.camposGeneroBorrados} />
            <Stat label="subgenero" value={result.camposSubgeneroBorrados} />
            <Stat label="hashtags" value={result.camposHashtagsBorrados} />
          </div>
          {result.errores.length > 0 && (
            <div className="mt-3 space-y-1 rounded-md border bg-background p-3 text-sm">
              <p className="font-medium text-destructive">
                Errores ({result.errores.length})
              </p>
              <ul className="list-disc pl-4 text-xs">
                {result.errores.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">#{e.articuloId}</span> —{" "}
                    {e.error}
                  </li>
                ))}
                {result.errores.length > 20 && (
                  <li>… y {result.errores.length - 20} más</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

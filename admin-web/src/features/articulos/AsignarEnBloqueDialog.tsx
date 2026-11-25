import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CampoConNuevo } from "@/features/categorias/CategoriaInlineSelect";
import { asegurarCategoria } from "@/features/categorias/categoriaService";
import { asegurarGenero } from "@/features/categorias/generoService";
import { EtiquetasInput } from "@/features/fabricacion/EtiquetasInput";
import {
  SIN_CAMBIOS_CLASIFICACION,
  calcularCambioClasificacion,
  clasificacionMayoreoProtegida,
  normalizarEtiqueta,
  type Articulo,
  type CambioCampo,
  type CambiosClasificacion,
  type Categoria,
  type Genero,
  type Subcategoria,
} from "@shared";
import { asignarClasificacionEnBloque, type CambioArticulo } from "./asignacionEnBloqueService";

const QUITAR = "__quitar__";
const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

/** "" = no cambiar · QUITAR = quitar · id = poner. */
function aValor(c: CambioCampo): string {
  return c.accion === "igual" ? "" : c.accion === "quitar" ? QUITAR : c.id;
}
function deValor(v: string): CambioCampo {
  return v === "" ? { accion: "igual" } : v === QUITAR ? { accion: "quitar" } : { accion: "poner", id: v };
}

/**
 * Pone categoría, subcategoría, género y etiquetas a muchos artículos de una
 * vez. Lo que se deja en "No cambiar" no se toca. Calcula en vivo cuántos
 * artículos cambian de verdad (`calcularCambioClasificacion`) y solo guarda
 * esos.
 */
export function AsignarEnBloqueDialog({
  negocioId,
  articulos,
  categorias,
  subcategorias,
  generos,
  onCerrar,
  onListo,
}: {
  negocioId: string;
  /** Los artículos seleccionados, del snapshot vivo de la lista. */
  articulos: Articulo[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  generos: Genero[];
  onCerrar: () => void;
  onListo: (cambiados: number) => void;
}) {
  const [cambios, setCambios] = useState<CambiosClasificacion>(SIN_CAMBIOS_CLASIFICACION);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const padres = useMemo(
    () => new Map(subcategorias.map((sc) => [sc.subcategoriaId, sc.categoriaId])),
    [subcategorias],
  );

  const pendientes = useMemo(() => {
    const out: CambioArticulo[] = [];
    for (const a of articulos) {
      const patch = calcularCambioClasificacion(a, cambios, padres);
      if (patch) out.push({ id: a.id, patch });
    }
    return out;
  }, [articulos, cambios, padres]);

  // Los de mayoreo siempre llevan categoría y subcategoría (de ahí sale su
  // precio): si el cambio los dejaría sin alguna, conservan las dos.
  const protegidos = useMemo(
    () => articulos.filter((a) => clasificacionMayoreoProtegida(a, cambios, padres)).length,
    [articulos, cambios, padres],
  );

  // Etiquetas que ya tienen los seleccionados, para quitarlas con un toque.
  const etiquetasEnSeleccion = useMemo(() => {
    const m = new Map<string, { etiqueta: string; n: number }>();
    for (const a of articulos) {
      for (const t of a.etiquetas ?? []) {
        const k = normalizarEtiqueta(t);
        if (!k) continue;
        const e = m.get(k);
        if (e) e.n++;
        else m.set(k, { etiqueta: t, n: 1 });
      }
    }
    return [...m.entries()].sort(
      (x, y) => y[1].n - x[1].n || x[1].etiqueta.localeCompare(y[1].etiqueta, "es"),
    );
  }, [articulos]);

  const categoriaPuesta = cambios.categoria.accion === "poner" ? cambios.categoria.id : null;
  const subsDeCategoria = categoriaPuesta
    ? subcategorias.filter((sc) => sc.categoriaId === categoriaPuesta)
    : [];
  const quitarSet = new Set(cambios.quitarEtiquetas.map(normalizarEtiqueta));

  function set<K extends keyof CambiosClasificacion>(k: K, v: CambiosClasificacion[K]) {
    setCambios((c) => ({ ...c, [k]: v }));
  }

  function alternarQuitar(k: string, etiqueta: string) {
    setCambios((c) => ({
      ...c,
      quitarEtiquetas: quitarSet.has(k)
        ? c.quitarEtiquetas.filter((t) => normalizarEtiqueta(t) !== k)
        : [...c.quitarEtiquetas, etiqueta],
    }));
  }

  async function asignar() {
    if (pendientes.length === 0) return;
    setGuardando(true);
    setError(null);
    setProgreso({ hechos: 0, total: pendientes.length });
    try {
      await asignarClasificacionEnBloque(negocioId, pendientes, (hechos, total) =>
        setProgreso({ hechos, total }),
      );
      onListo(pendientes.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !guardando && onCerrar()}
      role="dialog"
      aria-modal
      aria-label="Asignar en bloque"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-card p-5 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold">
            Asignar a {articulos.length} {articulos.length === 1 ? "artículo" : "artículos"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Lo que dejes en "No cambiar" no se toca.
          </p>
        </div>

        <CampoConNuevo
          etiqueta="Categoría"
          placeholderNuevo="Ej. Llavero"
          valor={aValor(cambios.categoria)}
          opciones={[
            { id: QUITAR, nombre: "Quitar la categoría" },
            ...categorias.map((c) => ({ id: c.categoriaId, nombre: c.nombre })),
          ]}
          vacio="— No cambiar —"
          onElegir={(v) =>
            setCambios((c) => ({ ...c, categoria: deValor(v), subcategoria: { accion: "igual" } }))
          }
          onCrear={async (nombre) => {
            const c = await asegurarCategoria(negocioId, nombre);
            setCambios((s) => ({
              ...s,
              categoria: { accion: "poner", id: c.categoriaId },
              subcategoria: { accion: "igual" },
            }));
          }}
        />

        <div className="space-y-1.5">
          <Label htmlFor="bloque-sub">Subcategoría</Label>
          <select
            id="bloque-sub"
            value={aValor(cambios.subcategoria)}
            onChange={(e) => set("subcategoria", deValor(e.target.value))}
            disabled={cambios.categoria.accion === "quitar"}
            className={SELECT_CLS}
          >
            <option value="">— No cambiar —</option>
            <option value={QUITAR}>Quitar la subcategoría</option>
            {subsDeCategoria.map((sc) => (
              <option key={sc.subcategoriaId} value={sc.subcategoriaId}>
                {sc.nombre}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {cambios.categoria.accion === "quitar"
              ? "Se quita junto con la categoría."
              : categoriaPuesta
                ? "Al cambiar la categoría se quita la subcategoría que no sea de ella."
                : "Para poner una subcategoría, elige primero la categoría."}
          </p>
        </div>

        <CampoConNuevo
          etiqueta="Género"
          placeholderNuevo="Ej. Anime"
          valor={aValor(cambios.genero)}
          opciones={[
            { id: QUITAR, nombre: "Quitar el género" },
            ...generos.map((g) => ({ id: g.generoId, nombre: g.nombre })),
          ]}
          vacio="— No cambiar —"
          textoNuevo="Nuevo"
          onElegir={(v) => set("genero", deValor(v))}
          onCrear={async (nombre) => {
            const g = await asegurarGenero(negocioId, nombre);
            set("genero", { accion: "poner", id: g.generoId });
          }}
        />

        <div className="space-y-1.5">
          <Label>Agregar etiquetas</Label>
          <EtiquetasInput
            etiquetas={[...cambios.agregarEtiquetas]}
            onChange={(t) => set("agregarEtiquetas", t)}
          />
        </div>

        {etiquetasEnSeleccion.length > 0 && (
          <div className="space-y-1.5">
            <Label>Quitar etiquetas</Label>
            <div className="flex flex-wrap gap-1">
              {etiquetasEnSeleccion.map(([k, { etiqueta, n }]) => {
                const activa = quitarSet.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => alternarQuitar(k, etiqueta)}
                    aria-pressed={activa}
                    className={
                      activa
                        ? "rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground line-through"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs hover:bg-muted/70"
                    }
                  >
                    #{etiqueta} <span className="opacity-70">({n})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-sm" aria-live="polite">
          {progreso && guardando
            ? `Guardando ${progreso.hechos.toLocaleString("es-MX")} de ${progreso.total.toLocaleString("es-MX")}…`
            : pendientes.length === 0
              ? "Elige qué cambiar."
              : `Cambiarán ${pendientes.length.toLocaleString("es-MX")} de ${articulos.length.toLocaleString("es-MX")} artículos.`}
        </p>
        {protegidos > 0 && !guardando && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            {protegidos === 1
              ? "1 artículo de mayoreo conserva su categoría y subcategoría"
              : `${protegidos.toLocaleString("es-MX")} artículos de mayoreo conservan su categoría y subcategoría`}
            : siempre llevan las dos. Para cambiarlas, elige aquí la categoría y una subcategoría
            de ella.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={asignar}
            disabled={guardando || pendientes.length === 0}
          >
            {guardando
              ? "Guardando…"
              : `Asignar a ${pendientes.length.toLocaleString("es-MX")}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

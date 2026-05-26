import { useState } from "react";
import { AlertTriangle, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "./ImageUpload";
import type { ArticuloSubvariacion } from "@shared";

type Props = {
  /** Id del padre — necesario para el aviso UX y para que se vea el codigo
   *  generado tras guardar. */
  articuloIdPadre: string;
  subvariaciones: ArticuloSubvariacion[];
  files: Array<File | null>;
  /** Paralelo a `files` — true cuando la imagen vino de Gemini. */
  viaNanobanana: boolean[];
  onChange: (
    subvariaciones: ArticuloSubvariacion[],
    files: Array<File | null>,
    viaNanobanana: boolean[],
  ) => void;
};

/**
 * Editor v2 de subvariaciones. Cada registro es plegable: en estado
 * colapsado muestra resumen (nombre + código). Al expandir aparecen los
 * inputs y la imagen en modo compacto (X en la esquina, sin nombre de
 * archivo).
 */
export function SubvariacionesEditor({
  articuloIdPadre,
  subvariaciones,
  files,
  viaNanobanana,
  onChange,
}: Props) {
  // Las nuevas subvariaciones (recién agregadas con "+ Agregar") quedan
  // expandidas por defecto. Las cargadas del artículo existente arrancan
  // colapsadas para que la lista entre completa en pantalla.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function agregar() {
    const nuevoIdx = subvariaciones.length;
    onChange(
      [...subvariaciones, { nombre: "" }],
      [...files, null],
      [...viaNanobanana, false],
    );
    // Expandir la recién agregada.
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(nuevoIdx);
      return next;
    });
  }

  function quitar(idx: number) {
    onChange(
      subvariaciones.filter((_, i) => i !== idx),
      files.filter((_, i) => i !== idx),
      viaNanobanana.filter((_, i) => i !== idx),
    );
    // Reajustar el set: borrar el idx y desplazar los superiores.
    setExpanded((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      }
      return next;
    });
  }

  function patch(idx: number, patchObj: Partial<ArticuloSubvariacion>) {
    onChange(
      subvariaciones.map((sv, i) => (i === idx ? { ...sv, ...patchObj } : sv)),
      files,
      viaNanobanana,
    );
  }

  function setFile(idx: number, file: File | null, via?: boolean) {
    const nextFiles = [...files];
    nextFiles[idx] = file;
    const nextVia = [...viaNanobanana];
    nextVia[idx] = !!via;
    onChange(subvariaciones, nextFiles, nextVia);
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Subvariaciones</h2>
          <p className="text-xs text-muted-foreground">
            Variantes con stock individual (color, modelo, etc.). El precio se
            comparte con el artículo padre.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={agregar}
          className="shrink-0"
        >
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
      </div>

      {subvariaciones.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 break-words text-xs">
            Al guardar este artículo con subvariaciones, el código del padre{" "}
            <code className="break-all font-mono">
              {articuloIdPadre || "(nuevo)"}
            </code>{" "}
            queda inhabilitado al escaneo en el POS cuando el negocio activa
            <code className="break-all font-mono"> usaSubvariacionesV2</code>.
            Las ventas se hacen con los códigos{" "}
            <code className="break-all font-mono">v-NN-XXX</code> de cada
            subvariación.
          </p>
        </div>
      )}

      {subvariaciones.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Sin subvariaciones
        </p>
      ) : (
        <div className="space-y-2">
          {subvariaciones.map((sv, idx) => {
            const isOpen = expanded.has(idx);
            const resumen = sv.nombre.trim() || `Subvariación #${idx + 1}`;
            return (
              <div
                key={sv.codigo ?? `nuevo-${idx}`}
                className="rounded-md border bg-background"
              >
                {/* Header — siempre visible, click para plegar/desplegar. */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Plegar" : "Desplegar"}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        isOpen ? "" : "-rotate-90"
                      }`}
                    />
                    <span className="truncate text-sm font-medium">
                      {resumen}
                    </span>
                    {sv.codigo && (
                      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {sv.codigo}
                      </code>
                    )}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => quitar(idx)}
                    aria-label="Quitar subvariación"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Body — siempre montado, oculto vía CSS al colapsar para
                    preservar el estado interno de ImageUpload (preview del
                    File recién seleccionado, etc.). */}
                <div
                  className={`space-y-2 border-t px-3 py-3 ${
                    isOpen ? "" : "hidden"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`sv-nombre-${idx}`}
                      className="w-24 shrink-0 text-xs"
                    >
                      Nombre *
                    </Label>
                    <Input
                      id={`sv-nombre-${idx}`}
                      value={sv.nombre}
                      onChange={(e) => patch(idx, { nombre: e.target.value })}
                      placeholder="Ej. Rojo, Talla M"
                      required
                      className="h-8 flex-1 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`sv-ref-${idx}`}
                      className="w-24 shrink-0 text-xs"
                    >
                      Referencia
                    </Label>
                    <Input
                      id={`sv-ref-${idx}`}
                      value={sv.referencia ?? ""}
                      onChange={(e) =>
                        patch(idx, { referencia: e.target.value })
                      }
                      placeholder="Color, lote…"
                      className="h-8 flex-1 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`sv-cantidad-${idx}`}
                        className="w-14 shrink-0 text-xs"
                      >
                        Tienda
                      </Label>
                      <Input
                        id={`sv-cantidad-${idx}`}
                        type="number"
                        inputMode="numeric"
                        value={sv.cantidad ?? ""}
                        onChange={(e) =>
                          patch(idx, { cantidad: e.target.value })
                        }
                        className="h-8 flex-1 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`sv-bodega-${idx}`}
                        className="w-14 shrink-0 text-xs"
                      >
                        Bodega
                      </Label>
                      <Input
                        id={`sv-bodega-${idx}`}
                        type="number"
                        inputMode="numeric"
                        value={sv.cantidadBodega ?? ""}
                        onChange={(e) =>
                          patch(idx, { cantidadBodega: e.target.value })
                        }
                        className="h-8 flex-1 text-sm"
                      />
                    </div>
                  </div>
                  <ImageUpload
                    compact
                    size={84}
                    urlActual={sv.imagenUrl}
                    onFile={(f, meta) => setFile(idx, f, meta?.viaNanobanana)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

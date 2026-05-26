import { useEffect, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Loader2, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ImageLightbox";
import { bytesHuman, compressToWebP } from "@/lib/image";
import { quitarFondoFromFile, quitarFondoFromUrl } from "@/lib/quitarFondo";

const MAX_BYTES = 800 * 1024; // 800 KB

/** Metadata del File para que el padre sepa cómo se obtuvo (subido normal
 *  vs procesado con Gemini). El padre usa esto para registrar costo. */
export type FileMeta = {
  viaNanobanana: boolean;
};

type Props = {
  /** URL actual (remota) si existe */
  urlActual?: string;
  /** Callback con el File seleccionado (nuevo). El segundo parámetro
   *  describe cómo se obtuvo — útil para registrar costo si vino de
   *  nanobanana. */
  onFile: (file: File | null, meta?: FileMeta) => void;
  /** FIX D3: callback separado cuando el user quiere borrar la imagen existente */
  onRemove?: () => void;
  size?: number;
  label?: string;
  /** Modo compacto (usado dentro de cards angostas como subvariaciones):
   *  layout siempre en fila, sin label visible, sin nombre de archivo,
   *  y el botón "Quitar" se vuelve una X superpuesta a la imagen. */
  compact?: boolean;
};

export function ImageUpload({
  urlActual,
  onFile,
  onRemove,
  size = 140,
  label = "Imagen",
  compact = false,
}: Props) {
  const [preview, setPreview] = useState<string | null>(urlActual ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procesandoFondo, setProcesandoFondo] = useState(false);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file && !removed) setPreview(urlActual ?? null);
  }, [urlActual, file, removed]);

  /**
   * Procesa una imagen recién seleccionada o capturada por la cámara:
   *   1. Valida que sea `image/*`.
   *   2. La comprime a WebP ≤ 800 KB con la mejor resolución posible
   *      (lib `compressToWebP`).
   *   3. Setea el File comprimido como nuevo (el preview lo refleja
   *      automáticamente vía useEffect).
   *
   * Si ya es WebP pequeño, la lib detecta y no hace trabajo extra.
   */
  async function procesarArchivo(f: File | null, meta?: FileMeta) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError(
        `Tipo de archivo no soportado: ${f.type || "desconocido"}. Solo imágenes.`,
      );
      return;
    }
    setComprimiendo(true);
    try {
      const blob = await compressToWebP(f, { maxBytes: MAX_BYTES });
      const baseName = f.name.replace(/\.[^.]+$/, "") || "imagen";
      const nuevoFile = new File([blob], `${baseName}.webp`, {
        type: "image/webp",
      });
      setFile(nuevoFile);
      setRemoved(false);
      onFile(nuevoFile, meta);
    } catch (e) {
      setError(`No se pudo procesar la imagen: ${(e as Error).message}`);
    } finally {
      setComprimiendo(false);
    }
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    // Reset el value para permitir re-seleccionar el mismo archivo.
    e.target.value = "";
    procesarArchivo(f);
  }

  function handleRemove() {
    setFile(null);
    setPreview(null);
    setRemoved(true);
    setError(null);
    onFile(null);
    onRemove?.();
  }

  /**
   * Llama al CF `quitarFondoImagen` (Gemini) y reemplaza la imagen por
   * la versión con fondo blanco. Si hay un `file` nuevo lo manda directo;
   * si solo hay `urlActual`, primero la descarga (puede fallar por CORS
   * si Storage no expone `Access-Control-Allow-Origin: *`).
   *
   * El output de Gemini puede venir como PNG grande (>800 KB). Se vuelve
   * a pasar por `compressToWebP` para garantizar que cualquier imagen
   * que termine en el carrito de subida sea WebP ≤ 800 KB.
   */
  async function handleQuitarFondo() {
    if (procesandoFondo) return;
    setProcesandoFondo(true);
    setError(null);
    try {
      let nuevoFile: File;
      if (file) {
        nuevoFile = await quitarFondoFromFile(file);
      } else if (urlActual) {
        nuevoFile = await quitarFondoFromUrl(urlActual);
      } else {
        return;
      }
      // Recomprimir el resultado de Gemini para forzar WebP ≤ 800 KB.
      const blob = await compressToWebP(nuevoFile, { maxBytes: MAX_BYTES });
      const baseName =
        nuevoFile.name.replace(/\.[^.]+$/, "") || "imagen_nofondo";
      const finalFile = new File([blob], `${baseName}.webp`, {
        type: "image/webp",
      });
      setFile(finalFile);
      setRemoved(false);
      // Marca el File como originado por nanobanana → el padre lo
      // usa para registrar el costo cuando se guarde el artículo.
      onFile(finalFile, { viaNanobanana: true });
    } catch (e) {
      setError(`No se pudo quitar el fondo: ${(e as Error).message}`);
    } finally {
      setProcesandoFondo(false);
    }
  }

  const wrapperLayout = compact
    ? "flex items-start gap-2"
    : "flex flex-col items-stretch gap-3 sm:flex-row sm:items-start";
  const buttonsLayout = compact
    ? "flex flex-wrap gap-1.5"
    : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap";
  const filePickerHeight = compact ? "h-8" : "h-10";
  const filePickerTextSize = compact ? "text-xs" : "text-sm";

  return (
    <div className="space-y-2">
      {!compact && <label className="text-sm font-medium">{label}</label>}
      <div className={wrapperLayout}>
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted ${
            compact ? "self-start" : "self-center sm:self-start"
          }`}
          style={{ width: size, height: size }}
        >
          {preview ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="Ver imagen ampliada"
              className="block h-full w-full cursor-zoom-in"
            >
              <img
                src={preview}
                alt="preview"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </button>
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground/40" />
          )}
          {compact && preview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              disabled={procesandoFondo || comprimiendo}
              aria-label="Quitar imagen"
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm ring-1 ring-border transition hover:bg-background hover:text-destructive disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className={buttonsLayout}>
            {/* Elegir archivo de la galería / disco. */}
            <label
              className={`inline-flex cursor-pointer ${
                comprimiendo || procesandoFondo
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              <input
                type="file"
                accept="image/*"
                onChange={onChange}
                disabled={comprimiendo || procesandoFondo}
                className="hidden"
              />
              <span
                className={`inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-3 font-medium hover:bg-accent sm:w-auto ${filePickerHeight} ${filePickerTextSize}`}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {preview ? "Cambiar" : "Elegir"}
              </span>
            </label>
            {/* Tomar foto — abre la cámara directamente en mobile.
                En desktop el navegador ignora `capture` y muestra el
                file picker normal (no hay cámara nativa). */}
            <label
              className={`inline-flex cursor-pointer ${
                comprimiendo || procesandoFondo
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onChange}
                disabled={comprimiendo || procesandoFondo}
                className="hidden"
              />
              <span
                className={`inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-3 font-medium hover:bg-accent sm:w-auto ${filePickerHeight} ${filePickerTextSize}`}
              >
                <Camera className="mr-2 h-4 w-4" />
                Foto
              </span>
            </label>
          </div>
          {comprimiendo && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Comprimiendo a WebP…
            </p>
          )}
          {preview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleQuitarFondo}
              disabled={procesandoFondo || comprimiendo}
              title="Reemplaza el fondo por blanco usando Gemini"
              className={
                compact
                  ? "h-8 w-full text-xs"
                  : "w-full sm:w-auto sm:self-start"
              }
            >
              {procesandoFondo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {procesandoFondo ? "Procesando…" : "Quitar fondo"}
            </Button>
          )}
          {!compact && preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive sm:w-auto sm:self-start"
              onClick={handleRemove}
              disabled={procesandoFondo || comprimiendo}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Quitar
            </Button>
          )}
          {!compact && file && !error && (
            <p className="break-all text-xs text-muted-foreground">
              {file.name} · {bytesHuman(file.size)} (WebP)
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <ImageLightbox
        src={lightboxOpen ? preview : null}
        onClose={() => setLightboxOpen(false)}
        alt={label}
      />
    </div>
  );
}

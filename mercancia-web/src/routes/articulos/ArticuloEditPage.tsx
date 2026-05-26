import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Save, Trash2, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useArticulo } from "@/features/articulos/useArticulos";
import { useNegocio } from "@/hooks/useNegocio";
import { useSession } from "@/hooks/useSession";
import { useCategorias } from "@/features/categorias/useCategorias";
import { ImageUpload } from "@/features/articulos/ImageUpload";
import { SubvariacionesEditor } from "@/features/articulos/SubvariacionesEditor";
import {
  crearArticulo,
  actualizarArticulo,
  eliminarArticulo,
  type ArticuloInput,
} from "@/features/articulos/articuloService";
import type { ArticuloSubvariacion } from "@shared";

type FormState = {
  nombre: string;
  sigla: string;
  referencia: string;
  cantidad: string;
  cantidadBodega: string;
  preciCompra: string;
  precioVenta: string;
  categoriaId: string;
  subcategoriaId: string;
  etiquetas: string[];
  imagenUrl: string;
  tallas: string;
  mayoreo: string;
  cantMayoreo: string;
  precioDescuento: string;
  flag3x2: boolean;
  flagSeña: boolean;
  promoBandera: boolean;
  subvariaciones: ArticuloSubvariacion[];
};

const FORM_EMPTY: FormState = {
  nombre: "",
  sigla: "",
  referencia: "",
  cantidad: "",
  cantidadBodega: "",
  preciCompra: "",
  precioVenta: "",
  categoriaId: "",
  subcategoriaId: "",
  etiquetas: [],
  imagenUrl: "",
  tallas: "",
  mayoreo: "",
  cantMayoreo: "",
  precioDescuento: "",
  flag3x2: false,
  flagSeña: false,
  promoBandera: false,
  subvariaciones: [],
};

export function ArticuloEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { auth } = useSession();
  const editing = !!id;
  const { articulo, loading } = useArticulo(id ?? null);
  const { categorias, subcategorias } = useCategorias();

  const [form, setForm] = useState<FormState>(FORM_EMPTY);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenViaNanobanana, setImagenViaNanobanana] = useState(false);
  const [imagenRemoved, setImagenRemoved] = useState(false);
  const [subvFiles, setSubvFiles] = useState<Array<File | null>>([]);
  const [subvViaNanobanana, setSubvViaNanobanana] = useState<boolean[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subcategorías filtradas por la categoría actualmente seleccionada.
  const subcategoriasFiltradas = useMemo(
    () =>
      form.categoriaId
        ? subcategorias.filter((sc) => sc.categoriaId === form.categoriaId)
        : [],
    [form.categoriaId, subcategorias],
  );

  // FIX D2: inicializar el form solo UNA VEZ por artículo (por id). Evita
  // resets mientras el user edita si llega un snapshot update remoto.
  const initializedId = useRef<string | null>(null);
  useEffect(() => {
    if (!articulo) return;
    if (initializedId.current === articulo.id) return;
    initializedId.current = articulo.id;
    setForm({
      nombre: articulo.nombre ?? "",
      sigla: articulo.sigla ?? "",
      referencia: articulo.referencia ?? "",
      cantidad: articulo.cantidad ?? "",
      cantidadBodega: articulo.cantidadBodega ?? "",
      preciCompra: articulo.preciCompra ?? "",
      precioVenta: articulo.precioVenta ?? "",
      categoriaId: articulo.categoriaId ?? "",
      subcategoriaId: articulo.subcategoriaId ?? "",
      etiquetas: articulo.etiquetas ?? [],
      imagenUrl: articulo.imagenUrl ?? "",
      tallas: articulo.tallas ?? "",
      mayoreo: articulo.mayoreo ?? "",
      cantMayoreo: articulo.cantMayoreo ?? "",
      // Migración orgánica: si el doc trae el campo legacy `descuento`
      // (subtractivo en Android, "%"-shaped en mercancia-web vieja) lo
      // pre-llenamos en `precioDescuento` para no perderlo, pero al
      // guardar se persiste sólo el campo nuevo y articuloService borra
      // el legacy. El operador puede revisar el valor antes de guardar.
      precioDescuento: articulo.precioDescuento ?? articulo.descuento ?? "",
      flag3x2: articulo["3x2"] !== undefined,
      flagSeña: articulo.seña !== undefined,
      promoBandera: articulo.promoBandera === "1",
      subvariaciones: articulo.subvariaciones ?? [],
    });
    const n = (articulo.subvariaciones ?? []).length;
    setSubvFiles(new Array(n).fill(null));
    setSubvViaNanobanana(new Array(n).fill(false));
    setImagenRemoved(false);
    setImagenViaNanobanana(false);
  }, [articulo]);

  const nCompra = Number(form.preciCompra) || 0;
  const nVenta = Number(form.precioVenta) || 0;
  const nCantidad = Number(form.cantidad) || 0;
  const utilidad = nVenta - nCompra;
  const utilidadTotal = utilidad * nCantidad;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    setError(null);

    if (!form.nombre.trim() || !form.sigla.trim() || !form.precioVenta) {
      setError("Nombre, sigla y precio de venta son obligatorios");
      return;
    }

    setSubmitting(true);
    try {
      const input: ArticuloInput = {
        nombre: form.nombre.trim(),
        sigla: form.sigla.trim(),
        referencia: form.referencia.trim(),
        cantidad: form.cantidad || "0",
        ...(form.cantidadBodega && { cantidadBodega: form.cantidadBodega }),
        preciCompra: form.preciCompra || "0",
        precioVenta: form.precioVenta,
        utilidad: String(utilidad),
        utilidadTotal: String(utilidadTotal),
        ...(form.categoriaId && { categoriaId: form.categoriaId }),
        ...(form.subcategoriaId && { subcategoriaId: form.subcategoriaId }),
        ...(form.etiquetas.length > 0 && { etiquetas: form.etiquetas }),
        // FIX D3: si el user quitó la imagen, pasar imagenUrl: "" explícito
        // para que el service lo respete en vez de fallback al existente.
        ...(imagenRemoved
          ? { imagenUrl: "" }
          : form.imagenUrl && !imagenFile
            ? { imagenUrl: form.imagenUrl }
            : {}),
        ...(form.tallas && { tallas: form.tallas }),
        ...(form.mayoreo && { mayoreo: form.mayoreo }),
        ...(form.cantMayoreo && { cantMayoreo: form.cantMayoreo }),
        // Espejo del patrón en admin-web: emitir `precioDescuento` siempre.
        // `""` = "operador quitó el descuento", el service lo strip-ea
        // antes de persistir. Nunca escribir el legacy `descuento`.
        precioDescuento: form.precioDescuento,
        ...(form.flag3x2 && { "3x2": "" }),
        ...(form.flagSeña && { seña: "" }),
        ...(form.promoBandera && { promoBandera: "1" }),
        ...(form.subvariaciones.length > 0 && {
          subvariaciones: form.subvariaciones,
        }),
        imagenFile,
        imagenViaNanobanana,
        subvariacionesFiles: subvFiles,
        subvariacionesViaNanobanana: subvViaNanobanana,
        // En mercancia-web no hay Firebase Auth; identificamos al operador
        // con su PIN-uid + nombre para que el historial nanobanana quede
        // trazable. El uid es el del doc UsuarioMercancia, prefijado con
        // "mercancia:" para distinguir de uids de Firebase Auth.
        usuario: auth
          ? {
              uid: `mercancia:${auth.usuarioId}`,
              email: auth.nombre,
            }
          : null,
      };

      if (editing && id) {
        await actualizarArticulo(negocioId, id, input);
      } else {
        await crearArticulo(negocioId, input);
      }
      navigate("/articulos", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!negocioId || !id) return;
    if (!confirm(`¿Eliminar el artículo "${form.nombre}"? Esta acción es definitiva.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await eliminarArticulo(negocioId, id);
      navigate("/articulos", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (editing && loading && !articulo) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Cargando artículo…
      </p>
    );
  }

  if (editing && !loading && !articulo) {
    return (
      <div className="container max-w-md py-10 text-center">
        <p className="text-muted-foreground">Artículo no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/articulos")}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-3xl space-y-6 px-3 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-6"
    >
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate("/articulos")}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Artículos
        </Button>
        <h1 className="text-xl font-semibold">
          {editing ? `Editar #${id}` : "Nuevo artículo"}
        </h1>
      </div>

      {/* ---------- Básico ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Información básica</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sigla">Sigla *</Label>
            <Input
              id="sigla"
              value={form.sigla}
              onChange={(e) => set("sigla", e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referencia">Referencia</Label>
            <Input
              id="referencia"
              value={form.referencia}
              onChange={(e) => set("referencia", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <select
              id="categoria"
              value={form.categoriaId}
              onChange={(e) => {
                const nuevoCat = e.target.value;
                setForm((s) => ({
                  ...s,
                  categoriaId: nuevoCat,
                  // Si cambia la categoría, limpiar la subcategoría para
                  // que no quede una huérfana del padre nuevo.
                  subcategoriaId:
                    nuevoCat &&
                    subcategorias.find(
                      (sc) =>
                        sc.subcategoriaId === s.subcategoriaId &&
                        sc.categoriaId === nuevoCat,
                    )
                      ? s.subcategoriaId
                      : "",
                }));
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— Sin categoría —</option>
              {categorias.map((c) => (
                <option key={c.categoriaId} value={c.categoriaId}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subcategoria">Subcategoría</Label>
            <select
              id="subcategoria"
              value={form.subcategoriaId}
              onChange={(e) => set("subcategoriaId", e.target.value)}
              disabled={!form.categoriaId}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">— Sin subcategoría —</option>
              {subcategoriasFiltradas.map((sc) => (
                <option key={sc.subcategoriaId} value={sc.subcategoriaId}>
                  {sc.nombre}
                </option>
              ))}
            </select>
            {!form.categoriaId && (
              <p className="text-[11px] text-muted-foreground">
                Selecciona una categoría primero
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="etiquetas">Etiquetas</Label>
            <EtiquetasChips
              etiquetas={form.etiquetas}
              onChange={(eq) => set("etiquetas", eq)}
            />
          </div>
        </div>
      </section>

      {/* ---------- Precios ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Precios e inventario</h2>
        {/* "Precio compra" se mantiene en el form para no perder el dato
            existente, pero se oculta de la UI por decisión del negocio
            (no exponer costo al equipo). El campo se sigue persistiendo
            con el valor que ya tenía el artículo. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="precioVenta">Precio venta *</Label>
            <Input
              id="precioVenta"
              type="number"
              inputMode="decimal"
              value={form.precioVenta}
              onChange={(e) => set("precioVenta", e.target.value)}
              required
            />
          </div>
          {form.subvariaciones.length === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cantidad">Stock tienda</Label>
                <Input
                  id="cantidad"
                  type="number"
                  inputMode="numeric"
                  value={form.cantidad}
                  onChange={(e) => set("cantidad", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cantidadBodega">Stock bodega</Label>
                <Input
                  id="cantidadBodega"
                  type="number"
                  inputMode="numeric"
                  value={form.cantidadBodega}
                  onChange={(e) => set("cantidadBodega", e.target.value)}
                />
              </div>
            </>
          )}
          {form.subvariaciones.length > 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              El stock se gestiona por subvariación (cada variante tiene su
              propio Tienda y Bodega).
            </p>
          )}
        </div>
        {/* Bloque de utilidad oculto: como `utilidad = precioVenta -
            preciCompra`, mostrarlo expone indirectamente el costo. Se
            sigue calculando y persistiendo en el doc del artículo
            (`utilidad`, `utilidadTotal`) para reportes admin pero no
            se muestra en la UI del editor. */}
      </section>

      {/* ---------- Imagen principal ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Imagen</h2>
        <ImageUpload
          urlActual={form.imagenUrl}
          onFile={(f, meta) => {
            setImagenFile(f);
            setImagenViaNanobanana(!!meta?.viaNanobanana);
            if (f) setImagenRemoved(false);
          }}
          onRemove={() => {
            setImagenFile(null);
            setImagenViaNanobanana(false);
            setImagenRemoved(true);
          }}
          label="Imagen principal"
        />
      </section>

      {/* ---------- Subvariaciones ---------- */}
      <SubvariacionesEditor
        articuloIdPadre={id ?? ""}
        subvariaciones={form.subvariaciones}
        files={subvFiles}
        viaNanobanana={subvViaNanobanana}
        onChange={(sub, files, via) => {
          set("subvariaciones", sub);
          setSubvFiles(files);
          setSubvViaNanobanana(via);
        }}
      />

      {/* ---------- Promociones ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Promociones y tallas</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tallas">Grupo de tallas</Label>
            <Input
              id="tallas"
              value={form.tallas}
              onChange={(e) => set("tallas", e.target.value)}
              placeholder="Ej. Camisetas (referencia al grupo — CRUD en Fase 4)"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.flag3x2}
                onChange={(e) => set("flag3x2", e.target.checked)}
              />
              <span className="text-sm">Aplica promoción 3×2</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.flagSeña}
                onChange={(e) => set("flagSeña", e.target.checked)}
              />
              <span className="text-sm">Acepta seña (apartado)</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.promoBandera}
                onChange={(e) => set("promoBandera", e.target.checked)}
              />
              <span className="text-sm">Marcar en promoción</span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mayoreo">Precio mayoreo</Label>
              <Input
                id="mayoreo"
                type="number"
                inputMode="decimal"
                value={form.mayoreo}
                onChange={(e) => set("mayoreo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cantMayoreo">Cantidad mín. mayoreo</Label>
              <Input
                id="cantMayoreo"
                type="number"
                inputMode="numeric"
                value={form.cantMayoreo}
                onChange={(e) => set("cantMayoreo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precioDescuento">Precio descuento</Label>
              <Input
                id="precioDescuento"
                type="number"
                inputMode="decimal"
                min="0"
                value={form.precioDescuento}
                onChange={(e) => set("precioDescuento", e.target.value)}
                placeholder="Si > 0, reemplaza al base"
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t bg-card/95 p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.25rem))] backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:static sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none">
        {editing && (
          <Button
            type="button"
            variant="outline"
            className="order-3 w-full text-destructive hover:text-destructive sm:order-1 sm:w-auto"
            onClick={onDelete}
            disabled={submitting}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </Button>
        )}
        <div className="hidden sm:block sm:flex-1" />
        <Button
          type="button"
          variant="outline"
          className="order-2 w-full sm:order-2 sm:w-auto"
          onClick={() => navigate("/articulos")}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="order-1 w-full sm:order-3 sm:w-auto"
        >
          <Save className="mr-2 h-4 w-4" />
          {submitting
            ? "Guardando…"
            : editing
              ? "Guardar cambios"
              : "Crear artículo"}
        </Button>
      </div>

    </form>
  );
}

// ============================================================
// Chips de etiquetas (tags libres por artículo)
// ============================================================

function EtiquetasChips({
  etiquetas,
  onChange,
}: {
  etiquetas: string[];
  onChange: (eq: string[]) => void;
}) {
  const [borrador, setBorrador] = useState("");

  function agregar() {
    const t = borrador.trim().toLowerCase();
    if (!t) return;
    if (etiquetas.includes(t)) {
      setBorrador("");
      return;
    }
    onChange([...etiquetas, t]);
    setBorrador("");
  }

  function quitar(t: string) {
    onChange(etiquetas.filter((x) => x !== t));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              agregar();
            } else if (
              e.key === "Backspace" &&
              borrador === "" &&
              etiquetas.length > 0
            ) {
              quitar(etiquetas[etiquetas.length - 1]);
            }
          }}
          placeholder="Escribe una etiqueta y Enter (ej. verano, oferta)"
        />
        <Button type="button" variant="outline" onClick={agregar}>
          Añadir
        </Button>
      </div>
      {etiquetas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {etiquetas.map((t) => (
            <li
              key={t}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              <span>{t}</span>
              <button
                type="button"
                onClick={() => quitar(t)}
                className="rounded-full p-0.5 hover:bg-background"
                aria-label={`Quitar ${t}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

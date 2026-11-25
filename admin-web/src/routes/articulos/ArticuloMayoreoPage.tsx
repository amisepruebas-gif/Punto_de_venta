import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { useArticulo, useArticulos } from "@/features/articulos/useArticulos";
import { eliminarArticulo } from "@/features/articulos/articuloService";
import { ImageUpload } from "@/features/articulos/ImageUpload";
import { CategoriaInlineSelect } from "@/features/categorias/CategoriaInlineSelect";
import { GeneroInlineSelect } from "@/features/categorias/GeneroInlineSelect";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useSucursales } from "@/features/sucursales/useSucursales";
import {
  actualizarArticuloMayoreo,
  crearArticuloMayoreo,
  type ArticuloMayoreoInput,
} from "@/features/mayoreo/articuloMayoreoService";
import { EtiquetasFinales } from "@/features/mayoreo/EtiquetasFinales";
import { PrecioCategoriaInline } from "@/features/mayoreo/PrecioCategoriaInline";
import { usePreciosMayoreo } from "@/features/mayoreo/preciosMayoreoService";
import { EtiquetasChips } from "@/routes/articulos/ArticuloEditPage";
import {
  PIEZAS_MAYOREO,
  articulosFinales,
  leerExistenciasTienda,
  nombrarVariaciones,
  nombreAutomaticoArticulo,
  resolverPrecioHeredado,
  resolverSucursalDefaultId,
  tieneExistencias,
  validarArticuloMayoreo,
  type Articulo,
} from "@shared";

type VariacionForm = {
  /** Llave estable de la fila en pantalla. */
  key: string;
  /** `v-NN-XXX` si la variación ya existe. */
  codigo?: string;
  codigoBarras?: string;
  nombre: string;
  imagenUrl?: string;
  imagenFile: File | null;
  viaNanobanana: boolean;
  quitarImagen: boolean;
};

type FormState = {
  categoriaId: string;
  subcategoriaId: string;
  nombre: string;
  tieneVariaciones: boolean;
  variaciones: VariacionForm[];
  precioPropio: boolean;
  precio: string;
  menudeo: string;
  costo: string;
  generoId: string;
  etiquetas: string[];
};

let serieFilas = 0;
function filaNueva(): VariacionForm {
  serieFilas += 1;
  return {
    key: `nueva-${serieFilas}`,
    nombre: "",
    imagenFile: null,
    viaNanobanana: false,
    quitarImagen: false,
  };
}

function formDe(a: Articulo): FormState {
  return {
    categoriaId: a.categoriaId ?? "",
    subcategoriaId: a.subcategoriaId ?? "",
    nombre: a.nombre ?? "",
    tieneVariaciones: (a.subvariaciones ?? []).length > 0,
    variaciones: (a.subvariaciones ?? []).map((sv, i) => ({
      key: sv.codigo ?? `vieja-${i}`,
      codigo: sv.codigo,
      codigoBarras: sv.codigoBarras,
      nombre: sv.nombre ?? "",
      imagenUrl: sv.imagenUrl,
      imagenFile: null,
      viaNanobanana: false,
      quitarImagen: false,
    })),
    precioPropio: !!a.precioPropio,
    precio: a.precioPropio ? (a.precioVenta ?? "") : "",
    menudeo: a.precioPropio ? (a.precioMenudeo ?? "") : "",
    costo: Number(a.preciCompra) ? String(a.preciCompra) : "",
    generoId: a.generoId ?? "",
    etiquetas: a.etiquetas ?? [],
  };
}

/**
 * Registro simplificado de un artículo «Solo mayoreo»: categoría y
 * subcategoría obligatorias, nombres opcionales (el sistema los pone), precio
 * de la escalera categoría → subcategoría → artículo y un código de 8
 * dígitos por artículo final. No captura existencias ni las pisa al guardar.
 *
 * El formulario se monta de nuevo al cambiar de artículo (o al pasar de uno
 * guardado a «Registrar otro»): así nunca arrastra lo escrito en el anterior.
 */
export function ArticuloMayoreoPage() {
  const { id } = useParams<{ id: string }>();
  return <FormularioMayoreo key={id ?? "nuevo"} />;
}

function FormularioMayoreo() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { negocioId, negocio } = useNegocio();
  const { user } = useAuth();
  const editing = !!id;
  const { articulo, loading } = useArticulo(id ?? null);
  const { articulos } = useArticulos();
  const { categorias, subcategorias } = useCategorias();
  const { precios, loading: cargandoPrecios } = usePreciosMayoreo();
  const { sucursales } = useSucursales();

  const [form, setForm] = useState<FormState>(() => ({
    categoriaId: searchParams.get("cat") ?? "",
    subcategoriaId: searchParams.get("sub") ?? "",
    nombre: "",
    tieneVariaciones: false,
    variaciones: [],
    precioPropio: false,
    precio: "",
    menudeo: "",
    costo: "",
    generoId: "",
    etiquetas: [],
  }));
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenViaNanobanana, setImagenViaNanobanana] = useState(false);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [cuantas, setCuantas] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(searchParams.get("guardado") === "1");

  // El formulario se llena UNA vez por artículo: un cambio remoto (una venta
  // mueve existencias) no borra lo que se está escribiendo.
  const inicializado = useRef<string | null>(null);
  function cargar(a: Articulo) {
    inicializado.current = a.id;
    setForm(formDe(a));
    setImagenFile(null);
    setImagenViaNanobanana(false);
    setQuitarImagen(false);
  }
  useEffect(() => {
    if (articulo && inicializado.current !== articulo.id) cargar(articulo);
  }, [articulo]);

  const categoria = categorias.find((c) => c.categoriaId === form.categoriaId);
  const subcategoria = subcategorias.find((s) => s.subcategoriaId === form.subcategoriaId);
  const otrosNombres = useMemo(
    () => articulos.filter((a) => a.id !== id).map((a) => a.nombre ?? ""),
    [articulos, id],
  );
  const heredado = resolverPrecioHeredado(form, precios);
  const nombreSugerido = subcategoria
    ? nombreAutomaticoArticulo(subcategoria.nombre, otrosNombres)
    : "";
  // Con qué nombre quedaría cada variación sin nombre.
  const nombresVista = useMemo(
    () => nombrarVariaciones(form.variaciones).map((v) => v.nombre),
    [form.variaciones],
  );

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    setGuardado(false);
  }
  function setVariacion(key: string, cambio: Partial<VariacionForm>) {
    set(
      "variaciones",
      form.variaciones.map((v) => (v.key === key ? { ...v, ...cambio } : v)),
    );
  }
  function agregarVariaciones(n: number) {
    set("variaciones", [...form.variaciones, ...Array.from({ length: n }, filaNueva)]);
  }

  /** Una variación con piezas no se puede quitar (el servidor de datos
   *  tampoco lo deja): se avisa antes. */
  function conExistencias(codigo: string | undefined): boolean {
    const sv = codigo ? articulo?.subvariaciones?.find((s) => s.codigo === codigo) : undefined;
    return !!sv && tieneExistencias(sv);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    const problema = validarArticuloMayoreo(
      {
        categoriaId: form.categoriaId,
        subcategoriaId: form.subcategoriaId,
        tieneVariaciones: form.tieneVariaciones,
        variaciones: form.variaciones.length,
        precioPropio: form.precioPropio,
        precio: form.precio,
        menudeo: form.menudeo,
      },
      precios,
    );
    if (problema) {
      setError(problema);
      return;
    }
    setSubmitting(true);
    setError(null);
    const input: ArticuloMayoreoInput = {
      categoriaId: form.categoriaId,
      subcategoriaId: form.subcategoriaId,
      subcategoriaNombre: subcategoria?.nombre ?? "",
      nombre: form.nombre,
      tieneVariaciones: form.tieneVariaciones,
      variaciones: form.variaciones.map((v) => ({
        codigo: v.codigo,
        nombre: v.nombre,
        imagenFile: v.imagenFile,
        imagenViaNanobanana: v.viaNanobanana,
        quitarImagen: v.quitarImagen,
      })),
      precioPropio: form.precioPropio,
      precio: form.precio,
      menudeo: form.menudeo,
      costo: form.costo,
      generoId: form.generoId,
      etiquetas: form.etiquetas,
      imagenFile,
      imagenViaNanobanana,
      quitarImagen,
      usuario: user
        ? { uid: user.user.uid, ...(user.user.email ? { email: user.user.email } : {}) }
        : null,
    };
    try {
      if (editing && id) {
        cargar(await actualizarArticuloMayoreo(negocioId, id, input, precios, otrosNombres));
        setGuardado(true);
      } else {
        const nuevo = await crearArticuloMayoreo(negocioId, input, precios, otrosNombres);
        navigate(`/articulos/mayoreo/${nuevo.id}?guardado=1`, { replace: true });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!negocioId || !id || !articulo) return;
    const piezas =
      tieneExistencias(articulo) || (articulo.subvariaciones ?? []).some(tieneExistencias);
    const aviso = piezas
      ? `"${articulo.nombre}" TIENE EXISTENCIAS. ¿Eliminarlo de todos modos? Esta acción es definitiva.`
      : `¿Eliminar el artículo "${articulo.nombre}"? Esta acción es definitiva.`;
    if (!confirm(aviso)) return;
    setSubmitting(true);
    try {
      await eliminarArticulo(negocioId, id);
      navigate("/articulos", { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  if (editing && loading && !articulo) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando artículo…</p>;
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
  // Un artículo normal se edita en el formulario general.
  if (editing && articulo && !articulo.soloMayoreo) {
    return <Navigate to={`/articulos/${articulo.id}`} replace />;
  }

  const finales = articulo ? articulosFinales(articulo) : [];
  const defaultSucursalId = resolverSucursalDefaultId(
    negocio?.sucursalDefaultId,
    sucursales.map((s) => s.sucursalId),
  );
  const tiendasMayoreo = sucursales.filter((s) => s.modoMayoreo);

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-3xl space-y-6 px-3 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-6"
    >
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/articulos")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Artículos
        </Button>
        <h1 className="text-xl font-semibold">
          {editing ? `Mayoreo #${id}` : "Nuevo artículo de mayoreo"}
        </h1>
      </div>

      {guardado && articulo && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="flex-1">Guardado: «{articulo.nombre}».</span>
          <Button asChild type="button" size="sm" variant="outline">
            <Link
              to={`/articulos/mayoreo/nuevo?cat=${encodeURIComponent(articulo.categoriaId ?? "")}&sub=${encodeURIComponent(articulo.subcategoriaId ?? "")}`}
            >
              <Plus className="mr-1 h-4 w-4" /> Registrar otro
            </Link>
          </Button>
        </div>
      )}

      {/* ---------- Clasificación y nombre ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Artículo</h2>
        <CategoriaInlineSelect
          categoriaId={form.categoriaId}
          subcategoriaId={form.subcategoriaId}
          onChange={(v) => {
            setForm((s) => ({ ...s, ...v }));
            setGuardado(false);
          }}
          categoriaRequerida
          subcategoriaRequerida
        />
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre (opcional)</Label>
          <Input
            id="nombre"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder={nombreSugerido ? `Si lo dejas vacío: ${nombreSugerido}` : "Elige la subcategoría"}
          />
        </div>
      </section>

      {/* ---------- Variaciones ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">¿Tiene variaciones?</h2>
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-1" role="radiogroup">
          {[false, true].map((valor) => (
            <button
              key={String(valor)}
              type="button"
              role="radio"
              aria-checked={form.tieneVariaciones === valor}
              onClick={() => {
                set("tieneVariaciones", valor);
                if (valor && form.variaciones.length === 0) {
                  setForm((s) => ({ ...s, tieneVariaciones: true, variaciones: [filaNueva()] }));
                }
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                form.tieneVariaciones === valor
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {valor ? "Sí, tiene variaciones" : "No tiene"}
            </button>
          ))}
        </div>

        {form.tieneVariaciones ? (
          <>
            <p className="text-xs text-muted-foreground">
              Cada variación lleva su propio código y sus propias cantidades. El nombre es
              opcional: si lo dejas vacío queda como m1, m2…
            </p>
            <ul className="space-y-2">
              {form.variaciones.map((v, i) => (
                <li key={v.key} className="flex items-center gap-3 rounded-md border p-2">
                  <ImageUpload
                    compact
                    size={56}
                    urlActual={v.quitarImagen ? undefined : v.imagenUrl}
                    onFile={(file, meta) =>
                      setVariacion(v.key, {
                        imagenFile: file,
                        viaNanobanana: !!meta?.viaNanobanana,
                        quitarImagen: false,
                      })
                    }
                    onRemove={() =>
                      setVariacion(v.key, { imagenFile: null, quitarImagen: true })
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      value={v.nombre}
                      onChange={(e) => setVariacion(v.key, { nombre: e.target.value })}
                      placeholder={nombresVista[i]}
                      aria-label={`Nombre de la variación ${i + 1}`}
                    />
                    <p className="font-mono text-xs text-muted-foreground">
                      {v.codigoBarras ?? "El código sale al guardar"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={conExistencias(v.codigo)}
                    title={
                      conExistencias(v.codigo)
                        ? "Tiene existencias: no se puede quitar"
                        : "Quitar variación"
                    }
                    aria-label={`Quitar la variación ${v.nombre || nombresVista[i]}`}
                    onClick={() =>
                      set(
                        "variaciones",
                        form.variaciones.filter((x) => x.key !== v.key),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => agregarVariaciones(1)}>
                <Plus className="mr-1 h-4 w-4" /> Agregar variación
              </Button>
              <span className="text-sm text-muted-foreground">o varias:</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={cuantas}
                onChange={(e) => setCuantas(e.target.value)}
                className="w-20"
                aria-label="Cuántas variaciones agregar"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const n = Number(cuantas);
                  if (Number.isInteger(n) && n >= 1 && n <= 50) agregarVariaciones(n);
                }}
              >
                Agregar
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            El artículo lleva un solo código y sus propias cantidades.
          </p>
        )}
      </section>

      {/* ---------- Precio ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Precio</h2>
        {!form.precioPropio &&
          (heredado ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <p className="font-medium">
                Mayoreo ${heredado.precio} · Menudeo ${heredado.menudeo}
              </p>
              <p className="text-xs text-muted-foreground">
                {heredado.origen === "subcategoria"
                  ? `Es el precio de la subcategoría ${subcategoria?.nombre ?? ""}.`
                  : `Es el precio de la categoría ${categoria?.nombre ?? ""}.`}{" "}
                Se cambia en{" "}
                <Link to="/categorias" className="underline">
                  Categorías
                </Link>
                .
              </p>
            </div>
          ) : form.categoriaId && !cargandoPrecios && negocioId ? (
            <PrecioCategoriaInline
              negocioId={negocioId}
              categoriaId={form.categoriaId}
              categoriaNombre={categoria?.nombre ?? "la categoría"}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Elige la categoría para ver su precio.
            </p>
          ))}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.precioPropio}
            onChange={(e) => set("precioPropio", e.target.checked)}
          />
          Este artículo tiene precio diferente
        </label>
        {form.precioPropio && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="precio">Precio de mayoreo *</Label>
              <Input
                id="precio"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.precio}
                onChange={(e) => set("precio", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menudeo">Precio menudeo *</Label>
              <Input
                id="menudeo"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.menudeo}
                onChange={(e) => set("menudeo", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Se cobra cuando el ticket lleva menos de {PIEZAS_MAYOREO} piezas.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="costo">Costo (opcional)</Label>
          <Input
            id="costo"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.costo}
            onChange={(e) => set("costo", e.target.value)}
          />
        </div>
      </section>

      {/* ---------- Más datos ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Foto y más datos (opcional)</h2>
        <ImageUpload
          urlActual={quitarImagen ? undefined : articulo?.imagenUrl}
          onFile={(file, meta) => {
            setImagenFile(file);
            setImagenViaNanobanana(!!meta?.viaNanobanana);
            setQuitarImagen(false);
            setGuardado(false);
          }}
          onRemove={() => {
            setImagenFile(null);
            setQuitarImagen(true);
            setGuardado(false);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <GeneroInlineSelect generoId={form.generoId} onChange={(g) => set("generoId", g)} />
        </div>
        <div className="space-y-1.5">
          <Label>Etiquetas</Label>
          <EtiquetasChips etiquetas={form.etiquetas} onChange={(eq) => set("etiquetas", eq)} />
        </div>
      </section>

      {/* ---------- Códigos, existencias y etiquetas (ya guardado) ---------- */}
      {editing && articulo && negocioId && (
        <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">Códigos y existencias</h2>
          <p className="text-xs text-muted-foreground">
            Aquí no se capturan cantidades: entran al recibir un lote en la caja o desde{" "}
            <Link to="/ingreso-mercancia" className="underline">
              Ingreso de mercancía
            </Link>
            .
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Artículo final</th>
                  <th className="py-1 pr-3 font-medium">Código</th>
                  {tiendasMayoreo.map((s) => (
                    <th key={s.sucursalId} className="py-1 pr-3 text-right font-medium">
                      {s.nombre}
                      <span className="block font-normal">bodega / tienda</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {finales.map((f) => (
                  <tr key={f.subvariacion?.codigo ?? f.articulo.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{f.nombre}</td>
                    <td className="py-1.5 pr-3 font-mono">{f.codigo || "al guardar"}</td>
                    {tiendasMayoreo.map((s) => {
                      const e = leerExistenciasTienda(
                        f.subvariacion ?? f.articulo,
                        s.sucursalId,
                        s.sucursalId === defaultSucursalId,
                      );
                      return (
                        <td key={s.sucursalId} className="py-1.5 pr-3 text-right tabular-nums">
                          {e.bodega} / {e.tienda}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold">Imprimir etiquetas</h3>
            <EtiquetasFinales
              negocioId={negocioId}
              finales={finales.map((f) => ({ codigo: f.codigo, nombre: f.nombre }))}
              precio={articulo.precioVenta}
            />
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
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
          className="order-2 w-full sm:w-auto"
          onClick={() => navigate("/articulos")}
          disabled={submitting}
        >
          {guardado ? "Volver" : "Cancelar"}
        </Button>
        <Button type="submit" disabled={submitting} className="order-1 w-full sm:order-3 sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear artículo"}
        </Button>
      </div>
    </form>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { useArticulo, useArticulos } from "@/features/articulos/useArticulos";
import { eliminarArticulo } from "@/features/articulos/articuloService";
import { guardarExistenciasSucursal } from "@/features/articulos/existenciasSucursalService";
import type { CambioExistencia } from "@/features/articulos/planearExistencias";
import { ImageUpload } from "@/features/articulos/ImageUpload";
import { Miniatura } from "@/features/articulos/Miniatura";
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
  resolverPrecioEfectivo,
  resolverPrecioHeredado,
  resolverSucursalDefaultId,
  tieneExistencias,
  validarArticuloMayoreo,
  type Articulo,
  type UbicacionStock,
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
  sigla: string;
  referencia: string;
  tieneVariaciones: boolean;
  variaciones: VariacionForm[];
  precioPropio: boolean;
  precio: string;
  menudeo: string;
  costo: string;
  generoId: string;
  etiquetas: string[];
};

type Lugar = "bodega" | "tienda";
const LUGARES: readonly Lugar[] = ["bodega", "tienda"];
/** Una cantidad que se está escribiendo. `base` es lo que había a la vista
 *  al empezar a escribir: si al guardar ya es otra (una venta, un
 *  movimiento), no se pisa y se avisa. */
type CantidadEscrita = { base: number; valor: string };
/** Por fila (la llave de la variación, o `FILA_ARTICULO`) y lugar. */
type Cantidades = Record<string, Partial<Record<Lugar, CantidadEscrita>>>;
/** Fila de cantidades del artículo sin variaciones. */
const FILA_ARTICULO = "articulo";
type CambioEscrito = { indice: number | null; lugar: Lugar; base: number; valor: number };

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
  // Sin `heredaPrecio` el precio es del artículo (también los de antes de la
  // escalera): se carga como «precio diferente» y guardar no lo pierde.
  const propio = a.heredaPrecio !== true;
  return {
    categoriaId: a.categoriaId ?? "",
    subcategoriaId: a.subcategoriaId ?? "",
    nombre: a.nombre ?? "",
    sigla: a.sigla ?? "",
    referencia: a.referencia ?? "",
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
    precioPropio: propio,
    precio: propio ? (a.precioVenta ?? "") : "",
    menudeo: propio ? (a.precioMenudeo ?? "") : "",
    costo: Number(a.preciCompra) ? String(a.preciCompra) : "",
    generoId: a.generoId ?? "",
    etiquetas: a.etiquetas ?? [],
  };
}

/**
 * Registro de un artículo «Solo mayoreo». Primero se dice si tiene
 * variaciones; categoría, subcategoría y género son obligatorios, igual que
 * el precio de compra y el de venta (el de la escalera categoría →
 * subcategoría, o uno propio). Nombre, sigla, referencia y etiquetas son
 * opcionales: el sistema pone el nombre del artículo y el de cada variación.
 * Cada artículo final (el artículo, o cada variación) recibe un código de 8
 * dígitos y aquí mismo se capturan sus cantidades de bodega y tienda.
 *
 * Las cantidades se guardan aparte del resto de la ficha y nunca pisan un
 * movimiento: si la cantidad cambió mientras se editaba, se avisa.
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
  const [searchParams, setSearchParams] = useSearchParams();
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
    sigla: "",
    referencia: "",
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
  // Cantidades: en qué sucursal se capturan y lo que se va escribiendo.
  // A propósito NO se recuerda la última elegida: cada ficha abre en la
  // primera sucursal de mayoreo, para no dejar piezas en otra sin querer.
  const [sucursalCant, setSucursalCant] = useState("");
  const [cant, setCant] = useState<Cantidades>({});
  const [avisoCantidades, setAvisoCantidades] = useState<string | null>(
    searchParams.get("cantidades") === "revisar"
      ? "El artículo se guardó, pero no todas sus cantidades. Revísalas aquí abajo y vuelve a guardar."
      : null,
  );
  // El aviso es de una sola vez: se quita de la dirección para que recargar
  // la página no lo repita.
  useEffect(() => {
    if (searchParams.get("guardado") === "1") setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // El formulario se llena UNA vez por artículo: un cambio remoto (una venta
  // mueve existencias) no borra lo que se está escribiendo.
  const inicializado = useRef<string | null>(null);
  const [cargado, setCargado] = useState(!editing);
  function cargar(a: Articulo) {
    inicializado.current = a.id;
    setForm(formDe(a));
    setImagenFile(null);
    setImagenViaNanobanana(false);
    setQuitarImagen(false);
    setCant({});
    setCargado(true);
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

  // Las cantidades son de una sucursal de mayoreo (las que manejan bodega y
  // tienda). Con una sola no hay nada que elegir.
  const defaultSucursalId = resolverSucursalDefaultId(
    negocio?.sucursalDefaultId,
    sucursales.map((s) => s.sucursalId),
  );
  const tiendasMayoreo = sucursales.filter((s) => s.modoMayoreo);
  const tiendaCant = tiendasMayoreo.find((s) => s.sucursalId === sucursalCant) ?? tiendasMayoreo[0];
  const ubicacionCant: UbicacionStock | null = tiendaCant
    ? {
        sucursalId: tiendaCant.sucursalId,
        esDefault: tiendaCant.sucursalId === defaultSucursalId,
      }
    : null;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    setGuardado(false);
  }
  /** Cambia las variaciones a partir del estado MÁS RECIENTE: la foto de una
   *  fila llega tarde (se comprime, o pasa por «Quitar fondo») y no debe pisar
   *  lo que se escribió o agregó mientras tanto. */
  function cambiarVariaciones(fn: (actuales: VariacionForm[]) => VariacionForm[]) {
    setForm((s) => ({ ...s, variaciones: fn(s.variaciones) }));
    setGuardado(false);
  }
  function setVariacion(key: string, cambio: Partial<VariacionForm>) {
    cambiarVariaciones((vs) => vs.map((v) => (v.key === key ? { ...v, ...cambio } : v)));
  }
  function agregarVariaciones(n: number) {
    cambiarVariaciones((vs) => [...vs, ...Array.from({ length: n }, filaNueva)]);
  }

  /** Una variación con piezas no se puede quitar (el servidor de datos
   *  tampoco lo deja): se avisa antes. */
  function conExistencias(codigo: string | undefined): boolean {
    const sv = codigo ? articulo?.subvariaciones?.find((s) => s.codigo === codigo) : undefined;
    return !!sv && tieneExistencias(sv);
  }

  /** Lo que hay guardado hoy en la sucursal elegida (0 si aún no existe). */
  function enVivo(codigoVariacion: string | undefined, esArticulo: boolean): Record<Lugar, number> {
    const nada = { bodega: 0, tienda: 0 };
    if (!ubicacionCant || !articulo) return nada;
    const obj = esArticulo
      ? articulo
      : codigoVariacion
        ? articulo.subvariaciones?.find((s) => s.codigo === codigoVariacion)
        : undefined;
    if (!obj) return nada;
    return leerExistenciasTienda(obj, ubicacionCant.sucursalId, ubicacionCant.esDefault);
  }

  function escribirCantidad(fila: string, lugar: Lugar, valor: string, actual: number) {
    setCant((prev) => ({
      ...prev,
      [fila]: {
        ...prev[fila],
        [lugar]: { base: prev[fila]?.[lugar]?.base ?? actual, valor },
      },
    }));
    setGuardado(false);
    setAvisoCantidades(null);
  }

  /** Las cantidades escritas que sí cambian algo, o el problema si alguna no
   *  es un entero de 0 en adelante. */
  function cantidadesEscritas(): { problema: string | null; cambios: CambioEscrito[] } {
    const cambios: CambioEscrito[] = [];
    const filas: Array<{ fila: string; indice: number | null }> = form.tieneVariaciones
      ? form.variaciones.map((v, i) => ({ fila: v.key, indice: i }))
      : [{ fila: FILA_ARTICULO, indice: null }];
    for (const { fila, indice } of filas) {
      for (const lugar of LUGARES) {
        const escrita = cant[fila]?.[lugar];
        if (!escrita || escrita.valor.trim() === "") continue;
        const valor = Number(escrita.valor);
        if (!Number.isInteger(valor) || valor < 0) {
          return { problema: "Las cantidades deben ser números enteros, de 0 en adelante", cambios: [] };
        }
        if (valor !== escrita.base) cambios.push({ indice, lugar, base: escrita.base, valor });
      }
    }
    return { problema: null, cambios };
  }

  /** Guarda las cantidades escritas en el artículo ya guardado. Devuelve el
   *  aviso si alguna no quedó (o `null`). */
  async function guardarCantidades(art: Articulo, cambios: CambioEscrito[]): Promise<string | null> {
    if (!negocioId || !ubicacionCant || cambios.length === 0) return null;
    let conflictos = 0;
    const errores: string[] = [];
    for (const lugar of LUGARES) {
      const deEseLugar: CambioExistencia[] = [];
      for (const c of cambios) {
        if (c.lugar !== lugar) continue;
        // Las filas van en el mismo orden que las variaciones guardadas.
        const codigo = c.indice === null ? undefined : art.subvariaciones?.[c.indice]?.codigo;
        if (c.indice !== null && !codigo) {
          errores.push("No se encontró una variación al guardar su cantidad");
          continue;
        }
        deEseLugar.push({
          articuloId: art.id,
          ...(codigo ? { subvariacionCodigo: codigo } : {}),
          base: c.base,
          valor: c.valor,
        });
      }
      if (deEseLugar.length === 0) continue;
      const r = await guardarExistenciasSucursal(negocioId, ubicacionCant, deEseLugar, lugar);
      conflictos += r.conflictos.length;
      errores.push(...r.errores.map((e) => e.mensaje));
    }
    const partes: string[] = [];
    if (conflictos > 0) {
      partes.push(
        conflictos === 1
          ? "Una cantidad cambió mientras editabas (una venta o un movimiento) y no se guardó"
          : `${conflictos} cantidades cambiaron mientras editabas (ventas o movimientos) y no se guardaron`,
      );
    }
    if (errores.length > 0) partes.push(errores[0]!);
    return partes.length > 0 ? `${partes.join(". ")}. Revísalas y vuelve a guardar.` : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    const problema = validarArticuloMayoreo(
      {
        categoriaId: form.categoriaId,
        subcategoriaId: form.subcategoriaId,
        generoId: form.generoId,
        tieneVariaciones: form.tieneVariaciones,
        variaciones: form.variaciones.length,
        costo: form.costo,
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
    const escritas = cantidadesEscritas();
    if (escritas.problema) {
      setError(escritas.problema);
      return;
    }
    setSubmitting(true);
    setError(null);
    setAvisoCantidades(null);
    const input: ArticuloMayoreoInput = {
      categoriaId: form.categoriaId,
      subcategoriaId: form.subcategoriaId,
      subcategoriaNombre: subcategoria?.nombre ?? "",
      nombre: form.nombre,
      sigla: form.sigla,
      referencia: form.referencia,
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
      const guardadoArt =
        editing && id
          ? await actualizarArticuloMayoreo(negocioId, id, input, precios, otrosNombres)
          : await crearArticuloMayoreo(negocioId, input, precios, otrosNombres);
      // La ficha ya quedó: las cantidades van aparte, y si alguna falla se
      // avisa sin perder lo demás.
      let aviso: string | null;
      try {
        aviso = await guardarCantidades(guardadoArt, escritas.cambios);
      } catch (err) {
        aviso = `No se pudieron guardar las cantidades: ${(err as Error).message}`;
      }
      if (editing) {
        cargar(guardadoArt);
        setGuardado(true);
        setAvisoCantidades(aviso);
      } else {
        navigate(
          `/articulos/mayoreo/${guardadoArt.id}?guardado=1${aviso ? "&cantidades=revisar" : ""}`,
          { replace: true },
        );
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

  if (editing && ((loading && !articulo) || (articulo?.soloMayoreo && !cargado))) {
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
  const fotoPrincipal = quitarImagen ? undefined : articulo?.imagenUrl;

  /** Los dos campos de cantidad (bodega y tienda) de una fila. */
  function camposCantidad(fila: string, nombreFila: string, vivo: Record<Lugar, number>) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {LUGARES.map((lugar) => (
          <label key={lugar} className="space-y-1 text-xs text-muted-foreground">
            {lugar === "bodega" ? "Bodega" : "Tienda"}
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={cant[fila]?.[lugar]?.valor ?? String(vivo[lugar])}
              onChange={(e) => escribirCantidad(fila, lugar, e.target.value, vivo[lugar])}
              // Al tocar el campo se marca lo que hay: se escribe encima.
              onFocus={(e) => e.target.select()}
              aria-label={`${lugar === "bodega" ? "Bodega" : "Tienda"} de ${nombreFila}`}
              className="h-9 text-right text-sm text-foreground"
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`mx-auto w-full max-w-3xl space-y-5 px-3 pt-4 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-6 ${
        // Hueco para la barra fija de móvil (más alto si trae un aviso).
        error
          ? "pb-[calc(12rem+env(safe-area-inset-bottom))]"
          : "pb-[calc(6rem+env(safe-area-inset-bottom))]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/articulos")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Artículos
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          {editing && articulo && (
            <Miniatura url={fotoPrincipal} alt={articulo.nombre ?? ""} size={40} />
          )}
          <h1 className="truncate text-lg font-semibold sm:text-xl">
            {editing ? `Mayoreo #${id}` : "Nuevo artículo de mayoreo"}
          </h1>
        </div>
      </div>

      {guardado && articulo && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">Guardado: «{articulo.nombre}».</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              document.getElementById("etiquetas")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Printer className="mr-1 h-4 w-4" /> Imprimir etiquetas
          </Button>
          <Button asChild type="button" size="sm" variant="outline">
            <Link
              to={`/articulos/mayoreo/nuevo?cat=${encodeURIComponent(articulo.categoriaId ?? "")}&sub=${encodeURIComponent(articulo.subcategoriaId ?? "")}`}
            >
              <Plus className="mr-1 h-4 w-4" /> Registrar otro
            </Link>
          </Button>
        </div>
      )}
      {avisoCantidades && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {avisoCantidades}
        </p>
      )}

      {/* ---------- 1. ¿Tiene variaciones? ---------- */}
      <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">¿Tiene variaciones?</h2>
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-background p-1" role="radiogroup">
          {[false, true].map((valor) => (
            <button
              key={String(valor)}
              type="button"
              role="radio"
              aria-checked={form.tieneVariaciones === valor}
              onClick={() => {
                setForm((s) => ({
                  ...s,
                  tieneVariaciones: valor,
                  variaciones: valor && s.variaciones.length === 0 ? [filaNueva()] : s.variaciones,
                }));
                setGuardado(false);
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
        <p className="text-xs text-muted-foreground">
          {form.tieneVariaciones
            ? "Cada variación lleva su propio código y sus propias cantidades. Se capturan más abajo."
            : "El artículo lleva un solo código y sus propias cantidades."}
        </p>
      </section>

      {/* ---------- 2. Artículo ---------- */}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <GeneroInlineSelect
            generoId={form.generoId}
            onChange={(g) => set("generoId", g)}
            requerido
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre (opcional)</Label>
          <Input
            id="nombre"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder={nombreSugerido ? `Si lo dejas vacío: ${nombreSugerido}` : "Elige la subcategoría"}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sigla">Sigla (opcional)</Label>
            <Input
              id="sigla"
              value={form.sigla}
              onChange={(e) => set("sigla", e.target.value)}
              autoCapitalize="characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referencia">Referencia (opcional)</Label>
            <Input
              id="referencia"
              value={form.referencia}
              onChange={(e) => set("referencia", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Etiquetas (opcional)</Label>
          <EtiquetasChips etiquetas={form.etiquetas} onChange={(eq) => set("etiquetas", eq)} />
        </div>
        <ImageUpload
          label="Foto (opcional)"
          urlActual={fotoPrincipal}
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
      </section>

      {/* ---------- 3. Precios ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">Precios</h2>
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="costo">Precio de compra *</Label>
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

        <p className="text-sm font-medium">Precio de venta *</p>
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
              key={form.categoriaId}
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
      </section>

      {/* ---------- 4. Variaciones y cantidades ---------- */}
      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold">
          {form.tieneVariaciones ? "Variaciones y cantidades" : "Cantidades"}
        </h2>
        {tiendaCant ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Label htmlFor="cant-sucursal" className="text-sm font-normal text-muted-foreground">
              Cantidades en
            </Label>
            {tiendasMayoreo.length > 1 ? (
              <select
                id="cant-sucursal"
                value={tiendaCant.sucursalId}
                onChange={(e) => {
                  // Lo escrito era de la otra sucursal: se descarta.
                  setSucursalCant(e.target.value);
                  setCant({});
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
              >
                {tiendasMayoreo.map((s) => (
                  <option key={s.sucursalId} value={s.sucursalId}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <span id="cant-sucursal" className="font-medium">
                {tiendaCant.nombre}
              </span>
            )}
          </div>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Para capturar cantidades marca una sucursal como «mayoreo» en{" "}
            <Link to="/sucursales" className="underline">
              Sucursales
            </Link>
            .
          </p>
        )}

        {form.tieneVariaciones ? (
          <>
            <p className="text-xs text-muted-foreground">
              El nombre de cada variación es opcional: si lo dejas vacío queda como m1, m2…
            </p>
            <ul className="space-y-2">
              {form.variaciones.map((v, i) => (
                <li key={v.key} className="space-y-2 rounded-md border p-2">
                  {/* En móvil el nombre va en su propio renglón (a todo lo
                      ancho) y la foto debajo; en escritorio, todo en uno. */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="order-2 sm:order-1 sm:shrink-0">
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
                    </div>
                    <div className="order-1 flex min-w-0 items-start gap-2 sm:order-2 sm:flex-1">
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
                        className="shrink-0"
                        disabled={conExistencias(v.codigo)}
                        title={
                          conExistencias(v.codigo)
                            ? "Tiene existencias: no se puede quitar"
                            : "Quitar variación"
                        }
                        aria-label={`Quitar la variación ${v.nombre || nombresVista[i]}`}
                        onClick={() => cambiarVariaciones((vs) => vs.filter((x) => x.key !== v.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {ubicacionCant && (
                    <div className="sm:max-w-xs">
                      {camposCantidad(v.key, v.nombre || nombresVista[i] || `variación ${i + 1}`, enVivo(v.codigo, false))}
                    </div>
                  )}
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
          ubicacionCant && (
            <div className="flex items-center gap-3 rounded-md border p-2">
              <Miniatura url={fotoPrincipal} alt={form.nombre || nombreSugerido} size={56} />
              <div className="min-w-0 flex-1 sm:max-w-xs">
                {camposCantidad(FILA_ARTICULO, "el artículo", enVivo(undefined, true))}
              </div>
            </div>
          )
        )}
        {ubicacionCant && (
          <p className="text-[11px] text-muted-foreground">
            Las cantidades se guardan junto con el artículo. Si una cambió mientras editabas (una
            venta o un movimiento), no se pisa y se te avisa.
          </p>
        )}
      </section>

      {/* ---------- 5. Códigos y etiquetas (ya guardado) ---------- */}
      {editing && articulo && negocioId && (
        <section id="etiquetas" className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">Códigos y existencias</h2>
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
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2">
                        <Miniatura
                          url={f.subvariacion?.imagenUrl ?? f.articulo.imagenUrl}
                          alt={f.nombre}
                          size={32}
                        />
                        <span className="min-w-0">{f.nombre}</span>
                      </span>
                    </td>
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
              finales={finales.map((f) => ({
                codigo: f.codigo,
                nombre: f.nombre,
                precio: resolverPrecioEfectivo(f.articulo, f.subvariacion).precio,
                imagenUrl: f.subvariacion?.imagenUrl ?? f.articulo.imagenUrl,
              }))}
            />
          </div>
        </section>
      )}

      {/* En móvil la barra queda fija abajo, en un solo renglón, y el aviso de
          error va dentro: se ve aunque se guarde desde la mitad de la ficha. */}
      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t bg-card/95 p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.25rem))] backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:backdrop-blur-none">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          {editing && (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 px-3 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={submitting}
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          )}
          <div className="hidden sm:block sm:flex-1" />
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => navigate("/articulos")}
            disabled={submitting}
          >
            {guardado ? "Volver" : "Cancelar"}
          </Button>
          <Button type="submit" disabled={submitting} className="flex-[2] sm:flex-none">
            <Save className="mr-2 h-4 w-4" />
            {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear artículo"}
          </Button>
        </div>
      </div>
    </form>
  );
}

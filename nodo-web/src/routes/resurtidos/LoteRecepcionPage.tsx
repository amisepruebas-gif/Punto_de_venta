import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  CloudOff,
  Delete,
  Keyboard,
  Loader2,
  Minus,
  PackageX,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import { useBackHandler } from "@/lib/back-handler";
import { SinConexion } from "@/lib/sinInternet";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useSucursal } from "@/features/sucursal/useSucursal";
import { useCarrito } from "@/features/ventas/carritoStore";
import { resolverCodigoExacto } from "@/features/ventas/elegirArticulo";
import {
  llaveRecepcion,
  subirPendientes,
  useConteoLote,
  useRecepcionLotes,
  useSelladasLote,
  useSubidaLotes,
  useSubirSesiones,
  type SesionSellada,
} from "@/features/resurtidos/recepcionStore";
import {
  apagarEnlaceFotos,
  crearEnlaceFotos,
  type MetaSesionLote,
} from "@/features/resurtidos/loteRecepcionService";
import { sonarTono } from "@/features/resurtidos/tonos";
import {
  loteConSelladas,
  nombresDeLote,
  pzas,
  sumaPiezas,
  textoContenido,
} from "@/features/resurtidos/loteVista";
import {
  FotosLoteLista,
  QrAccesoFotos,
  useFotosLote,
  type AccesoFotos,
} from "@/features/resurtidos/FotosLote";
import {
  ENLACE_RECIBIR_VENTANA_MS,
  aplicarEscaneoLote,
  cajasOrdenadas,
  claveArticulo,
  conteoLoteEstaVacio,
  conteoLoteVacio,
  contenidoDePaquete,
  declaradoPorArticulo,
  esCodigoEtiquetaLote,
  etiquetaLoteLegible,
  fechaISO_MX,
  fijarPiezasConteo,
  loteRecibible,
  normalizarCodigoEscaneado,
  planearRecepcionLote,
  quitarPaqueteConteo,
  resumenLote,
  resumenLoteConConteo,
  sesionesOrdenadas,
  type Articulo,
  type ArticuloEscaneado,
  type ConteoLote,
  type Resurtido,
  type ResurtidoEstado,
  type ResumenLote,
  type TonoEscaneo,
} from "@shared";

// ============================================================
// Recepción de un lote de envío en la caja
// ============================================================
//
// No es una lista para palomear: se escanea libre (etiquetas de caja, de
// paquete o artículos) y `aplicarEscaneoLote` concilia por artículo contra lo
// declarado. Lo escaneado vive en la tablet (`recepcionStore`) hasta
// "Terminar", que sella la sesión y la sube (sola, si no hay internet).
//
// El foco SIEMPRE está en el campo Código: ahí escribe el lector (teclea el
// código + Enter). Por eso ningún botón se queda con el foco (`sinFoco`).

const ESTADO_LABEL: Partial<Record<ResurtidoEstado, string>> = {
  creando: "Armándose",
  enviado: "Enviado",
  parcial: "Recibido en parte",
  cerrado: "Cerrado",
};

const ESTADO_COLOR: Partial<Record<ResurtidoEstado, string>> = {
  creando: "bg-muted text-muted-foreground",
  enviado: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  parcial: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  cerrado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const COLOR_TONO: Record<TonoEscaneo, string> = {
  bien: "bg-emerald-600 text-white",
  repetido: "bg-amber-400 text-amber-950",
  sobrante: "bg-orange-600 text-white",
  desconocido: "bg-red-600 text-white",
  pregunta: "bg-blue-600 text-white",
};

const CONTEO_VACIO: ConteoLote = conteoLoteVacio();
const MAX_CANTIDAD = 9999;

/** Botones que no se quedan con el foco: el lector sigue escribiendo en
 *  Código (y su Enter no vuelve a "tocar" el botón). */
const sinFoco = (e: MouseEvent) => e.preventDefault();

type Respuesta = { tono: TonoEscaneo | null; texto: string; n: number };
type PideVariacion = { padreId: string; cantidad: number; danado: boolean };
type Dialogo = "falta" | "terminar" | "fotos" | null;

export function LoteRecepcionPage({ lote }: { lote: Resurtido }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { negocioId, nodoId } = useNodoSession();
  const enTurno = useCarrito((s) => s.enTurno);
  const { byId, bySigla, byCodigoVariacion, loading: cargandoArticulos } = useArticulos();
  // Sucursal de mayoreo: al terminar se elige si lo recibido entra a la
  // tienda o a la bodega de la tienda.
  const { sucursal } = useSucursal();
  const manejaBodega = sucursal?.modoMayoreo === true;
  const hayTecladoFisico = useTecladoFisico();
  // Al abrir la pantalla se intenta subir lo pendiente (también va en App).
  useSubirSesiones();

  const conteo = useConteoLote(negocioId, lote.id);
  const selladas = useSelladasLote(negocioId, lote.id);
  const setConteo = useRecepcionLotes((s) => s.setConteo);
  const fotos = useFotosLote(negocioId, lote.id);

  const vista = useMemo(() => loteConSelladas(lote, selladas), [lote, selladas]);
  const nombre = useMemo(() => nombresDeLote(lote, byId), [lote, byId]);
  const declarado = useMemo(() => declaradoPorArticulo(lote), [lote]);
  const resumen = useMemo(() => resumenLoteConConteo(vista, conteo), [vista, conteo]);

  const [texto, setTexto] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [teclado, setTeclado] = useState<string | null>(null);
  const [danado, setDanado] = useState(false);
  const [respuesta, setRespuesta] = useState<Respuesta>({
    tono: null,
    texto: "Escanea una caja, un paquete o un artículo",
    n: 0,
  });
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [variacion, setVariacion] = useState<PideVariacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [acceso, setAcceso] = useState<AccesoFotos | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  /** Un diálogo con campos de texto tiene el foco: Código no lo reclama. */
  const focoAjeno = useRef(false);

  function enfocar(seleccionar = false) {
    requestAnimationFrame(() => {
      if (focoAjeno.current) return;
      inputRef.current?.focus();
      if (seleccionar) inputRef.current?.select();
    });
  }
  useEffect(() => {
    focoAjeno.current = dialogo === "terminar";
    enfocar();
  }, [dialogo]);

  // También uno cerrado con piezas "no llegó": si aparecen, se reciben.
  const abierto = useMemo(() => loteRecibible(lote), [lote]);

  /** Lo contado más reciente (no el del último render: el lector manda los
   *  códigos más rápido de lo que se pinta la pantalla). */
  function conteoActual(): ConteoLote {
    if (!negocioId) return CONTEO_VACIO;
    return useRecepcionLotes.getState().lotes[llaveRecepcion(negocioId, lote.id)]?.conteo ?? CONTEO_VACIO;
  }

  function responder(tono: TonoEscaneo | null, t: string, sonar = true) {
    setRespuesta((r) => ({ tono, texto: t, n: r.n + 1 }));
    if (sonar && tono) sonarTono(tono);
  }

  /** Código → artículo. Un padre con variaciones pide elegir cuál, salvo que
   *  el lote lo declare así, sin variación. */
  function resolverArticulo(codigo: string): ArticuloEscaneado | null {
    const r = resolverCodigoExacto(
      codigo,
      byId,
      bySigla,
      // En un lote cualquier variación existente vale (vienen declaradas así).
      (id) => (byId.get(id)?.subvariaciones?.length ?? 0) > 0,
      byCodigoVariacion,
    );
    if (!r) return null;
    if (r.sub) {
      return {
        articuloId: r.padre.id,
        subvariacionCodigo: r.sub.codigo,
        nombre: nombre(claveArticulo(r.padre.id, r.sub.codigo)),
      };
    }
    const subs = (r.padre.subvariaciones ?? []).filter((s) => !!s.codigo);
    const comoPadre =
      declarado.has(r.padre.id) &&
      !subs.some((s) => declarado.has(claveArticulo(r.padre.id, s.codigo)));
    if (subs.length > 0 && !comoPadre) {
      return { variacionesDe: r.padre.id, nombre: r.padre.nombre };
    }
    return { articuloId: r.padre.id, nombre: nombre(r.padre.id) };
  }

  function aplicar(
    codigo: string,
    opciones: {
      cantidad?: number;
      danado?: boolean;
      resolver?: (codigo: string) => ArticuloEscaneado | null;
    } = {},
  ) {
    if (!negocioId || !abierto) return;
    if (cargandoArticulos && !esCodigoEtiquetaLote(codigo) && !opciones.resolver) {
      responder("pregunta", "Cargando artículos… vuelve a escanear en un momento");
      return;
    }
    const c = opciones.cantidad ?? cantidad;
    const d = opciones.danado ?? danado;
    const actual = conteoActual();
    const r = aplicarEscaneoLote({
      lote: vista,
      conteo: actual,
      codigo,
      cantidad: c,
      danado: d,
      hora: fechaISO_MX().slice(11),
      resolverArticulo: opciones.resolver ?? resolverArticulo,
      nombreArticulo: nombre,
    });
    if (r.conteo !== actual) setConteo(negocioId, lote.id, r.conteo);
    responder(r.tono, r.texto);
    if (r.elegirVariacionDe) {
      setVariacion({ padreId: r.elegirVariacionDe, cantidad: c, danado: d });
    } else {
      setCantidad(1);
      setTeclado(null);
    }
  }

  function alEnter(valor: string) {
    const codigo = normalizarCodigoEscaneado(valor);
    setTexto("");
    if (!codigo) return;
    // Un escaneo cierra lo que esté a la vista (salvo el cierre).
    if (dialogo === "falta" || dialogo === "fotos") setDialogo(null);
    setVariacion(null);
    aplicar(codigo);
    enfocar();
  }

  // Escaneo que abrió esta pantalla desde la lista: también cuenta (una vez).
  const escaneoInicial = (location.state as { escaneo?: string } | null)?.escaneo;
  const inicialUsado = useRef(false);
  useEffect(() => {
    if (inicialUsado.current || !escaneoInicial || !negocioId) return;
    inicialUsado.current = true;
    navigate(location.pathname, { replace: true, state: null });
    if (abierto) aplicar(escaneoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escaneoInicial, negocioId]);

  function cambiarConteo(fn: (c: ConteoLote) => ConteoLote) {
    if (!negocioId) return;
    setConteo(negocioId, lote.id, fn(conteoActual()));
  }

  async function terminar(quien: string, nota: string, aBodega: boolean) {
    if (!negocioId || !nodoId) return;
    const meta: MetaSesionLote = {
      fecha: fechaISO_MX(),
      quien: quien.trim(),
      nodoId,
      ...(enTurno ? { vendedor: enTurno } : {}),
      ...(nota.trim() ? { nota: nota.trim() } : {}),
      ...(aBodega && manejaBodega ? { destino: "bodega" as const } : {}),
    };
    const sellada = useRecepcionLotes.getState().sellar(negocioId, lote.id, meta);
    setDialogo(null);
    setDanado(false);
    if (!sellada) return;
    setGuardando(true);
    responder(null, "Guardando la recepción…", false);
    try {
      await subirPendientes();
    } finally {
      setGuardando(false);
    }
    const k = llaveRecepcion(negocioId, lote.id);
    const st = useRecepcionLotes.getState();
    const sigue = st.lotes[k]?.selladas.find((s) => s.sesionId === sellada.sesionId);
    if (!sigue) {
      const u = useSubidaLotes.getState().ultimaSubida[k];
      const r = u?.sesionId === sellada.sesionId ? u.resultado : null;
      if (r?.vacia) {
        responder("repetido", "No había nada nuevo: todo ya estaba recibido", false);
      } else {
        const entro = sumaPiezas(r?.sesion.entro);
        const faltan = r?.despues.totales.pendiente ?? 0;
        responder(
          "bien",
          `Recepción guardada. Entraron ${pzas(entro)}${
            r?.sesion.destino === "bodega" ? " a la bodega" : ""
          }. ${
            faltan > 0 ? `Faltan ${pzas(faltan)}.` : "Lote completo."
          }`,
          false,
        );
      }
    } else if (sigue.error) {
      responder("desconocido", `No se guardó: ${sigue.error}`, false);
    } else {
      responder("repetido", "Quedó guardado en la tablet. Se sube solo al volver la conexión.", false);
    }
  }

  const recibidos = resumen.paquetesRecibidos + resumen.paquetesDanados;
  const hayConteo = !conteoLoteEstaVacio(conteo);
  const accesoVivo = !!acceso && Date.now() < acceso.creadoMs + ENLACE_RECIBIR_VENTANA_MS;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b bg-card px-2 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          onMouseDown={sinFoco}
          onClick={() => navigate("/resurtidos")}
          aria-label="Volver"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold">Lote {lote.folio ?? lote.id}</h1>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase",
                ESTADO_COLOR[lote.estado] ?? "bg-muted",
              )}
            >
              {ESTADO_LABEL[lote.estado] ?? lote.estado}
            </span>
          </div>
          <p className="truncate text-sm text-muted-foreground" data-avance>
            {resumen.paquetesTotal > 0 && (
              <>
                <b className="text-foreground">
                  {recibidos} de {resumen.paquetesTotal} paquetes
                </b>
                {" · "}
              </>
            )}
            Cajas {resumen.cajasLlegadas.size} de {resumen.cajasTotal}
            {" · "}
            {resumen.totales.pendiente > 0
              ? `Faltan ${pzas(resumen.totales.pendiente)}`
              : "Nada pendiente"}
            {resumen.totales.noLlego > 0 && ` · Marcado "no llegó": ${pzas(resumen.totales.noLlego)}`}
          </p>
        </div>
        {abierto && (
          <Button
            variant="outline"
            className="h-11 shrink-0 px-3"
            onMouseDown={sinFoco}
            onClick={() => setDialogo("falta")}
          >
            <ClipboardList className="mr-1.5 h-4 w-4" />
            Lo que falta
          </Button>
        )}
        {(abierto || fotos.length > 0) && (
          <Button
            variant="outline"
            className="h-11 shrink-0 px-3"
            onMouseDown={sinFoco}
            onClick={() => setDialogo("fotos")}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Fotos{fotos.length > 0 ? ` (${fotos.length})` : ""}
            {accesoVivo && <span className="ml-1.5 h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
          </Button>
        )}
      </header>

      <AvisoPendientes negocioId={negocioId} loteId={lote.id} selladas={selladas} />

      {!abierto ? (
        <LoteSinRecibir
          lote={lote}
          nombre={nombre}
          fotos={<FotosLoteLista fotos={fotos} />}
          hayConteo={hayConteo}
          onBorrarConteo={() => negocioId && setConteo(negocioId, lote.id, CONTEO_VACIO)}
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 p-3">
          {/* Zona de escaneo */}
          <section
            className={cn(
              "flex min-h-0 w-[55%] flex-col gap-2 rounded-xl border-2 p-3",
              danado ? "border-red-500 bg-red-500/5" : "border-transparent bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Cantidad</span>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onMouseDown={sinFoco}
                onClick={() => {
                  setTeclado(null);
                  setCantidad((n) => Math.max(1, n - 1));
                }}
                aria-label="Menos"
                disabled={cantidad <= 1}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <output
                data-cantidad={cantidad}
                className={cn(
                  "flex h-12 min-w-[4.5rem] items-center justify-center rounded-md border px-2 text-2xl font-bold tabular-nums",
                  teclado !== null && "border-marca ring-2 ring-marca/40",
                  cantidad > 1 && "bg-blue-500/10",
                )}
              >
                {teclado !== null && teclado !== "" ? teclado : cantidad}
              </output>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onMouseDown={sinFoco}
                onClick={() => {
                  setTeclado(null);
                  setCantidad((n) => Math.min(MAX_CANTIDAD, n + 1));
                }}
                aria-label="Más"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                variant={teclado !== null ? "default" : "outline"}
                size="icon"
                className="h-12 w-12"
                onMouseDown={sinFoco}
                onClick={() => setTeclado((t) => (t === null ? "" : null))}
                aria-label="Teclear cantidad"
                aria-pressed={teclado !== null}
              >
                <Keyboard className="h-5 w-5" />
              </Button>
              <div className="flex-1" />
              <Button
                variant={danado ? "destructive" : "outline"}
                className={cn("h-12 shrink-0 px-4 font-semibold", !danado && "border-red-300 text-red-700")}
                onMouseDown={sinFoco}
                onClick={() => setDanado((x) => !x)}
                aria-pressed={danado}
              >
                <PackageX className="mr-1.5 h-5 w-5" />
                {danado ? "Dañado: SÍ" : "Dañado"}
              </Button>
            </div>

            {teclado !== null && (
              <TecladoCantidad
                onDigito={(dg) => {
                  const t = (teclado + dg).replace(/^0+/, "").slice(0, 4);
                  setTeclado(t);
                  setCantidad(Math.min(MAX_CANTIDAD, Number(t) || 1));
                }}
                onBorrar={() => {
                  const t = teclado.slice(0, -1);
                  setTeclado(t);
                  setCantidad(Number(t) || 1);
                }}
                onListo={() => setTeclado(null)}
              />
            )}

            <Input
              ref={inputRef}
              aria-label="Código"
              placeholder="Escanea o escribe el código"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  alEnter(e.currentTarget.value);
                }
              }}
              // Si se pierde (un toque en un espacio vacío), vuelve.
              onBlur={() => enfocar()}
              inputMode={hayTecladoFisico ? "none" : "search"}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-14 text-xl"
            />

            {danado && (
              <p className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">
                Lo que escanees se anota como DAÑADO (no entra al inventario)
              </p>
            )}

            <div
              key={respuesta.n}
              role="status"
              aria-live="polite"
              data-tono={respuesta.tono ?? "ninguno"}
              className={cn(
                "flex min-h-[7rem] flex-1 items-center justify-center rounded-xl p-4 text-center text-2xl font-bold leading-tight animate-in fade-in zoom-in-95 duration-150",
                respuesta.tono ? COLOR_TONO[respuesta.tono] : "bg-muted text-muted-foreground",
              )}
            >
              {guardando && <Loader2 className="mr-2 h-6 w-6 shrink-0 animate-spin" />}
              {respuesta.texto}
            </div>
          </section>

          {/* Lo contado en esta sesión */}
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
            <h2 className="border-b px-3 py-2 text-sm font-semibold">Contado en esta sesión</h2>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              <ListaConteo
                lote={lote}
                conteo={conteo}
                nombre={nombre}
                onCambiar={cambiarConteo}
              />
            </div>
            <div className="border-t p-2">
              <Button
                className="h-14 w-full bg-marca text-lg font-semibold text-white hover:bg-marca/90"
                onMouseDown={sinFoco}
                onClick={() => setDialogo("terminar")}
                disabled={!hayConteo || guardando}
              >
                {guardando ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Terminar
              </Button>
            </div>
          </section>
        </div>
      )}

      {dialogo === "falta" && (
        <LoQueFaltaDialogo
          lote={lote}
          resumen={resumen}
          nombre={nombre}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo === "terminar" && negocioId && (
        <TerminarDialogo
          vista={vista}
          conteo={conteo}
          byId={byId}
          nombre={nombre}
          enTurno={enTurno ?? ""}
          manejaBodega={manejaBodega}
          onGuardar={terminar}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo === "fotos" && negocioId && (
        <FotosDialogo
          negocioId={negocioId}
          lote={lote}
          puedeCrear={abierto}
          acceso={acceso}
          setAcceso={setAcceso}
          fotos={<FotosLoteLista fotos={fotos} />}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {variacion && (
        <VariacionDialogo
          pide={variacion}
          resumen={resumen}
          byId={byId}
          nombre={nombre}
          onElegir={(articuloId, subvariacionCodigo) => {
            const p = variacion;
            setVariacion(null);
            const elegido: ArticuloEscaneado = {
              articuloId,
              subvariacionCodigo,
              nombre: nombre(claveArticulo(articuloId, subvariacionCodigo)),
            };
            aplicar(subvariacionCodigo, {
              cantidad: p.cantidad,
              danado: p.danado,
              resolver: () => elegido,
            });
          }}
          onCerrar={() => {
            setVariacion(null);
            responder(null, "Escanea una caja, un paquete o un artículo", false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Piezas
// ============================================================

/** Ventana simple sobre la pantalla. Atrás de Android la cierra (se registra
 *  al abrirse, encima del de la página). Sin campos de texto, no se queda
 *  con el foco: el lector sigue escribiendo en Código. */
function Dialogo({
  titulo,
  onCerrar,
  children,
  pie,
  conTexto = false,
  className,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  conTexto?: boolean;
  className?: string;
}) {
  useBackHandler(() => {
    onCerrar();
    return true;
  }, [onCerrar]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      role="dialog"
      aria-modal
      aria-label={titulo}
      onMouseDown={conTexto ? undefined : sinFoco}
    >
      <div
        className={cn(
          "flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-lg",
          className,
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b px-4 py-1.5">
          <h2 className="flex-1 truncate text-lg font-semibold">{titulo}</h2>
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={sinFoco}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        {pie && <footer className="flex shrink-0 justify-end gap-2 border-t p-3">{pie}</footer>}
      </div>
    </div>
  );
}

function TecladoCantidad({
  onDigito,
  onBorrar,
  onListo,
}: {
  onDigito: (d: string) => void;
  onBorrar: () => void;
  onListo: () => void;
}) {
  const tecla = "h-11 text-xl font-semibold";
  return (
    <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Teclado de cantidad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
        <Button
          key={d}
          variant="outline"
          className={tecla}
          onMouseDown={sinFoco}
          onClick={() => onDigito(d)}
        >
          {d}
        </Button>
      ))}
      <Button
        variant="outline"
        className={tecla}
        onMouseDown={sinFoco}
        onClick={onBorrar}
        aria-label="Borrar dígito"
      >
        <Delete className="h-5 w-5" />
      </Button>
      <Button className={tecla} onMouseDown={sinFoco} onClick={onListo}>
        Listo
      </Button>
    </div>
  );
}

/** Lo escaneado en esta sesión, con correcciones. */
function ListaConteo({
  lote,
  conteo,
  nombre,
  onCambiar,
}: {
  lote: Resurtido;
  conteo: ConteoLote;
  nombre: (clave: string) => string;
  onCambiar: (fn: (c: ConteoLote) => ConteoLote) => void;
}) {
  if (conteoLoteEstaVacio(conteo)) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        Aún no escaneas nada en esta sesión.
      </p>
    );
  }
  const cajas = Object.entries(conteo.cajas)
    .map(([llave, hora]) => ({ llave, hora, orden: lote.cajas?.[llave]?.orden ?? 0 }))
    .sort((a, b) => a.orden - b.orden);
  const paquetes = [
    ...Object.entries(conteo.paquetes).map(([llave, hora]) => ({ llave, hora, danado: false })),
    ...Object.entries(conteo.paquetesDanados).map(([llave, hora]) => ({ llave, hora, danado: true })),
  ].sort((a, b) => b.hora.localeCompare(a.hora));
  const renglones = [
    ...Object.entries(conteo.piezas).map(([clave, n]) => ({ clave, n, danado: false })),
    ...Object.entries(conteo.danadas).map(([clave, n]) => ({ clave, n, danado: true })),
  ].sort((a, b) => nombre(a.clave).localeCompare(nombre(b.clave), "es"));

  return (
    <div className="space-y-3">
      {cajas.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cajas que llegaron
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {cajas.map((c) => (
              <span key={c.llave} className="rounded-full bg-muted px-2.5 py-1 text-sm">
                Caja {c.orden} <span className="text-xs text-muted-foreground">{c.hora.slice(0, 5)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {paquetes.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paquetes ({paquetes.length})
          </h3>
          <ul className="space-y-1">
            {paquetes.map((p) => {
              const paq = lote.paquetes?.[p.llave];
              return (
                <li
                  key={p.llave}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2",
                    p.danado && "border-red-300 bg-red-500/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {paq ? textoContenido(paq, nombre) : p.llave}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.danado && <b className="text-red-700">Dañado · </b>}
                      {paq ? etiquetaLoteLegible(paq.codigo) : ""} · {p.hora.slice(0, 5)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onMouseDown={sinFoco}
                    onClick={() => onCambiar((c) => quitarPaqueteConteo(c, p.llave))}
                    aria-label="Quitar paquete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {renglones.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Piezas contadas
          </h3>
          <ul className="space-y-1">
            {renglones.map((r) => (
              <li
                key={`${r.danado ? "d" : "b"}_${r.clave}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border p-1.5 pl-2",
                  r.danado && "border-red-300 bg-red-500/5",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nombre(r.clave)}</p>
                  {r.danado && <p className="text-xs font-semibold text-red-700">Dañado</p>}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onMouseDown={sinFoco}
                  onClick={() => onCambiar((c) => fijarPiezasConteo(c, r.clave, r.n - 1, r.danado))}
                  aria-label="Una menos"
                >
                  {r.n > 1 ? <Minus className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </Button>
                <span className="w-12 text-center text-lg font-bold tabular-nums">{r.n}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onMouseDown={sinFoco}
                  onClick={() => onCambiar((c) => fijarPiezasConteo(c, r.clave, r.n + 1, r.danado))}
                  aria-label="Una más"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {conteo.desconocidos.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            No se reconocieron
          </h3>
          <ul className="space-y-1">
            {conteo.desconocidos.map((codigo) => (
              <li key={codigo} className="flex items-center gap-2 rounded-md border border-red-300 p-1.5 pl-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{codigo}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onMouseDown={sinFoco}
                  onClick={() =>
                    onCambiar((c) => ({
                      ...c,
                      desconocidos: c.desconocidos.filter((x) => x !== codigo),
                    }))
                  }
                  aria-label="Quitar código"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Aviso fijo mientras haya recepciones selladas sin subir. */
function AvisoPendientes({
  negocioId,
  loteId,
  selladas,
}: {
  negocioId: string | null;
  loteId: string;
  selladas: SesionSellada[];
}) {
  const subiendo = useSubidaLotes((s) => s.subiendo);
  const limpiarError = useRecepcionLotes((s) => s.limpiarError);
  const descartar = useRecepcionLotes((s) => s.descartarSellada);
  const [borrando, setBorrando] = useState<string | null>(null);
  if (!negocioId || selladas.length === 0) return null;
  const conError = selladas.filter((s) => s.error);
  const enFila = selladas.length - conError.length;
  return (
    <div className="shrink-0 space-y-1 border-b px-3 py-1.5">
      {enFila > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-amber-400/20 px-3 py-1.5 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          {subiendo ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <CloudOff className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">
            Pendiente de subir: {enFila === 1 ? "1 recepción" : `${enFila} recepciones`}. Se sube sola
            al volver la conexión.
          </span>
          <Button
            variant="outline"
            className="h-9 px-3 text-sm"
            onMouseDown={sinFoco}
            onClick={() => void subirPendientes()}
            disabled={subiendo}
          >
            Subir ahora
          </Button>
        </div>
      )}
      {conError.map((s) => (
        <div
          key={s.sesionId}
          role="alert"
          className="flex items-center gap-2 rounded-md bg-red-600/10 px-3 py-1.5 text-sm text-red-800 dark:text-red-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            No se guardó la recepción de {s.meta.quien} ({s.meta.fecha.slice(11, 16)}): {s.error}
            {" Lo contado sigue en la tablet."}
          </span>
          <Button
            variant="outline"
            className="h-9 shrink-0 px-3 text-sm"
            onMouseDown={sinFoco}
            onClick={() => {
              limpiarError(negocioId, loteId, s.sesionId);
              void subirPendientes();
            }}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Reintentar
          </Button>
          {borrando === s.sesionId ? (
            <Button
              variant="destructive"
              className="h-9 shrink-0 px-3 text-sm"
              onMouseDown={sinFoco}
              onClick={() => {
                descartar(negocioId, loteId, s.sesionId);
                setBorrando(null);
              }}
            >
              Sí, borrar
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="h-9 shrink-0 px-3 text-sm"
              onMouseDown={sinFoco}
              onClick={() => setBorrando(s.sesionId)}
            >
              Borrar de la tablet
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function LoQueFaltaDialogo({
  lote,
  resumen,
  nombre,
  onCerrar,
}: {
  lote: Resurtido;
  resumen: ResumenLote;
  nombre: (clave: string) => string;
  onCerrar: () => void;
}) {
  // Lo marcado "no llegó" también falta: si aparece, se recibe.
  const articulos = [...resumen.porArticulo.entries()]
    .filter(([, c]) => c.pendiente > 0 || c.noLlego > 0)
    .map(([clave, c]) => ({ clave, c }))
    .sort((a, b) => nombre(a.clave).localeCompare(nombre(b.clave), "es"));
  const piezasFaltan = resumen.totales.pendiente + resumen.totales.noLlego;
  const paquetes = [...resumen.paquetes.entries()]
    .filter(([, p]) => p.estado === "pendiente")
    .map(([llave]) => ({ llave, p: lote.paquetes?.[llave] }))
    .filter((x) => !!x.p)
    .sort((a, b) => (a.p!.orden ?? 0) - (b.p!.orden ?? 0));
  const ordenCaja = (llave: string) => lote.cajas?.[llave]?.orden ?? 0;
  const cajasSinLlegar = cajasOrdenadas(lote).filter((c) => !resumen.cajasLlegadas.has(c.llave));

  return (
    <Dialogo titulo="Lo que falta" onCerrar={onCerrar} className="max-w-3xl">
      {articulos.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No falta nada.</p>
      ) : (
        <div className="space-y-4">
          {cajasSinLlegar.length > 0 && (
            <p className="text-sm">
              <b>Cajas sin anotar:</b>{" "}
              {cajasSinLlegar.map((c) => `Caja ${c.caja.orden}`).join(", ")}
            </p>
          )}
          <div>
            <h3 className="mb-1 text-sm font-semibold">Por artículo ({piezasFaltan} pzas)</h3>
            <ul className="divide-y rounded-md border">
              {articulos.map(({ clave, c }) => (
                <li key={clave} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{nombre(clave)}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {Math.min(c.declarado, c.bien + c.danado)} de {c.declarado}
                  </span>
                  <b className="w-24 shrink-0 text-right tabular-nums">
                    {c.pendiente > 0 ? `faltan ${c.pendiente}` : `no llegó ${c.noLlego}`}
                  </b>
                </li>
              ))}
            </ul>
          </div>
          {paquetes.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Paquetes sin escanear ({paquetes.length})</h3>
              <ul className="divide-y rounded-md border">
                {paquetes.map(({ llave, p }) => (
                  <li key={llave} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{textoContenido(p!, nombre)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Caja {ordenCaja(p!.caja)} · {etiquetaLoteLegible(p!.codigo)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialogo>
  );
}

function TerminarDialogo({
  vista,
  conteo,
  byId,
  nombre,
  enTurno,
  manejaBodega,
  onGuardar,
  onCerrar,
}: {
  vista: Resurtido;
  conteo: ConteoLote;
  byId: ReadonlyMap<string, Articulo>;
  nombre: (clave: string) => string;
  enTurno: string;
  /** Sucursal de mayoreo: se elige si entra a la tienda o a su bodega. */
  manejaBodega: boolean;
  onGuardar: (quien: string, nota: string, aBodega: boolean) => void;
  onCerrar: () => void;
}) {
  const [quien, setQuien] = useState(enTurno);
  const [nota, setNota] = useState("");
  const [aBodega, setABodega] = useState(false);
  const [faltaNombre, setFaltaNombre] = useState(false);
  const quienRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => {
      quienRef.current?.focus();
      quienRef.current?.select();
    });
  }, []);

  // Vista previa con el mismo plan que se guardará (con el catálogo de la
  // tablet; el servidor lo vuelve a calcular contra el lote al subir).
  const vistaPrevia = useMemo(() => {
    try {
      const plan = planearRecepcionLote({
        lote: vista,
        conteo,
        articulos: byId,
        // Para la vista previa da igual el lugar: cuenta lo mismo.
        ubicacion: { tipo: "sucursal", sucursalId: vista.sucursalDestinoId, esDefault: false },
        meta: { fecha: fechaISO_MX(), quien: "-" },
      });
      let danadas = sumaPiezas(plan.sesion.danadas);
      for (const llave of plan.sesion.paquetesDanados ?? []) {
        const p = vista.paquetes?.[llave];
        if (p) for (const n of contenidoDePaquete(p).values()) danadas += n;
      }
      return {
        plan,
        entra: sumaPiezas(plan.sesion.entro),
        danadas,
        sobrantes: sumaPiezas(plan.sesion.sobrantes),
        pendiente: resumenLoteConConteo(vista, conteo).totales.pendiente,
      };
    } catch {
      return null;
    }
  }, [vista, conteo, byId]);

  function guardar() {
    if (!quien.trim()) {
      setFaltaNombre(true);
      quienRef.current?.focus();
      return;
    }
    onGuardar(quien, nota, aBodega);
  }

  const s = vistaPrevia?.plan.sesion;
  return (
    <Dialogo
      titulo="Terminar recepción"
      onCerrar={onCerrar}
      conTexto
      pie={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Seguir contando
          </Button>
          <Button className="bg-marca px-6 font-semibold text-white hover:bg-marca/90" onClick={guardar}>
            Guardar recepción
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 text-sm">
          {vistaPrevia?.plan.vacia ? (
            <p className="rounded-md bg-amber-400/20 p-2">
              No hay nada nuevo: todo lo escaneado ya estaba recibido.
            </p>
          ) : (
            <>
              <Fila
                etiqueta={
                  manejaBodega
                    ? aBodega
                      ? "Entra a la bodega"
                      : "Entra a la tienda"
                    : "Entra al inventario"
                }
                valor={pzas(vistaPrevia?.entra ?? 0)}
                fuerte
              />
              {(s?.paquetes?.length ?? 0) + (s?.paquetesDanados?.length ?? 0) > 0 && (
                <Fila
                  etiqueta="Paquetes"
                  valor={String((s?.paquetes?.length ?? 0) + (s?.paquetesDanados?.length ?? 0))}
                />
              )}
              {(vistaPrevia?.danadas ?? 0) > 0 && (
                <Fila etiqueta="Dañado (no entra)" valor={pzas(vistaPrevia!.danadas)} tono="text-red-700" />
              )}
              {(vistaPrevia?.sobrantes ?? 0) > 0 && (
                <Fila
                  etiqueta="Sobrante (no entra)"
                  valor={pzas(vistaPrevia!.sobrantes)}
                  tono="text-orange-700"
                />
              )}
              {(s?.desconocidos?.length ?? 0) > 0 && (
                <Fila etiqueta="Códigos no reconocidos" valor={String(s!.desconocidos!.length)} />
              )}
            </>
          )}
          <Fila
            etiqueta="Queda pendiente"
            valor={(vistaPrevia?.pendiente ?? 0) > 0 ? pzas(vistaPrevia!.pendiente) : "Nada: lote completo"}
            fuerte
          />
          {s?.sinStock?.length ? (
            <div className="rounded-md bg-red-600/10 p-2 text-xs text-red-800 dark:text-red-200">
              <p className="font-semibold">No podrán entrar al inventario:</p>
              <ul>
                {s.sinStock.map((x) => (
                  <li key={x.clave}>
                    {nombre(x.clave)} ({x.piezas}): {x.motivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          {manejaBodega && (
            <div className="space-y-1">
              <Label>¿A dónde entra?</Label>
              <div
                className="grid grid-cols-2 gap-1 rounded-lg border bg-background p-1"
                role="radiogroup"
                aria-label="A dónde entra lo recibido"
              >
                {[false, true].map((valor) => (
                  <button
                    key={String(valor)}
                    type="button"
                    role="radio"
                    aria-checked={aBodega === valor}
                    onClick={() => setABodega(valor)}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-semibold transition",
                      aBodega === valor
                        ? "bg-marca text-white"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {valor ? "Bodega" : "Tienda"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="quien-recibe">Quién recibe *</Label>
            <Input
              id="quien-recibe"
              ref={quienRef}
              value={quien}
              onChange={(e) => {
                setQuien(e.target.value);
                setFaltaNombre(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardar();
                }
              }}
              placeholder="Nombre"
              maxLength={80}
            />
            {faltaNombre && <p className="text-xs text-destructive">Escribe el nombre de quien recibe</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="nota-recepcion">Nota (opcional)</Label>
            <textarea
              id="nota-recepcion"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              placeholder="Ej. la caja 2 venía abierta"
            />
          </div>
        </div>
      </div>
    </Dialogo>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte,
  tono,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  tono?: string;
}) {
  return (
    <p className={cn("flex items-baseline justify-between gap-2", tono)}>
      <span>{etiqueta}</span>
      <span className={cn("tabular-nums", fuerte && "text-base font-bold")}>{valor}</span>
    </p>
  );
}

function VariacionDialogo({
  pide,
  resumen,
  byId,
  nombre,
  onElegir,
  onCerrar,
}: {
  pide: PideVariacion;
  resumen: ResumenLote;
  byId: ReadonlyMap<string, Articulo>;
  nombre: (clave: string) => string;
  onElegir: (articuloId: string, subvariacionCodigo: string) => void;
  onCerrar: () => void;
}) {
  const padre = byId.get(pide.padreId);
  // Solo las variaciones con código: son las únicas que un lote puede traer.
  const subs = (padre?.subvariaciones ?? [])
    .flatMap((s) => (s.codigo ? [{ s, codigo: s.codigo }] : []))
    .map(({ s, codigo }) => ({
      s,
      codigo,
      c: resumen.porArticulo.get(claveArticulo(pide.padreId, codigo)),
    }))
    // Primero las que vienen en el lote.
    .sort((a, b) => (b.c?.declarado ?? 0) - (a.c?.declarado ?? 0));
  return (
    <Dialogo titulo={`${padre?.nombre ?? nombre(pide.padreId)}: ¿cuál variación?`} onCerrar={onCerrar}>
      <p className="mb-2 text-sm text-muted-foreground">
        {pide.cantidad > 1 ? `${pide.cantidad} piezas` : "1 pieza"}
        {pide.danado ? " · dañado" : ""}. Toca la variación o escanea su código.
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {subs.map(({ s, codigo, c }) => (
          <li key={codigo}>
            <button
              type="button"
              onMouseDown={sinFoco}
              onClick={() => onElegir(pide.padreId, codigo)}
              className={cn(
                "flex w-full flex-col items-start rounded-lg border p-3 text-left transition hover:border-marca active:scale-[0.98]",
                (c?.declarado ?? 0) > 0 ? "bg-background" : "bg-muted/50",
              )}
            >
              <span className="text-base font-semibold">{s.nombre}</span>
              <span className="text-xs text-muted-foreground">
                {(c?.declarado ?? 0) > 0
                  ? `Vienen ${c!.declarado} · faltan ${c!.pendiente}`
                  : "No viene en este lote"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialogo>
  );
}

function FotosDialogo({
  negocioId,
  lote,
  puedeCrear,
  acceso,
  setAcceso,
  fotos,
  onCerrar,
}: {
  negocioId: string;
  lote: Resurtido;
  puedeCrear: boolean;
  acceso: AccesoFotos | null;
  setAcceso: (a: AccesoFotos | null) => void;
  fotos: ReactNode;
  onCerrar: () => void;
}) {
  const [creando, setCreando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cerrado, setCerrado] = useState(false);

  async function crear() {
    setCreando(true);
    setError(null);
    setCerrado(false);
    try {
      const r = await crearEnlaceFotos(negocioId, lote.id, lote.sucursalDestinoId);
      setAcceso({ ...r, creadoMs: Date.now() });
    } catch (e) {
      console.error("crearEnlaceFotos:", e);
      setError(
        e instanceof SinConexion
          ? e.message
          : (e as { code?: string })?.code === "permission-denied"
            ? "El servidor no dejó crear el código para este lote."
            : "No se pudo crear el código para fotos.",
      );
    } finally {
      setCreando(false);
    }
  }

  // Al abrir sin acceso, se crea uno (es para lo que se tocó el botón).
  const intentado = useRef(false);
  useEffect(() => {
    if (intentado.current || acceso || !puedeCrear) return;
    intentado.current = true;
    void crear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cerrarAcceso() {
    if (!acceso) return;
    setCerrando(true);
    setError(null);
    try {
      await apagarEnlaceFotos(negocioId, acceso.enlaceId);
      setAcceso(null);
      setCerrado(true);
    } catch (e) {
      console.error("apagarEnlaceFotos:", e);
      setError("No se pudo cerrar el acceso.");
    } finally {
      setCerrando(false);
    }
  }

  // Al acabarse los 5 minutos se vuelve a pintar (aparece "Crear otro código").
  const [, setVencio] = useState(0);
  useEffect(() => {
    if (!acceso) return;
    const resta = acceso.creadoMs + ENLACE_RECIBIR_VENTANA_MS - Date.now();
    if (resta <= 0) return;
    const t = setTimeout(() => setVencio((n) => n + 1), resta + 50);
    return () => clearTimeout(t);
  }, [acceso]);
  const vencido = !!acceso && Date.now() >= acceso.creadoMs + ENLACE_RECIBIR_VENTANA_MS;

  return (
    <Dialogo titulo="Fotos con teléfono" onCerrar={onCerrar} className="max-w-3xl">
      <div className="space-y-4">
        {puedeCrear && (
          <section className="space-y-3">
            {creando ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Creando el código…
              </p>
            ) : acceso ? (
              <QrAccesoFotos acceso={acceso} />
            ) : cerrado ? (
              <p className="text-sm">Acceso cerrado: el teléfono ya no puede subir fotos.</p>
            ) : null}
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              {acceso && (
                <Button
                  variant="destructive"
                  className="h-11"
                  onMouseDown={sinFoco}
                  onClick={() => void cerrarAcceso()}
                  disabled={cerrando}
                >
                  {cerrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cerrar acceso
                </Button>
              )}
              {!creando && (!acceso || vencido) && (
                <Button
                  variant="outline"
                  className="h-11"
                  onMouseDown={sinFoco}
                  onClick={() => void crear()}
                >
                  {acceso || cerrado || error ? "Crear otro código" : "Crear código"}
                </Button>
              )}
            </div>
          </section>
        )}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Fotos del lote</h3>
          {fotos}
        </section>
      </div>
    </Dialogo>
  );
}

/** El lote ya cerrado (solo lectura) o todavía sin enviar. */
function LoteSinRecibir({
  lote,
  nombre,
  fotos,
  hayConteo,
  onBorrarConteo,
}: {
  lote: Resurtido;
  nombre: (clave: string) => string;
  fotos: ReactNode;
  hayConteo: boolean;
  onBorrarConteo: () => void;
}) {
  const [borrar, setBorrar] = useState(false);
  if (lote.estado !== "cerrado") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-center text-muted-foreground">
          Este lote todavía no se envía. Cuando admin confirme el envío lo vas a poder recibir aquí.
        </p>
      </main>
    );
  }
  const r = resumenLote(lote);
  const sesiones = sesionesOrdenadas(lote);
  const conSobrante = [...r.porArticulo.entries()].filter(([, c]) => c.sobrante > 0 || c.danado > 0);
  return (
    <main className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {hayConteo && (
        <div className="flex items-center gap-2 rounded-md bg-amber-400/20 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            En esta tablet quedó algo contado sin guardar, pero el lote ya está cerrado.
          </span>
          {borrar ? (
            <Button variant="destructive" className="h-9 px-3 text-sm" onClick={onBorrarConteo}>
              Sí, borrar
            </Button>
          ) : (
            <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => setBorrar(true)}>
              Borrar lo contado
            </Button>
          )}
        </div>
      )}
      <section className="grid grid-cols-5 gap-2 rounded-xl border bg-card p-3 text-center">
        <Total etiqueta="Venían" n={r.totales.declarado} />
        <Total etiqueta="Entraron" n={r.totales.entro} />
        <Total etiqueta="Dañado" n={r.totales.danado} />
        <Total etiqueta="No llegó" n={r.totales.noLlego} />
        <Total etiqueta="Sobrante" n={r.totales.sobrante} />
      </section>
      <section className="rounded-xl border bg-card p-3">
        <h2 className="mb-2 text-sm font-semibold">
          Recibió {lote.responsableRecibe ?? "—"}
          {lote.fechaCerrado ? ` · cerrado ${lote.fechaCerrado.slice(0, 16)}` : ""}
        </h2>
        <ul className="divide-y text-sm">
          {sesiones.map(({ id, sesion }) => (
            <li key={id} className="py-1.5">
              <p>
                <b>{sesion.tipo === "no_llego" ? "No llegó (admin)" : "Recepción"}</b> ·{" "}
                {sesion.fecha.slice(0, 16)} · {sesion.quien}
                {sesion.tipo === "recepcion" &&
                  ` · entraron ${pzas(sumaPiezas(sesion.entro))}${
                    sesion.destino === "bodega" ? " a la bodega" : ""
                  }`}
                {sesion.tipo === "no_llego" && ` · ${pzas(sumaPiezas(sesion.noLlego))}`}
              </p>
              {sesion.nota && <p className="text-xs text-muted-foreground">{sesion.nota}</p>}
            </li>
          ))}
        </ul>
      </section>
      {conSobrante.length > 0 && (
        <section className="rounded-xl border bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">Dañado y sobrante</h2>
          <ul className="divide-y text-sm">
            {conSobrante.map(([clave, c]) => (
              <li key={clave} className="flex gap-2 py-1">
                <span className="min-w-0 flex-1 truncate">{nombre(clave)}</span>
                {c.danado > 0 && <span className="text-red-700">dañado {c.danado}</span>}
                {c.sobrante > 0 && <span className="text-orange-700">sobrante {c.sobrante}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-xl border bg-card p-3">
        <h2 className="mb-2 text-sm font-semibold">Fotos</h2>
        {fotos}
      </section>
    </main>
  );
}

function Total({ etiqueta, n }: { etiqueta: string; n: number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="text-xl font-bold tabular-nums">{n.toLocaleString("es-MX")}</p>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  History,
  Loader2,
  Package,
  RotateCcw,
  Save,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useFotosLote } from "@/features/lotes/useFotosLote";
import {
  borrarFotoLote,
  borrarLoteArmandose,
  confirmarEnvioLote,
  declararNoLlegoLote,
  guardarEnvioLote,
  regresarLoteAArmado,
} from "@/features/lotes/loteService";
import {
  ETAPA_LOTE_COLOR,
  ETAPA_LOTE_PALABRAS,
  etapaLote,
  fechaCorta,
  piezas,
  type EtapaLote,
} from "@/features/lotes/loteVista";
import {
  LoteConProblemas,
  cajasOrdenadas,
  claveArticulo,
  contenidoDePaquete,
  etiquetaLoteLegible,
  fechaISO_MX,
  infoArticuloLote,
  paquetesDeCaja,
  partirClaveArticulo,
  planearEnvioLote,
  resumenLote,
  sesionesOrdenadas,
  sueltasDeCaja,
  totalesLote,
  validarLote,
  type Articulo,
  type CuentaArticuloLote,
  type LoteCaja,
  type LoteSesion,
  type Resurtido,
  type ResumenLote,
} from "@shared";

type Lote = Resurtido & { cajas: Record<string, LoteCaja> };
type NombreDe = (clave: string) => string;

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** `instanceof` y, por si acaso, la forma: el error cruza la transacción. */
function problemasDe(e: unknown): string[] | null {
  if (e instanceof LoteConProblemas) return e.problemas;
  if (
    e instanceof Error &&
    e.name === "LoteConProblemas" &&
    Array.isArray((e as { problemas?: unknown }).problemas)
  ) {
    return (e as LoteConProblemas).problemas;
  }
  return null;
}

/**
 * Detalle de un lote de envío (un resurtido con cajas → paquetes / sueltas).
 * Lo arma un teléfono; aquí admin lo revisa, confirma el envío, corrige
 * paquetería y guías, ve lo recibido contra lo declarado y cierra lo que no
 * llegó.
 */
export function LoteDetail({ lote: loteGuardado, loteId }: { lote: Lote; loteId: string }) {
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const quien = user?.user.email ?? user?.user.uid ?? "";
  const { articulos, loading: cargandoCatalogo } = useArticulos();
  const { sucursales, loading: cargandoSucursales } = useSucursales();
  // El destino lo escribe el teléfono: el id es donde se suma al recibir, así
  // que el nombre que se muestra es el de ESA sucursal (no el que escribió).
  const lote = useMemo<Lote>(() => {
    if (cargandoSucursales) return loteGuardado;
    const real = sucursales.find((s) => s.sucursalId === loteGuardado.sucursalDestinoId);
    const nombre = real
      ? real.nombre
      : `${loteGuardado.sucursalDestinoNombre || "Sin destino"} (esa sucursal no existe)`;
    return nombre === loteGuardado.sucursalDestinoNombre
      ? loteGuardado
      : { ...loteGuardado, sucursalDestinoNombre: nombre };
  }, [loteGuardado, sucursales, cargandoSucursales]);
  const porId = useMemo(
    () => new Map<string, Articulo>(articulos.map((a) => [a.id, a])),
    [articulos],
  );

  const etapa = etapaLote(lote);
  const yaSalio = etapa === "enviado" || etapa === "parcial" || etapa === "cerrado";
  const resumen = useMemo(() => resumenLote(lote), [lote]);
  const totales = useMemo(() => totalesLote(lote), [lote]);

  // Nombres: el snapshot de `lineas` (se escribe al enviar) y, mientras se
  // arma, el catálogo.
  const snapshots = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lote.lineas ?? []) {
      m.set(claveArticulo(l.articuloId, l.subvariacionCodigo), l.nombreSnapshot);
    }
    return m;
  }, [lote.lineas]);
  const nombreDe = useCallback<NombreDe>(
    (clave) => {
      const snap = snapshots.get(clave);
      if (snap && snap !== partirClaveArticulo(clave).articuloId) return snap;
      const { articuloId, subvariacionCodigo } = partirClaveArticulo(clave);
      return infoArticuloLote(porId.get(articuloId), subvariacionCodigo)?.nombre ?? snap ?? clave;
    },
    [snapshots, porId],
  );

  const folio = lote.folio ?? loteId;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/resurtidos")}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Resurtidos
          </Button>
          <h1 className="truncate text-xl font-semibold">
            Lote <span className="font-mono">{folio}</span>
          </h1>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${ETAPA_LOTE_COLOR[etapa]}`}
        >
          {ETAPA_LOTE_PALABRAS[etapa]}
        </span>
      </div>

      <Encabezado lote={lote} resumen={resumen} totales={totales} yaSalio={yaSalio} />

      {negocioId && (
        <Acciones
          lote={lote}
          loteId={loteId}
          negocioId={negocioId}
          etapa={etapa}
          quien={quien}
          resumen={resumen}
          totalPiezas={totales.piezas}
          porId={porId}
          catalogoListo={!cargandoCatalogo}
          onBorrado={() => navigate("/resurtidos", { replace: true })}
        />
      )}

      <Avisos resumen={resumen} nombreDe={nombreDe} />

      {negocioId && <EnvioCard lote={lote} loteId={loteId} negocioId={negocioId} />}

      <ArbolCard lote={lote} resumen={resumen} yaSalio={yaSalio} nombreDe={nombreDe} />

      <TablaArticulos resumen={resumen} yaSalio={yaSalio} nombreDe={nombreDe} />

      <Historial lote={lote} nombreDe={nombreDe} />

      {negocioId && <FotosCard negocioId={negocioId} loteId={loteId} mostrarVacio={yaSalio} />}
    </div>
  );
}

// ---------- 1. Encabezado ----------

function Encabezado({
  lote,
  resumen,
  totales,
  yaSalio,
}: {
  lote: Lote;
  resumen: ResumenLote;
  totales: ReturnType<typeof totalesLote>;
  yaSalio: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <p className="font-semibold">→ {lote.sucursalDestinoNombre || "Sin destino"}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Dato etiqueta="Armó" valor={lote.responsableEmpaco} />
        <Dato etiqueta="Confirmó el envío" valor={lote.enviadoPor} />
        <Dato etiqueta="Recibió" valor={lote.responsableRecibe} />
        <Dato etiqueta="Cerró" valor={lote.responsableConfirma} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5">
        <Dato etiqueta="Creado" valor={fechaCorta(lote.fechaCreacion)} />
        <Dato etiqueta="Listo" valor={fechaCorta(lote.fechaListo)} />
        <Dato etiqueta="Enviado" valor={fechaCorta(lote.fechaEnTransito)} />
        <Dato etiqueta="Recibido" valor={fechaCorta(lote.fechaRecibido)} />
        <Dato etiqueta="Cerrado" valor={fechaCorta(lote.fechaCerrado)} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cuadro titulo="Cajas" valor={totales.cajas} />
        <Cuadro titulo="Paquetes" valor={totales.paquetes} />
        <Cuadro titulo="Piezas" valor={totales.piezas} />
        <Cuadro titulo="Artículos" valor={totales.articulos} />
      </div>
      {yaSalio && (
        <p className="text-sm">
          Paquetes recibidos:{" "}
          <b>
            {resumen.paquetesRecibidos + resumen.paquetesDanados} de {resumen.paquetesTotal}
          </b>
          {resumen.paquetesDanados > 0 && ` (${resumen.paquetesDanados} dañados)`} · Cajas que
          llegaron: <b>{resumen.cajasLlegadas.size} de {resumen.cajasTotal}</b> · Piezas pendientes:{" "}
          <b>{resumen.totales.pendiente}</b>
        </p>
      )}
      {lote.notas && <p className="rounded-md bg-muted p-2 text-xs">{lote.notas}</p>}
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="truncate text-sm">{valor || "—"}</p>
    </div>
  );
}

function Cuadro({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] text-muted-foreground">{titulo}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

// ---------- 8. Acciones según el estado ----------

function Acciones({
  lote,
  loteId,
  negocioId,
  etapa,
  quien,
  resumen,
  totalPiezas,
  porId,
  catalogoListo,
  onBorrado,
}: {
  lote: Lote;
  loteId: string;
  negocioId: string;
  etapa: EtapaLote;
  quien: string;
  resumen: ResumenLote;
  totalPiezas: number;
  porId: ReadonlyMap<string, Articulo>;
  catalogoListo: boolean;
  onBorrado: () => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<string[] | null>(null);
  const [nota, setNota] = useState("");

  // Al cambiar de etapa (otro admin, el teléfono) lo de antes ya no aplica.
  useEffect(() => {
    setError(null);
    setProblemas(null);
  }, [etapa]);

  // Revisión previa: el armado (lo mismo que se revisa al confirmar) y, con
  // el catálogo de ahora, si alcanza el taller. La de verdad va en la
  // transacción.
  const previo = useMemo(() => {
    if (etapa !== "listo") return null;
    const armado = validarLote(lote);
    if (armado.length > 0) return { bloquea: true, problemas: armado };
    if (!catalogoListo) return null;
    try {
      planearEnvioLote(lote, porId);
      return { bloquea: false, problemas: [] as string[] };
    } catch (e) {
      return { bloquea: false, problemas: problemasDe(e) ?? [mensaje(e)] };
    }
  }, [etapa, lote, porId, catalogoListo]);

  async function correr(fn: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    setProblemas(null);
    try {
      await fn();
    } catch (e) {
      const lista = problemasDe(e);
      if (lista) setProblemas(lista);
      else setError(mensaje(e));
    } finally {
      setTrabajando(false);
    }
  }

  function confirmar() {
    if (
      !confirm(
        `¿Confirmar el envío del lote ${lote.folio ?? loteId} a ${lote.sucursalDestinoNombre}?\n\nSe bajan ${piezas(totalPiezas)} del taller.`,
      )
    ) {
      return;
    }
    void correr(() => confirmarEnvioLote(negocioId, loteId, quien));
  }

  function regresar() {
    if (!confirm("¿Regresar el lote a armado? Desde el teléfono lo podrán cambiar otra vez.")) return;
    void correr(() => regresarLoteAArmado(negocioId, loteId));
  }

  function borrar() {
    if (
      !confirm(
        `¿Borrar el lote ${lote.folio ?? loteId}? Sus etiquetas quedan libres para otro lote. No se puede deshacer.`,
      )
    ) {
      return;
    }
    void correr(async () => {
      await borrarLoteArmandose(negocioId, loteId);
      onBorrado();
    });
  }

  function noLlego() {
    if (!nota.trim()) {
      setError("Escribe una nota: qué pasó con lo que falta");
      return;
    }
    if (
      !confirm(
        `¿Marcar ${piezas(resumen.totales.pendiente)} como no llegadas?\n\nEl lote se cierra. Si después aparecen (o la caja las contó sin internet), la sucursal todavía las puede recibir y entran a su inventario.`,
      )
    ) {
      return;
    }
    void correr(async () => {
      await declararNoLlegoLote(negocioId, loteId, quien, nota);
      setNota("");
    });
  }

  const avisos = (
    <>
      {problemas && problemas.length > 0 && (
        <ListaProblemas titulo="No se pudo enviar:" problemas={problemas} tono="error" />
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </>
  );

  if (etapa === "armando") {
    return (
      <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">
          Lo están armando desde el teléfono. Cuando terminen va a decir «Listo para enviar».
        </p>
        {avisos}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={borrar}
            disabled={trabajando}
          >
            {trabajando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Borrar lote
          </Button>
        </div>
      </section>
    );
  }

  if (etapa === "listo") {
    return (
      <section className="space-y-3 rounded-lg border border-violet-500/40 bg-card p-4 sm:p-5">
        <h3 className="text-base font-semibold">Confirmar el envío</h3>
        <p className="text-sm text-muted-foreground">
          Al confirmar se bajan {piezas(totalPiezas)} del taller y el lote queda en camino a{" "}
          {lote.sucursalDestinoNombre}. Revisa las cajas y lo que lleva antes de confirmar.
        </p>
        {previo === null && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Revisando el inventario…
          </p>
        )}
        {previo && previo.problemas.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Todo en orden: hay piezas en el taller para todo el lote.
          </p>
        )}
        {previo && previo.problemas.length > 0 && (
          <ListaProblemas
            titulo={
              previo.bloquea
                ? "El lote está mal armado. Regrésalo a armado para que lo corrijan:"
                : "Con el inventario de ahora no se podría enviar:"
            }
            problemas={previo.problemas}
            tono="aviso"
          />
        )}
        {avisos}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={regresar} disabled={trabajando}>
            <RotateCcw className="mr-2 h-4 w-4" /> Regresar a armado
          </Button>
          <Button
            type="button"
            onClick={confirmar}
            disabled={trabajando || !quien || previo?.bloquea === true}
          >
            {trabajando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Truck className="mr-2 h-4 w-4" />
            )}
            Confirmar envío
          </Button>
        </div>
      </section>
    );
  }

  if ((etapa === "enviado" || etapa === "parcial") && resumen.totales.pendiente > 0) {
    return (
      <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
        <h3 className="text-base font-semibold">Lo que falta</h3>
        <p className="text-sm text-muted-foreground">
          Faltan <b className="text-foreground">{piezas(resumen.totales.pendiente)}</b> por llegar. Si
          ya no van a llegar, márcalas como no llegadas: el lote se cierra. Si después aparecen, la
          sucursal todavía las puede recibir.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="nota-no-llego">Nota (obligatoria)</Label>
          <Textarea
            id="nota-no-llego"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej. la paquetería perdió la caja 3"
            maxLength={300}
            className="min-h-[60px]"
          />
        </div>
        {avisos}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            onClick={noLlego}
            disabled={trabajando || !quien}
          >
            {trabajando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Marcar lo pendiente como no llegó
          </Button>
        </div>
      </section>
    );
  }

  if (etapa === "cerrado") {
    return (
      <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
        Lote cerrado{lote.fechaCerrado ? ` el ${fechaCorta(lote.fechaCerrado)}` : ""}.
        {resumen.totales.noLlego > 0 && ` ${piezas(resumen.totales.noLlego)} no llegaron.`}
      </div>
    );
  }
  return avisos;
}

function ListaProblemas({
  titulo,
  problemas,
  tono,
}: {
  titulo: string;
  problemas: string[];
  tono: "error" | "aviso";
}) {
  const clases =
    tono === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  return (
    <div role="alert" className={`space-y-1 rounded-md border p-3 text-sm ${clases}`}>
      <p className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-4 w-4" /> {titulo}
      </p>
      <ul className="list-disc space-y-0.5 pl-6">
        {problemas.map((p, i) => (
          <li key={`${i}-${p}`}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 5. Avisos de la recepción ----------

function Avisos({ resumen, nombreDe }: { resumen: ResumenLote; nombreDe: NombreDe }) {
  const sobrantes = [...resumen.porArticulo.entries()].filter(([, c]) => c.sobrante > 0);
  if (sobrantes.length === 0 && resumen.desconocidos.length === 0 && resumen.sinStock.length === 0) {
    return null;
  }
  return (
    <section className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
      {sobrantes.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" /> Llegaron piezas de más (o de artículos que no venían):
          </p>
          <ul className="list-disc pl-6">
            {sobrantes.map(([clave, c]) => (
              <li key={clave}>
                {c.sobrante} × {nombreDe(clave)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {resumen.sinStock.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" /> Recibido sin entrar al inventario (hay que darlo de
            alta a mano en la sucursal):
          </p>
          <ul className="list-disc pl-6">
            {resumen.sinStock.map((s, i) => (
              <li key={`${s.sesion}-${s.clave}-${i}`}>
                {s.piezas} × {nombreDe(s.clave)} — {s.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
      {resumen.desconocidos.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" /> Al recibir se escanearon códigos que no se reconocieron:
          </p>
          <p className="break-all pl-6 font-mono text-xs">{resumen.desconocidos.join(", ")}</p>
        </div>
      )}
    </section>
  );
}

// ---------- 2. Paquetería y guías ----------

function EnvioCard({ lote, loteId, negocioId }: { lote: Lote; loteId: string; negocioId: string }) {
  const cajas = useMemo(() => cajasOrdenadas(lote), [lote]);
  const original = useMemo(
    () => ({
      paqueteria: lote.paqueteria ?? "",
      guias: Object.fromEntries(cajas.map(({ llave }) => [llave, lote.guias?.[llave] ?? ""])),
    }),
    [lote.paqueteria, lote.guias, cajas],
  );
  const [form, setForm] = useState(original);
  const [editado, setEditado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Mientras no se edite, sigue a lo que hay en Firestore (el teléfono
  // también escribe la paquetería al armar).
  useEffect(() => {
    if (!editado) setForm(original);
  }, [original, editado]);

  function cambiar(campo: (f: typeof form) => typeof form) {
    setForm(campo);
    setEditado(true);
    setAviso(null);
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    try {
      await guardarEnvioLote(negocioId, loteId, form);
      setEditado(false);
      setAviso({ ok: true, texto: "Guardado" });
    } catch (e) {
      setAviso({ ok: false, texto: mensaje(e) });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Truck className="h-4 w-4 text-muted-foreground" /> Paquetería y guías
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="paqueteria">Paquetería</Label>
        <Input
          id="paqueteria"
          value={form.paqueteria}
          onChange={(e) => cambiar((f) => ({ ...f, paqueteria: e.target.value }))}
          placeholder="Ej. Estafeta"
          maxLength={80}
        />
      </div>
      {cajas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {cajas.map(({ llave, caja }) => (
            <div key={llave} className="space-y-1.5">
              <Label htmlFor={`guia-${llave}`}>
                Guía de la caja {caja.orden}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {etiquetaLoteLegible(caja.codigo)}
                </span>
              </Label>
              <Input
                id={`guia-${llave}`}
                value={form.guias[llave] ?? ""}
                onChange={(e) =>
                  cambiar((f) => ({ ...f, guias: { ...f.guias, [llave]: e.target.value } }))
                }
                placeholder="Número de guía"
                maxLength={80}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        {aviso && (
          <span className={`text-sm ${aviso.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
            {aviso.texto}
          </span>
        )}
        {editado && (
          <Button type="button" variant="ghost" onClick={() => setEditado(false)} disabled={guardando}>
            Deshacer
          </Button>
        )}
        <Button type="button" onClick={guardar} disabled={guardando || !editado}>
          {guardando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar
        </Button>
      </div>
    </section>
  );
}

// ---------- 3. Cajas → paquetes / sueltas ----------

function cuandoSesion(lote: Lote, sesionId: string | undefined, hora: string | undefined) {
  const fecha = sesionId ? lote.recepcion?.sesiones?.[sesionId]?.fecha : undefined;
  if (fecha && hora) return `${fecha.slice(0, 10)} ${hora.slice(0, 5)}`;
  return fechaCorta(fecha) ?? hora?.slice(0, 5) ?? "";
}

function ArbolCard({
  lote,
  resumen,
  yaSalio,
  nombreDe,
}: {
  lote: Lote;
  resumen: ResumenLote;
  yaSalio: boolean;
  nombreDe: NombreDe;
}) {
  const cajas = cajasOrdenadas(lote);
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="text-base font-semibold">Cajas ({cajas.length})</h3>
      {cajas.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no tiene cajas.</p>
      )}
      {cajas.map(({ llave, caja }) => {
        const llego = resumen.cajasLlegadas.get(llave);
        const paquetes = paquetesDeCaja(lote, llave);
        const sueltas = sueltasDeCaja(lote, llave);
        const guia = lote.guias?.[llave];
        return (
          <div key={llave} className="overflow-hidden rounded-md border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
              <div>
                <p className="font-medium">
                  Caja {caja.orden} de {cajas.length}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {etiquetaLoteLegible(caja.codigo)}
                  {guia ? ` · Guía ${guia}` : ""}
                </p>
              </div>
              {yaSalio &&
                (llego ? (
                  <Chip tono="bien">Llegó {cuandoSesion(lote, llego.sesion, llego.hora)}</Chip>
                ) : (
                  <Chip tono="pendiente">Sin llegar</Chip>
                ))}
            </div>
            <ul className="divide-y text-sm">
              {paquetes.map(({ llave: lp, paquete }) => {
                const est = resumen.paquetes.get(lp);
                const contenido = [...contenidoDePaquete(paquete)]
                  .map(([clave, n]) => `${n} × ${nombreDe(clave)}`)
                  .join(", ");
                return (
                  <li key={lp} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        Paquete {etiquetaLoteLegible(paquete.codigo)}
                      </p>
                      <p>{contenido || "Vacío"}</p>
                    </div>
                    {yaSalio && est && (
                      <Chip tono={est.estado === "recibido" ? "bien" : est.estado === "danado" ? "mal" : "pendiente"}>
                        {est.estado === "recibido"
                          ? `Recibido ${cuandoSesion(lote, est.sesion, est.hora)}`
                          : est.estado === "danado"
                            ? `Dañado ${cuandoSesion(lote, est.sesion, est.hora)}`
                            : "Pendiente"}
                      </Chip>
                    )}
                  </li>
                );
              })}
              {sueltas.map(({ llave: ls, suelta }) => (
                <li key={ls} className="px-3 py-2">
                  <p className="text-xs text-muted-foreground">Sueltas</p>
                  <p>
                    {suelta.piezas} × {nombreDe(claveArticulo(suelta.articuloId, suelta.subvariacionCodigo))}
                  </p>
                </li>
              ))}
              {paquetes.length === 0 && sueltas.length === 0 && (
                <li className="px-3 py-2 text-muted-foreground">Caja vacía</li>
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Chip({ tono, children }: { tono: "bien" | "mal" | "pendiente"; children: React.ReactNode }) {
  const clases =
    tono === "bien"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : tono === "mal"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${clases}`}>
      {children}
    </span>
  );
}

// ---------- 4. Por artículo ----------

const COLUMNAS: Array<{ campo: keyof CuentaArticuloLote; titulo: string; color?: string }> = [
  { campo: "declarado", titulo: "Declarado" },
  { campo: "bien", titulo: "Bien" },
  { campo: "danado", titulo: "Dañado", color: "text-amber-700 dark:text-amber-400" },
  { campo: "noLlego", titulo: "No llegó", color: "text-destructive" },
  { campo: "pendiente", titulo: "Pendiente", color: "text-blue-700 dark:text-blue-400" },
  { campo: "sobrante", titulo: "Sobrante", color: "text-destructive" },
  { campo: "entro", titulo: "Entró", color: "text-emerald-700 dark:text-emerald-400" },
];

function TablaArticulos({
  resumen,
  yaSalio,
  nombreDe,
}: {
  resumen: ResumenLote;
  yaSalio: boolean;
  nombreDe: NombreDe;
}) {
  const filas = [...resumen.porArticulo.entries()]
    .map(([clave, c]) => ({ clave, nombre: nombreDe(clave), c }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  // Antes de enviar solo importa lo declarado.
  const columnas = yaSalio ? COLUMNAS : COLUMNAS.slice(0, 1);
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="text-base font-semibold">Por artículo ({filas.length})</h3>
      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no lleva artículos.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className={`w-full text-sm ${yaSalio ? "min-w-[720px]" : ""}`}>
            <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Artículo</th>
                {columnas.map((col) => (
                  <th key={col.campo} className="p-2 text-center">
                    {col.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ clave, nombre, c }) => (
                <tr key={clave} className="border-b last:border-b-0">
                  <td className="p-2">
                    <p className="font-medium">{nombre}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {partirClaveArticulo(clave).subvariacionCodigo ?? partirClaveArticulo(clave).articuloId}
                    </p>
                  </td>
                  {columnas.map((col) => (
                    <td
                      key={col.campo}
                      className={`p-2 text-center tabular-nums ${c[col.campo] > 0 && col.color ? `font-semibold ${col.color}` : ""}`}
                    >
                      {c[col.campo] || (col.campo === "declarado" ? 0 : "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/20 font-semibold">
              <tr>
                <td className="p-2">Total</td>
                {columnas.map((col) => (
                  <td key={col.campo} className="p-2 text-center tabular-nums">
                    {resumen.totales[col.campo]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- 6. Historial ----------

type EventoLote = { clave: string; fecha: string; orden: number; titulo: string; detalle: string[] };

function sumaMapa(m: Record<string, number> | undefined): number {
  let t = 0;
  for (const n of Object.values(m ?? {})) t += Number(n) || 0;
  return t;
}

function detalleSesion(lote: Lote, s: LoteSesion, nombreDe: NombreDe): string[] {
  const d: string[] = [];
  if (s.tipo === "no_llego") {
    d.push(`Por ${s.quien}`);
    const partes = Object.entries(s.noLlego ?? {}).map(([clave, n]) => `${n} × ${nombreDe(clave)}`);
    d.push(`${piezas(sumaMapa(s.noLlego))}: ${partes.join(", ")}`);
    if (s.nota) d.push(`Nota: ${s.nota}`);
    return d;
  }
  d.push(`Recibió ${s.quien}${s.vendedor ? ` · en caja: ${s.vendedor}` : ""}`);
  const cuentas: string[] = [];
  if (s.cajas?.length) cuentas.push(`${s.cajas.length} ${s.cajas.length === 1 ? "caja" : "cajas"}`);
  if (s.paquetes?.length) cuentas.push(`${s.paquetes.length} paquetes`);
  if (s.paquetesDanados?.length) cuentas.push(`${s.paquetesDanados.length} paquetes dañados`);
  const contadas = sumaMapa(s.piezas);
  if (contadas > 0) cuentas.push(`${piezas(contadas)} contadas una por una`);
  const danadas = sumaMapa(s.danadas);
  if (danadas > 0) cuentas.push(`${danadas} dañadas`);
  if (cuentas.length > 0) d.push(cuentas.join(" · "));
  // Lo que se escaneó como paquete cerrado vale su contenido declarado.
  let enPaquetes = 0;
  for (const llave of s.paquetes ?? []) {
    const p = lote.paquetes?.[llave];
    if (p) for (const n of contenidoDePaquete(p).values()) enPaquetes += n;
  }
  const resumenPiezas = [`entraron ${sumaMapa(s.entro)} al inventario`];
  if (enPaquetes > 0) resumenPiezas.unshift(`${piezas(enPaquetes)} en paquetes`);
  const sobrantes = sumaMapa(s.sobrantes);
  if (sobrantes > 0) resumenPiezas.push(`${sobrantes} de más`);
  d.push(resumenPiezas.join(" · "));
  if (s.sinStock?.length) d.push(`${s.sinStock.length} renglón(es) sin entrar al inventario`);
  if (s.desconocidos?.length) d.push(`${s.desconocidos.length} código(s) no reconocidos`);
  if (s.nota) d.push(`Nota: ${s.nota}`);
  return d;
}

function Historial({ lote, nombreDe }: { lote: Lote; nombreDe: NombreDe }) {
  const eventos = useMemo(() => {
    const ev: EventoLote[] = [];
    let orden = 0;
    const agregar = (clave: string, fecha: string | undefined, titulo: string, detalle: string[] = []) => {
      if (fecha) ev.push({ clave, fecha, orden: orden++, titulo, detalle });
    };
    agregar("creado", lote.fechaCreacion, "Se creó el lote", [
      lote.responsableEmpaco ? `Arma: ${lote.responsableEmpaco}` : "",
    ]);
    agregar("listo", lote.fechaListo, "Lo marcaron como listo para enviar");
    agregar("enviado", lote.fechaEnTransito, "Se confirmó el envío", [
      lote.enviadoPor ? `Por ${lote.enviadoPor}` : "",
      lote.paqueteria ? `Paquetería: ${lote.paqueteria}` : "",
    ]);
    for (const { id, sesion } of sesionesOrdenadas(lote)) {
      agregar(
        `s-${id}`,
        sesion.fecha,
        sesion.tipo === "no_llego" ? "Se declaró lo que no llegó" : "Recepción en la sucursal",
        detalleSesion(lote, sesion, nombreDe),
      );
    }
    agregar("cerrado", lote.fechaCerrado, "Lote cerrado");
    return ev
      .map((e) => ({ ...e, detalle: e.detalle.filter(Boolean) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);
  }, [lote, nombreDe]);

  return (
    <section className="rounded-lg border bg-card">
      <h3 className="flex items-center gap-2 border-b px-4 py-2 text-base font-semibold">
        <History className="h-4 w-4 text-muted-foreground" /> Historial
      </h3>
      <ol className="divide-y">
        {eventos.map((e) => (
          <li key={e.clave} className="flex items-start gap-3 px-4 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.titulo}</p>
              {e.detalle.map((t, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {t}
                </p>
              ))}
            </div>
            <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
              {fechaCorta(e.fecha)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- 7. Fotos ----------

function FotosCard({
  negocioId,
  loteId,
  mostrarVacio,
}: {
  negocioId: string;
  loteId: string;
  mostrarVacio: boolean;
}) {
  const { fotos, loading } = useFotosLote(loteId);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!mostrarVacio && fotos.length === 0) return null;

  async function borrar(fotoId: string, ruta: string) {
    if (!confirm("¿Borrar esta foto? No se puede deshacer.")) return;
    setBorrando(fotoId);
    setError(null);
    try {
      await borrarFotoLote(negocioId, loteId, fotoId, ruta);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setBorrando(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Camera className="h-4 w-4 text-muted-foreground" /> Fotos ({fotos.length})
      </h3>
      {loading && fotos.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}
      {!loading && fotos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin fotos. Las toman en la sucursal al recibir, desde la caja.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((f) => (
            <figure key={f.id} className="space-y-1">
              <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                {f.url ? (
                  <button
                    type="button"
                    className="h-full w-full"
                    onClick={() => setAbierta(f.url ?? null)}
                    aria-label="Ver foto"
                  >
                    <img src={f.url} alt={f.nota ?? "Foto del lote"} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {f.url === null ? "No se pudo cargar" : <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => borrar(f.id, f.ruta)}
                  disabled={borrando === f.id}
                  className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive shadow hover:bg-background disabled:opacity-50"
                  aria-label="Borrar foto"
                >
                  {borrando === f.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
              <figcaption className="text-xs">
                {f.nota && <p>{f.nota}</p>}
                <p className="text-muted-foreground">
                  {f.creadoMs !== null ? fechaCorta(fechaISO_MX(new Date(f.creadoMs))) : "Subiendo…"}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <ImageLightbox src={abierta} onClose={() => setAbierta(null)} alt="Foto del lote" />
    </section>
  );
}

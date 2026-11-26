import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  History,
  Loader2,
  RefreshCw,
  ScanLine,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { useEnLinea } from "@/hooks/useEnLinea";
import { BarcodeScanner } from "@/features/ingreso-mercancia/BarcodeScanner";
import {
  useResolverCodigo,
  type ResolveResult,
} from "@/features/ingreso-mercancia/useResolverCodigo";
import { useExistencias } from "@/features/existencias/useExistencias";
import {
  aclararEnvio,
  borrarPendiente,
  clasificarFallo,
  guardarPendiente,
  leerPendiente,
  moverExistencias,
  nuevoMovimientoId,
  type DuenoEnvio,
  type EnvioMover,
  type RespuestaMover,
} from "@/features/existencias/existenciasService";
import {
  articulosTexto,
  claveFinal,
  piezasTexto,
  problemaDeLinea,
  sumarPieza,
  totalPiezas,
  type LineaMover,
} from "@/features/existencias/filasExistencias";
import {
  ElegirDireccion,
  LineasEditables,
  ResultadoMovimiento,
  ResumenEnvio,
} from "./MoverPartes";
import { nombreArticuloFinal, type DireccionMovimientoExistencias } from "@shared";

/** Límite de la function `moverExistencias`. */
const MAX_LINEAS = 100;

/** Cada cuánto se vuelve a preguntar por un envío en duda si no hay respuesta. */
const REPREGUNTAR_MS = 8000;

/**
 * - editar: se arma la lista.
 * - confirmar: resumen antes de mandar.
 * - enviando / duda: la lista ya se mandó y no se puede cambiar. En duda (se
 *   cortó la conexión y no se sabe si se aplicó) la página le pregunta sola
 *   a la function: o el movimiento ya quedó (se muestra), o ese envío queda
 *   anulado para siempre y entonces sí se suelta la lista.
 * - listo: cómo quedaron bodega y tienda.
 */
type Etapa =
  | { tipo: "editar" }
  | { tipo: "confirmar" }
  | { tipo: "enviando"; envio: EnvioMover }
  | { tipo: "duda"; envio: EnvioMover; mensaje: string }
  | { tipo: "listo"; respuesta: RespuestaMover };

type Aviso = { tipo: "ok" | "err"; texto: string };

type RazonCodigo = Extract<ResolveResult, { ok: false }>["razon"];

const MENSAJE_CODIGO: Record<RazonCodigo, (codigo: string) => string> = {
  "no-encontrado": (c) => `Código no encontrado: ${c}`,
  "padre-con-variaciones": () =>
    "Este artículo tiene variaciones: escanea la etiqueta de la variación.",
  "subvariacion-no-encontrada": () => "Esa variación ya no existe.",
};

const MENSAJE_SIN_RESPUESTA =
  "Se cortó la conexión y no sabemos si se movió. Lo estamos revisando.";
const MENSAJE_PENDIENTE =
  "Un movimiento quedó sin respuesta y no sabemos si se movió. Lo estamos revisando.";
const MENSAJE_OTRA_PESTANA =
  "Antes de mandar este hay que saber qué pasó con un movimiento que quedó sin respuesta (se mandó desde otra pestaña). Lo estamos revisando.";
const MENSAJE_NO_SE_MOVIO =
  "Ya lo revisamos: ese movimiento no se aplicó. No se movió nada. Si todavía hace falta, vuelve a mandarlo.";

/** El motivo de un rechazo, sin el «No se movió nada» que a veces ya trae
 *  el mensaje del servidor (aquí se dice aparte) y con punto final. */
function soloMotivo(mensaje: string): string {
  const m = mensaje.replace(/^no se movió nada[.:]?\s*/i, "").trim();
  if (!m) return "";
  return /[.!?]$/.test(m) ? m : `${m}.`;
}

/**
 * Mover piezas entre la bodega y la tienda de esta sucursal. Se escanea
 * (una pieza por escaneo), se confirma y lo mueve la function
 * `moverExistencias`: todo o nada, y nunca dos veces el mismo envío.
 */
export function MoverPage() {
  const navigate = useNavigate();
  const { binding, auth } = useSession();
  const { resolver } = useResolverCodigo();
  const { porClave, sucursal, cargando } = useExistencias();
  const enLinea = useEnLinea();
  const negocioId = binding?.negocioId;
  const sucursalId = binding?.sucursalId;
  const usuarioId = auth?.usuarioId;
  const dueno: DuenoEnvio | null =
    negocioId && sucursalId && usuarioId ? { negocioId, sucursalId, usuarioId } : null;

  // Un envío que quedó sin aclarar (aunque se haya salido de la página)
  // regresa bloqueado hasta saber en qué quedó.
  const [pendiente] = useState(() => (dueno ? leerPendiente(dueno) : null));
  // El envío en duda lo dejó OTRA pestaña: la lista de esta no es la suya y
  // se conserva para seguir cuando aquel se aclare.
  const [deOtraPestana, setDeOtraPestana] = useState(false);
  const [direccion, setDireccion] = useState<DireccionMovimientoExistencias | null>(
    pendiente?.direccion ?? null,
  );
  const [lineas, setLineas] = useState<LineaMover[]>(pendiente?.lineas ?? []);
  const [etapa, setEtapa] = useState<Etapa>(
    pendiente
      ? { tipo: "duda", envio: pendiente, mensaje: MENSAJE_PENDIENTE }
      : { tipo: "editar" },
  );
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [manual, setManual] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const manualRef = useRef<HTMLInputElement>(null);
  // Aclarar un envío en duda: cada cambio de `vuelta` vuelve a preguntar.
  const [vuelta, setVuelta] = useState(0);
  const [preguntando, setPreguntando] = useState(false);
  // No se pudo ni preguntar (p. ej. la sesión venció): qué hacer.
  const [sinPoderPreguntar, setSinPoderPreguntar] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // En duda: se le pregunta SOLA a la function (al entrar, al volver el
  // internet y cada pocos segundos mientras no conteste). Su respuesta es
  // definitiva: el movimiento ya quedó, o ese envío quedó anulado.
  const dudaId = etapa.tipo === "duda" ? etapa.envio.movimientoId : null;
  useEffect(() => {
    if (!dudaId || !negocioId || !sucursalId || !usuarioId || !enLinea) return;
    const quien: DuenoEnvio = { negocioId, sucursalId, usuarioId };
    let vivo = true;
    let otraVez: number | undefined;
    const soltar = () => {
      // Prueba de que no se movió nada: la lista se puede corregir y el
      // próximo envío lleva otro id.
      borrarPendiente(quien, dudaId);
      setRechazo(MENSAJE_NO_SE_MOVIO);
      setDeOtraPestana(false);
      setEtapa({ tipo: "editar" });
    };
    setPreguntando(true);
    setSinPoderPreguntar(null);
    aclararEnvio(dudaId).then(
      (r) => {
        if (!vivo) return;
        setPreguntando(false);
        if (r.tipo === "anulado") {
          soltar();
          return;
        }
        borrarPendiente(quien, dudaId);
        setEtapa({ tipo: "listo", respuesta: r.respuesta });
      },
      (e) => {
        if (!vivo) return;
        setPreguntando(false);
        const fallo = clasificarFallo(e);
        if (fallo.idAjeno) {
          // Ese id es del movimiento de otra persona: el nuestro nunca entró.
          soltar();
        } else if (fallo.contesto) {
          // No dejó ni preguntar: se dice qué hacer y se espera a la persona.
          setSinPoderPreguntar(soloMotivo(fallo.mensaje));
        } else {
          // Sigue sin conexión de verdad: se vuelve a preguntar en un momento.
          otraVez = window.setTimeout(() => setVuelta((n) => n + 1), REPREGUNTAR_MS);
        }
      },
    );
    return () => {
      vivo = false;
      setPreguntando(false);
      if (otraVez !== undefined) window.clearTimeout(otraVez);
    };
  }, [dudaId, enLinea, vuelta, negocioId, sucursalId, usuarioId]);

  const manejaBodega = sucursal?.modoMayoreo === true;
  const puedeEscanear = etapa.tipo === "editar" && !!direccion && manejaBodega && !cargando;
  const total = totalPiezas(lineas);
  const puedeConfirmar =
    !!direccion &&
    lineas.length > 0 &&
    manejaBodega &&
    enLinea &&
    lineas.every((l) => problemaDeLinea(l, porClave.get(l.clave), direccion) === null);
  // Lo que se ve sin poder cambiarlo: lo que se va a mandar o lo ya mandado.
  const resumen: Pick<EnvioMover, "direccion" | "lineas"> | null =
    etapa.tipo === "confirmar"
      ? direccion && { direccion, lineas }
      : etapa.tipo === "enviando" || etapa.tipo === "duda"
        ? etapa.envio
        : null;

  function manejarCodigo(codigo: string) {
    if (!puedeEscanear) return;
    const r = resolver(codigo);
    if (!r.ok) {
      setAviso({ tipo: "err", texto: MENSAJE_CODIGO[r.razon](r.codigo) });
      return;
    }
    const fila = porClave.get(claveFinal(r.articulo.id, r.subvariacion?.codigo));
    if (!fila) {
      setAviso({
        tipo: "err",
        texto: `«${nombreArticuloFinal(r.articulo, r.subvariacion)}» no se maneja en esta sucursal`,
      });
      return;
    }
    const enLista = lineas.find((l) => l.clave === fila.clave);
    if (!enLista && lineas.length >= MAX_LINEAS) {
      setAviso({ tipo: "err", texto: `Máximo ${MAX_LINEAS} artículos por movimiento` });
      return;
    }
    setLineas((prev) => sumarPieza(prev, fila));
    setRechazo(null);
    setAviso({ tipo: "ok", texto: `+1 ${fila.nombre} (${(enLista?.piezas ?? 0) + 1})` });
  }

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const c = manual.trim();
    if (!c) return;
    setManual("");
    manejarCodigo(c);
  }

  function elegirDireccion(d: DireccionMovimientoExistencias) {
    setDireccion(d);
    setRechazo(null);
    // Listo para el lector USB, que escribe donde esté el cursor.
    window.setTimeout(() => manualRef.current?.focus(), 50);
  }

  function cambiarPiezas(clave: string, piezas: number) {
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, piezas } : l)));
    setRechazo(null);
  }

  function quitar(clave: string) {
    setLineas((prev) => prev.filter((l) => l.clave !== clave));
    setRechazo(null);
  }

  /** Otra pestaña dejó un envío sin aclarar: primero se aclara ese. Mandar
   *  otro lo pisaría y ya nadie sabría si aquel se movió. */
  function aclararElDeOtraPestana(previo: EnvioMover) {
    setDeOtraPestana(true);
    setEtapa({ tipo: "duda", envio: previo, mensaje: MENSAJE_OTRA_PESTANA });
  }

  /** Manda un envío NUEVO (cada envío sale una sola vez con su id). */
  async function enviar(envio: EnvioMover) {
    if (!dueno) return;
    // Se guarda ANTES de llamar: si la página se cierra a medio envío, al
    // volver queda bloqueado hasta aclararlo.
    if (!guardarPendiente(dueno, envio)) {
      const previo = leerPendiente(dueno);
      if (previo) aclararElDeOtraPestana(previo);
      return;
    }
    setRechazo(null);
    setEtapa({ tipo: "enviando", envio });
    try {
      const respuesta = await moverExistencias(envio);
      borrarPendiente(dueno, envio.movimientoId);
      setEtapa({ tipo: "listo", respuesta });
    } catch (e) {
      const fallo = clasificarFallo(e);
      if (!fallo.contesto) {
        // Se cortó: no se sabe si se aplicó. La página lo pregunta sola.
        setEtapa({ tipo: "duda", envio, mensaje: MENSAJE_SIN_RESPUESTA });
        return;
      }
      // La function contestó que no (y ese id es nuevo: no hay intento
      // anterior): no se movió nada. Se corrige la lista y el próximo envío
      // lleva otro id.
      borrarPendiente(dueno, envio.movimientoId);
      setRechazo(`No se movió nada. ${soloMotivo(fallo.mensaje)}`);
      setEtapa({ tipo: "editar" });
    }
  }

  function mover() {
    if (!direccion || !puedeConfirmar || !dueno) return;
    const previo = leerPendiente(dueno);
    if (previo) {
      aclararElDeOtraPestana(previo);
      return;
    }
    void enviar({ movimientoId: nuevoMovimientoId(), direccion, lineas });
  }

  function otroMovimiento() {
    // Lo que se movió era de otra pestaña: la lista de esta sigue pendiente.
    if (!deOtraPestana) setLineas([]);
    setDeOtraPestana(false);
    setRechazo(null);
    setEtapa({ tipo: "editar" });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          aria-label="Volver"
          className="-ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-base font-semibold">Mover piezas</h1>
        {etapa.tipo === "editar" && (
          <Button
            size="sm"
            onClick={() => setScannerOpen(true)}
            disabled={!puedeEscanear}
            className="shrink-0"
          >
            <ScanLine className="mr-1 h-4 w-4" /> Escanear
          </Button>
        )}
      </header>

      <main className="flex-1 space-y-3 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3">
        {!enLinea && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            Sin internet: para mover piezas necesitas conexión.
          </p>
        )}
        {!cargando && !manejaBodega && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Esta sucursal no maneja bodega y tienda.
          </p>
        )}

        {etapa.tipo === "listo" ? (
          <ResultadoMovimiento respuesta={etapa.respuesta} />
        ) : etapa.tipo === "editar" ? (
          <>
            <ElegirDireccion
              direccion={direccion}
              onElegir={elegirDireccion}
              disabled={!manejaBodega}
            />

            <form
              onSubmit={onManualSubmit}
              className="space-y-2 rounded-lg border bg-card p-3"
            >
              <Label htmlFor="codigo" className="text-xs">
                Código (lector USB o a mano) · cada escaneo es una pieza
              </Label>
              <div className="flex gap-2">
                <Input
                  id="codigo"
                  ref={manualRef}
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder={direccion ? "12300011" : "Primero elige hacia dónde"}
                  inputMode="search"
                  disabled={!puedeEscanear}
                  className="flex-1"
                />
                <Button type="submit" disabled={!puedeEscanear || !manual.trim()}>
                  Agregar
                </Button>
              </div>
            </form>

            {aviso && <AvisoEscaneo aviso={aviso} />}
            {rechazo && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {rechazo}
              </p>
            )}

            {direccion && lineas.length > 0 && (
              <section className="space-y-2">
                <p className="text-right text-xs text-muted-foreground">
                  {articulosTexto(lineas.length)} · {piezasTexto(total)}
                </p>
                <LineasEditables
                  lineas={lineas}
                  porClave={porClave}
                  direccion={direccion}
                  onPiezas={cambiarPiezas}
                  onQuitar={quitar}
                />
              </section>
            )}
            {direccion && lineas.length === 0 && (
              <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Escanea lo que vas a mover.
              </p>
            )}
          </>
        ) : (
          <>
            {etapa.tipo === "confirmar" && (
              <p className="text-sm font-medium">¿Mover estas piezas?</p>
            )}
            {etapa.tipo === "confirmar" && enLinea && !puedeConfirmar && (
              <p role="alert" className="text-sm text-destructive">
                Cambiaron las existencias: regresa a revisar la lista.
              </p>
            )}
            {etapa.tipo === "duda" && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">{etapa.mensaje}</p>
                  {sinPoderPreguntar ? (
                    <p className="text-xs font-medium">
                      No pudimos revisarlo: {sinPoderPreguntar} Al volver, aquí mismo te
                      decimos si se movió.
                    </p>
                  ) : (
                    <p className="text-xs">
                      Mientras tanto esta lista no se puede cambiar. En cuanto haya
                      internet aquí mismo te decimos si se movió o no.
                    </p>
                  )}
                </div>
              </div>
            )}
            {resumen && (
              <ResumenEnvio direccion={resumen.direccion} lineas={resumen.lineas} />
            )}
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.25rem))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex max-w-md gap-2">
          {etapa.tipo === "editar" && (
            <Button
              className="flex-1"
              onClick={() => setEtapa({ tipo: "confirmar" })}
              disabled={!puedeConfirmar}
            >
              <ArrowDownUp className="mr-2 h-4 w-4" />
              Mover {piezasTexto(total)}
            </Button>
          )}
          {etapa.tipo === "confirmar" && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEtapa({ tipo: "editar" })}
              >
                Regresar
              </Button>
              <Button className="flex-1" onClick={mover} disabled={!puedeConfirmar}>
                Sí, mover
              </Button>
            </>
          )}
          {etapa.tipo === "enviando" && (
            <Button className="flex-1" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Moviendo…
            </Button>
          )}
          {(etapa.tipo === "duda" || etapa.tipo === "listo") && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/movimientos")}
            >
              <History className="mr-2 h-4 w-4" /> Movimientos
            </Button>
          )}
          {etapa.tipo === "duda" && (
            <Button
              className="flex-1"
              onClick={() => setVuelta((n) => n + 1)}
              disabled={!enLinea || preguntando}
            >
              {preguntando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {preguntando ? "Revisando…" : "Revisar ahora"}
            </Button>
          )}
          {etapa.tipo === "listo" && (
            <Button className="flex-1" onClick={otroMovimiento}>
              {deOtraPestana ? "Seguir con mi lista" : "Otro movimiento"}
            </Button>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(codigo) => {
          setScannerOpen(false);
          manejarCodigo(codigo);
        }}
      />
    </div>
  );
}

function AvisoEscaneo({ aviso }: { aviso: Aviso }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
        aviso.tipo === "ok"
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
      role={aviso.tipo === "err" ? "alert" : "status"}
    >
      {aviso.tipo === "ok" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="min-w-0">{aviso.texto}</p>
    </div>
  );
}

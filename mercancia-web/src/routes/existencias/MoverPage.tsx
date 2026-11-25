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
  borrarPendiente,
  clasificarFallo,
  consultarEnvio,
  guardarPendiente,
  leerPendiente,
  moverExistencias,
  nuevoMovimientoId,
  type DuenoEnvio,
  type EnvioMover,
  type EnvioPendiente,
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
import {
  ESPERA_ENVIO_SIN_RASTRO_MS,
  nombreArticuloFinal,
  type DireccionMovimientoExistencias,
} from "@shared";

/** Límite de la function `moverExistencias`. */
const MAX_LINEAS = 100;

/**
 * - editar: se arma la lista.
 * - confirmar: resumen antes de mandar.
 * - enviando / duda: la lista ya se mandó y no se puede cambiar. En duda (no
 *   se sabe si se aplicó) solo se puede reintentar ESE envío, con el mismo
 *   id; la página revisa sola su registro y solo suelta la lista con prueba
 *   de que no se movió nada.
 * - listo: cómo quedaron bodega y tienda.
 */
type Etapa =
  | { tipo: "editar" }
  | { tipo: "confirmar" }
  | { tipo: "enviando"; envio: EnvioPendiente }
  | { tipo: "duda"; envio: EnvioPendiente; mensaje: string }
  | { tipo: "listo"; respuesta: RespuestaMover };

type Aviso = { tipo: "ok" | "err"; texto: string };

type RazonCodigo = Extract<ResolveResult, { ok: false }>["razon"];

const MENSAJE_CODIGO: Record<RazonCodigo, (codigo: string) => string> = {
  "no-encontrado": (c) => `Código no encontrado: ${c}`,
  "padre-con-variaciones": () =>
    "Este artículo tiene variaciones: escanea la etiqueta de la variación.",
  "subvariacion-no-encontrada": () => "Esa variación ya no existe.",
};

const MENSAJE_PENDIENTE =
  "Un movimiento quedó sin respuesta y no sabemos si se movió. Toca «Reintentar»: si ya se había movido, no se mueve dos veces.";
const MENSAJE_OTRA_PESTANA =
  "Antes de mandar este, hay que saber qué pasó con un movimiento que quedó sin respuesta (se mandó desde otra pestaña). Toca «Reintentar»: si ya se había movido, no se mueve dos veces.";
const MENSAJE_NO_SE_MOVIO = "Ya lo revisamos: ese movimiento no se aplicó. No se movió nada.";

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
  const dueno: DuenoEnvio | null =
    binding && auth
      ? {
          negocioId: binding.negocioId,
          sucursalId: binding.sucursalId,
          usuarioId: auth.usuarioId,
        }
      : null;

  const negocioId = dueno?.negocioId;
  const sucursalId = dueno?.sucursalId;
  const usuarioId = dueno?.usuarioId;

  // Un envío que quedó sin respuesta (aunque se haya salido de la página)
  // regresa bloqueado: solo se puede reintentar con el mismo id.
  const [pendiente] = useState(() => (dueno ? leerPendiente(dueno) : null));
  // El envío en duda lo dejó OTRA pestaña: la lista de esta no es la suya y
  // se conserva para seguir cuando aquel se aclare.
  const [deOtraPestana, setDeOtraPestana] = useState(false);
  // Por qué la function rechazó el último reintento (si lo rechazó).
  const motivoRechazo = useRef<string | null>(null);
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

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // En duda: se revisa SOLA el registro del movimiento (al entrar, al volver
  // el internet y cuando ya pasó el tiempo en que podía aplicarse).
  const dudaId = etapa.tipo === "duda" ? etapa.envio.movimientoId : null;
  const dudaMs = etapa.tipo === "duda" ? etapa.envio.enviadoMs : 0;
  useEffect(() => {
    if (!dudaId || !negocioId || !sucursalId || !usuarioId || !enLinea) return;
    const quien: DuenoEnvio = { negocioId, sucursalId, usuarioId };
    let vivo = true;
    const revisar = async () => {
      const estado = await consultarEnvio(quien, dudaId, dudaMs);
      if (!vivo || estado.tipo === "sin-saber") return;
      borrarPendiente(quien);
      if (estado.tipo === "aplicado") {
        motivoRechazo.current = null;
        setEtapa({ tipo: "listo", respuesta: estado.respuesta });
        return;
      }
      // Prueba de que no se movió nada: la lista se puede corregir y el
      // próximo envío lleva otro id.
      const motivo = motivoRechazo.current;
      motivoRechazo.current = null;
      setRechazo(motivo ? `${MENSAJE_NO_SE_MOVIO} ${motivo}` : MENSAJE_NO_SE_MOVIO);
      setDeOtraPestana(false);
      setEtapa({ tipo: "editar" });
    };
    void revisar();
    const falta = dudaMs + ESPERA_ENVIO_SIN_RASTRO_MS - Date.now();
    const t = falta > 0 ? window.setTimeout(() => void revisar(), falta + 500) : undefined;
    return () => {
      vivo = false;
      if (t !== undefined) window.clearTimeout(t);
    };
  }, [dudaId, dudaMs, enLinea, negocioId, sucursalId, usuarioId]);

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

  /**
   * Manda (o reintenta) un envío. `enDudaDesdeMs`: null si es la primera
   * vez que sale ese id; si es un reintento, cuándo salió el último intento
   * que quedó sin respuesta.
   */
  async function enviar(base: EnvioMover, enDudaDesdeMs: number | null) {
    if (!dueno) return;
    const envio: EnvioPendiente = {
      movimientoId: base.movimientoId,
      direccion: base.direccion,
      lineas: base.lineas,
      enviadoMs: Date.now(),
    };
    // Se guarda ANTES de llamar: si la página se cierra a medio envío, al
    // volver queda bloqueado en vez de dejar mandarlo con otro id.
    guardarPendiente(dueno, envio);
    setRechazo(null);
    setEtapa({ tipo: "enviando", envio });
    try {
      const respuesta = await moverExistencias(envio);
      borrarPendiente(dueno);
      motivoRechazo.current = null;
      setEtapa({ tipo: "listo", respuesta });
    } catch (e) {
      const fallo = clasificarFallo(e);
      if (!fallo.contesto) {
        // Se cortó: no se sabe si ESTE intento se aplicó.
        setEtapa({ tipo: "duda", envio, mensaje: fallo.mensaje });
        return;
      }
      if (enDudaDesdeMs === null || fallo.idAjeno) {
        // La function contestó que no, y no hay ningún intento anterior en
        // duda (o ese id nunca fue nuestro): no se movió nada. Se corrige
        // la lista y el próximo envío lleva otro id.
        borrarPendiente(dueno);
        motivoRechazo.current = null;
        setRechazo(`No se movió nada. ${soloMotivo(fallo.mensaje)}`);
        setDeOtraPestana(false);
        setEtapa({ tipo: "editar" });
        return;
      }
      // Este reintento no movió nada, pero un intento ANTERIOR quedó sin
      // respuesta y pudo aplicarse: la lista sigue bloqueada hasta saberlo
      // (se revisa sola). El tiempo se sigue contando desde aquel intento.
      const sigue: EnvioPendiente = { ...envio, enviadoMs: enDudaDesdeMs };
      guardarPendiente(dueno, sigue);
      const motivo = soloMotivo(fallo.mensaje);
      motivoRechazo.current = motivo;
      setEtapa({
        tipo: "duda",
        envio: sigue,
        mensaje: `El reintento se rechazó. ${motivo} Todavía no sabemos si el primer envío se aplicó: lo estamos revisando.`,
      });
    }
  }

  function mover() {
    if (!direccion || !puedeConfirmar || !dueno) return;
    // Otra pestaña pudo dejar un envío sin respuesta: primero se aclara ese.
    // Mandar este lo pisaría y ya nadie sabría si aquel se movió.
    const previo = leerPendiente(dueno);
    if (previo) {
      setDeOtraPestana(true);
      setEtapa({ tipo: "duda", envio: previo, mensaje: MENSAJE_OTRA_PESTANA });
      return;
    }
    void enviar({ movimientoId: nuevoMovimientoId(), direccion, lineas }, null);
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
                  <p className="text-xs">
                    Mientras tanto esta lista no se puede cambiar. Lo revisamos solos
                    en cuanto hay internet; en «Movimientos» también puedes ver si ya
                    quedó.
                  </p>
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
              onClick={() => void enviar(etapa.envio, etapa.envio.enviadoMs)}
              disabled={!enLinea}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
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

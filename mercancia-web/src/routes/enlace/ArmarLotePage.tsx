import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, ChevronRight, Copy, Loader2, Package, PackagePlus, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  cajasOrdenadas,
  llaveCajaLote,
  paquetesDeCaja,
  sueltasDeCaja,
  type LoteContenido,
  type LoteSuelta,
  type Sucursal,
} from "@shared";
import { Button } from "@/components/ui/button";
import { ErrorEnlace, mensajeDeError, type SesionEnlace } from "@/firebase/enlaceApp";
import { rutaDeSesion, useEnlace, usePantalla, useVolver } from "@/features/enlace/EnlaceContext";
import { EscanerCodigo, type MensajeEscaner } from "@/features/enlace/EscanerCodigo";
import {
  articuloEnMemoria,
  avisoDestino,
  cargarNombres,
  nombreArticulo,
  sucursalesDestino,
} from "@/features/enlace/catalogoService";
import {
  agregarCaja,
  borrarLote,
  cambiarDestino,
  editarPaquete,
  guardarPaquete,
  guardarSuelta,
  leerLote,
  legible,
  limpiarCodigoEtiqueta,
  marcarLoteListo,
  quitarCaja,
  quitarPaquete,
  quitarSuelta,
  revisarEtiqueta,
  seArma,
  totalesCaja,
  type Lote,
} from "@/features/enlace/lotesService";
import {
  Aviso,
  AvisoError,
  BotonGrande,
  ConfirmarEnLinea,
  Pantalla,
  PantallaCargando,
  plural,
} from "@/features/enlace/ui";
import { ElegirDestino, estadoDeLote, resumenTotales } from "./MisLotesPage";
import {
  PaqueteForm,
  SueltaEditarForm,
  SueltaNuevaForm,
  describirContenido,
} from "./FormulariosLote";
import { LoteListoPantalla } from "./LoteListoPantalla";

type PantallaLote =
  | { tipo: "nuevaCaja" }
  | { tipo: "etiquetaPaquete"; caja: string }
  | { tipo: "paquete"; caja: string; codigo: string; llave?: string; contenido: LoteContenido[] }
  | { tipo: "otroIgual"; caja: string; contenido: LoteContenido[] }
  | { tipo: "sueltaNueva"; caja: string }
  | { tipo: "sueltaEditar"; caja: string; llave: string; suelta: LoteSuelta }
  | { tipo: "destino" }
  | { tipo: "listo" };

/** Nombres de los artículos del lote: se traen a memoria una vez. */
function useNombres(s: SesionEnlace, lote: Lote | null) {
  const [, setVersion] = useState(0);
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const p of Object.values(lote?.paquetes ?? {})) {
      for (const r of p.contenido ?? []) if (r?.articuloId) set.add(r.articuloId);
    }
    for (const x of Object.values(lote?.sueltas ?? {})) if (x?.articuloId) set.add(x.articuloId);
    return [...set].sort().join(",");
  }, [lote]);
  useEffect(() => {
    let vivo = true;
    cargarNombres(s, ids ? ids.split(",") : []).then(() => {
      if (vivo) setVersion((v) => v + 1);
    });
    return () => {
      vivo = false;
    };
  }, [s, ids]);
  return useCallback(
    (articuloId: string, sub?: string) => nombreArticulo(s, articuloId, sub),
    // `ids` cambia cuando llegan artículos nuevos; la versión fuerza el render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, ids],
  );
}

/**
 * Armar un lote: la lista de cajas (`?caja=` abre una) y, encima, una
 * pantalla a la vez para escanear, capturar un paquete, etc. Cada paso se
 * guarda al momento.
 */
export function ArmarLotePage() {
  const { loteId = "" } = useParams();
  const { base, sesion } = useEnlace();
  if (!sesion) return <Navigate to={base} replace />;
  if (sesion.tipo !== "armar") {
    return <Navigate to={rutaDeSesion(sesion.negocioId, sesion.enlaceId, sesion.tipo)} replace />;
  }
  return <ArmarLote sesion={sesion} loteId={loteId} />;
}

function ArmarLote({ sesion: s, loteId }: { sesion: SesionEnlace; loteId: string }) {
  const navigate = useNavigate();
  const volver = useVolver();
  const { base } = useEnlace();
  const [params] = useSearchParams();
  const cajaAbierta = params.get("caja");
  const rutaLote = `${base}/lotes/${encodeURIComponent(loteId)}`;

  const [lote, setLote] = useState<Lote | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [errorCarga, setErrorCarga] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<MensajeEscaner | null>(null);
  const [llevas, setLlevas] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Lo último guardado en cada caja, para "Otro igual". */
  const [ultimo, setUltimo] = useState<Record<string, LoteContenido[]>>({});
  const { pantalla, abrir, cambiar, cerrar, irA } = usePantalla<PantallaLote>();
  const nombre = useNombres(s, lote);
  /** En los escáneres de etiqueta: ir a imprimir más (y volver a este lote). */
  const sinEtiquetas = (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full text-base"
      onClick={() => irA(`${base}/etiquetas?volver=${encodeURIComponent(rutaLote)}`)}
    >
      ¿Sin etiquetas? Imprimir más
    </Button>
  );

  const cargar = useCallback(() => {
    setCargando(true);
    setErrorCarga(null);
    leerLote(s, loteId)
      .then((l) => {
        setLote(l);
        setNoExiste(!l);
      })
      .catch(setErrorCarga)
      .finally(() => setCargando(false));
  }, [s, loteId]);
  useEffect(cargar, [cargar]);

  useEffect(() => {
    sucursalesDestino(s).then(setSucursales).catch(() => undefined);
  }, [s]);

  const destino = sucursales.find((x) => x.sucursalId === lote?.sucursalDestinoId);

  // ---------- Cargando / errores ----------
  if (!lote) {
    if (cargando) return <PantallaCargando texto="Abriendo el lote…" />;
    return (
      <Pantalla titulo={loteId} onVolver={() => volver(`${base}/lotes`)}>
        {noExiste ? (
          <Aviso tono="ojo">Este lote ya no existe.</Aviso>
        ) : (
          <AvisoError error={errorCarga} onReintentar={cargar} />
        )}
      </Pantalla>
    );
  }

  const l = lote;
  const editable = seArma(l);
  const cajas = cajasOrdenadas(l);
  const caja = cajaAbierta ? l.cajas[cajaAbierta] : undefined;
  const tituloCaja = (llave: string) => `Caja ${l.cajas[llave]?.orden ?? "?"}`;

  /** Corre una acción del escáner: mensaje bien/mal sin cerrar. */
  async function enEscaner(fn: () => Promise<string | void>) {
    setOcupado(true);
    setMensaje(null);
    try {
      const texto = await fn();
      if (texto) setMensaje({ tono: "bien", texto });
    } catch (e) {
      setMensaje({ tono: "mal", texto: mensajeDeError(e) });
    } finally {
      setOcupado(false);
    }
  }

  function abrirEscaner(p: PantallaLote) {
    setMensaje(null);
    setLlevas(0);
    abrir(p);
  }

  // ---------- Pantallas encima ----------
  if (pantalla) {
    switch (pantalla.tipo) {
      case "nuevaCaja":
        return (
          <EscanerCodigo
            key="nuevaCaja"
            open
            titulo="Nueva caja"
            ayuda="Escanea la etiqueta numerada que va en la caja"
            etiquetaCampo="Código de la etiqueta de la caja"
            mensaje={mensaje}
            ocupado={ocupado}
            onClose={cerrar}
            pie={sinEtiquetas}
            onCodigo={(codigo) =>
              enEscaner(async () => {
                const nuevo = await agregarCaja(s, l.id, codigo);
                setLote(nuevo);
                irA(`${rutaLote}?caja=${encodeURIComponent(llaveCajaLote(limpiarCodigoEtiqueta(codigo)))}`);
              })
            }
          />
        );

      case "etiquetaPaquete":
        return (
          <EscanerCodigo
            key="etiquetaPaquete"
            open
            titulo={`Nuevo paquete · ${tituloCaja(pantalla.caja)}`}
            ayuda="Escanea la etiqueta numerada del paquete"
            etiquetaCampo="Código de la etiqueta del paquete"
            mensaje={mensaje}
            ocupado={ocupado}
            onClose={cerrar}
            pie={sinEtiquetas}
            onCodigo={(codigo) =>
              enEscaner(async () => {
                const problema = await revisarEtiqueta(s, l, codigo);
                if (problema) throw new ErrorEnlace(problema);
                cambiar({
                  tipo: "paquete",
                  caja: pantalla.caja,
                  codigo: limpiarCodigoEtiqueta(codigo),
                  contenido: [],
                });
              })
            }
          />
        );

      case "paquete":
        return (
          <PaqueteForm
            sesion={s}
            destino={destino}
            codigo={pantalla.codigo}
            cajaTitulo={tituloCaja(pantalla.caja)}
            inicial={pantalla.contenido}
            editando={!!pantalla.llave}
            nombre={nombre}
            onCancelar={cerrar}
            onGuardar={async (contenido) => {
              const nuevo = pantalla.llave
                ? await editarPaquete(s, l.id, pantalla.llave, contenido)
                : await guardarPaquete(s, l.id, {
                    codigo: pantalla.codigo,
                    caja: pantalla.caja,
                    contenido,
                  });
              setLote(nuevo);
              if (!pantalla.llave) setUltimo((u) => ({ ...u, [pantalla.caja]: contenido }));
              setAviso(
                pantalla.llave
                  ? "Paquete corregido."
                  : `Paquete ${legible(pantalla.codigo)} guardado.`,
              );
              cerrar();
            }}
            onQuitar={
              pantalla.llave
                ? async () => {
                    setLote(await quitarPaquete(s, l.id, pantalla.llave!));
                    setAviso("Paquete quitado.");
                    cerrar();
                  }
                : undefined
            }
          />
        );

      case "otroIgual":
        return (
          <EscanerCodigo
            key="otroIgual"
            open
            continuo
            titulo={`Otro igual · ${tituloCaja(pantalla.caja)}`}
            ayuda={`Cada etiqueta que escanees se guarda con: ${describirContenido(pantalla.contenido, nombre)}`}
            etiquetaCampo="Código de la etiqueta del paquete"
            mensaje={mensaje}
            ocupado={ocupado}
            pie={
              llevas > 0 ? (
                <p className="text-base">
                  Llevas {plural(llevas, "paquete", "paquetes")} así.
                </p>
              ) : null
            }
            onClose={cerrar}
            onCodigo={(codigo) =>
              enEscaner(async () => {
                const nuevo = await guardarPaquete(s, l.id, {
                  codigo,
                  caja: pantalla.caja,
                  contenido: pantalla.contenido,
                });
                setLote(nuevo);
                setLlevas((n) => n + 1);
                return `Guardado: ${legible(limpiarCodigoEtiqueta(codigo))}. Escanea el siguiente.`;
              })
            }
          />
        );

      case "sueltaNueva":
        return (
          <SueltaNuevaForm
            sesion={s}
            destino={destino}
            cajaTitulo={tituloCaja(pantalla.caja)}
            onCancelar={cerrar}
            onGuardar={async (r) => {
              setLote(await guardarSuelta(s, l.id, null, { caja: pantalla.caja, ...r }));
              setAviso("Piezas sueltas guardadas.");
              cerrar();
            }}
          />
        );

      case "sueltaEditar": {
        // Copia de cuando se abrió: al quitarla, la pantalla no parpadea
        // mientras se cierra.
        const x = pantalla.suelta;
        return (
          <SueltaEditarForm
            nombreArticulo={nombre(x.articuloId, x.subvariacionCodigo)}
            cajaTitulo={tituloCaja(pantalla.caja)}
            piezas={x.piezas}
            aviso={avisoDestino(articuloEnMemoria(s, x.articuloId), destino)}
            onCancelar={cerrar}
            onGuardar={async (piezas) => {
              setLote(
                await guardarSuelta(s, l.id, pantalla.llave, {
                  caja: x.caja,
                  articuloId: x.articuloId,
                  ...(x.subvariacionCodigo ? { subvariacionCodigo: x.subvariacionCodigo } : {}),
                  piezas,
                }),
              );
              setAviso("Piezas sueltas corregidas.");
              cerrar();
            }}
            onQuitar={async () => {
              setLote(await quitarSuelta(s, l.id, pantalla.llave));
              setAviso("Piezas sueltas quitadas.");
              cerrar();
            }}
          />
        );
      }

      case "destino":
        return (
          <CambiarDestino
            sesion={s}
            lote={l}
            onCancelar={cerrar}
            onListo={(nuevo) => {
              setLote(nuevo);
              setAviso(`Ahora va a ${nuevo.sucursalDestinoNombre}.`);
              cerrar();
            }}
          />
        );

      case "listo":
        return (
          <LoteListoPantalla
            sesion={s}
            lote={l}
            destino={destino}
            onCancelar={cerrar}
            onListo={async (datos) => {
              setLote(await marcarLoteListo(s, l.id, datos));
              setAviso("Lote listo. Ahora el administrador confirma el envío.");
              // Se abrió desde la vista del lote: regresar a ella.
              cerrar();
            }}
          />
        );
    }
  }

  // ---------- Vista de una caja ----------
  // Una caja que ya no está (se acaba de quitar, o una dirección vieja) cae
  // en la vista del lote.
  if (cajaAbierta && caja) {
    return (
      <VistaCaja
        sesion={s}
        lote={l}
        llave={cajaAbierta}
        editable={editable}
        nombre={nombre}
        ultimo={ultimo[cajaAbierta]}
        aviso={aviso}
        onCerrarAviso={() => setAviso(null)}
        onVolver={() => {
          setAviso(null);
          volver(rutaLote);
        }}
        onNuevoPaquete={() => {
          setAviso(null);
          abrirEscaner({ tipo: "etiquetaPaquete", caja: cajaAbierta });
        }}
        onOtroIgual={(contenido) => {
          setAviso(null);
          abrirEscaner({ tipo: "otroIgual", caja: cajaAbierta, contenido });
        }}
        onSuelta={() => {
          setAviso(null);
          abrir({ tipo: "sueltaNueva", caja: cajaAbierta });
        }}
        onAbrirPaquete={(llave) => {
          const p = l.paquetes?.[llave];
          if (!p) return;
          setAviso(null);
          abrir({ tipo: "paquete", caja: cajaAbierta, codigo: p.codigo, llave, contenido: p.contenido });
        }}
        onAbrirSuelta={(llave) => {
          const suelta = l.sueltas?.[llave];
          if (!suelta) return;
          setAviso(null);
          abrir({ tipo: "sueltaEditar", caja: cajaAbierta, llave, suelta });
        }}
        onQuitada={(nuevo) => {
          setLote(nuevo);
          setAviso("Caja quitada.");
          volver(rutaLote);
        }}
      />
    );
  }

  // ---------- Vista del lote ----------
  return (
    <VistaLote
      sesion={s}
      lote={l}
      editable={editable}
      cajas={cajas}
      aviso={aviso}
      cargando={cargando}
      onRecargar={() => {
        setAviso(null);
        cargar();
      }}
      onVolver={() => volver(`${base}/lotes`)}
      onAbrirCaja={(llave) => {
        setAviso(null);
        navigate(`${rutaLote}?caja=${encodeURIComponent(llave)}`);
      }}
      onNuevaCaja={() => {
        setAviso(null);
        abrirEscaner({ tipo: "nuevaCaja" });
      }}
      onDestino={() => {
        setAviso(null);
        abrir({ tipo: "destino" });
      }}
      onListo={() => {
        setAviso(null);
        abrir({ tipo: "listo" });
      }}
      onBorrado={() => navigate(`${base}/lotes`, { replace: true })}
    />
  );
}

// ============================================================
// Vista del lote: sus cajas
// ============================================================

function VistaLote({
  sesion,
  lote,
  editable,
  cajas,
  aviso,
  cargando,
  onRecargar,
  onVolver,
  onAbrirCaja,
  onNuevaCaja,
  onDestino,
  onListo,
  onBorrado,
}: {
  sesion: SesionEnlace;
  lote: Lote;
  editable: boolean;
  cajas: ReturnType<typeof cajasOrdenadas>;
  aviso: string | null;
  cargando: boolean;
  onRecargar: () => void;
  onVolver: () => void;
  onAbrirCaja: (llave: string) => void;
  onNuevaCaja: () => void;
  onDestino: () => void;
  onListo: () => void;
  onBorrado: () => void;
}) {
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copiado, setCopiado] = useState(false);

  async function borrar() {
    setBorrando(true);
    setError(null);
    try {
      await borrarLote(sesion, lote.id);
      onBorrado();
    } catch (e) {
      setError(e);
      setBorrando(false);
      setConfirmarBorrar(false);
    }
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(lote.folio ?? lote.id);
      setCopiado(true);
    } catch {
      /* sin portapapeles: el código está a la vista */
    }
  }

  return (
    <Pantalla
      titulo={
        <span className="font-mono" aria-label={`Lote ${lote.folio ?? lote.id}`}>
          {lote.folio ?? lote.id}
        </span>
      }
      subtitulo={resumenTotales(lote)}
      onVolver={onVolver}
      derecha={
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          onClick={onRecargar}
          disabled={cargando}
          aria-label="Actualizar"
        >
          {cargando ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCw className="h-6 w-6" />}
        </Button>
      }
      pie={
        editable ? (
          <>
            <BotonGrande onClick={onNuevaCaja}>
              <Plus className="mr-2 h-6 w-6" /> Nueva caja
            </BotonGrande>
            <BotonGrande variant="outline" onClick={onListo} disabled={cajas.length === 0}>
              Lote listo
            </BotonGrande>
          </>
        ) : undefined
      }
    >
      {aviso && <Aviso tono="bien">{aviso}</Aviso>}
      {!editable && (
        <Aviso tono="info">
          <p className="font-semibold">{estadoDeLote(lote)}</p>
          <p>
            {lote.estado === "creando"
              ? "Ya no se puede cambiar desde aquí. Si hay que corregir algo, pide al administrador que lo regrese."
              : "Este lote ya se envió: solo se puede ver."}
          </p>
        </Aviso>
      )}

      <div className="flex items-center gap-2 rounded-md border bg-card p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Va a</p>
          <p className="truncate text-lg font-semibold">{lote.sucursalDestinoNombre}</p>
        </div>
        {editable && (
          <Button variant="outline" className="h-12 px-4 text-base" onClick={onDestino}>
            Cambiar
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          onClick={copiarCodigo}
          aria-label="Copiar código del lote"
        >
          <Copy className="h-5 w-5" />
        </Button>
      </div>
      {copiado && <p className="text-sm text-muted-foreground">Código copiado.</p>}

      {cajas.length === 0 ? (
        <p className="py-6 text-center text-base text-muted-foreground">
          {editable
            ? 'Todavía no hay cajas. Toca "Nueva caja" y escanea su etiqueta.'
            : "Este lote no tiene cajas."}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Cajas">
          {cajas.map(({ llave, caja }) => {
            const t = totalesCaja(lote, llave);
            return (
              <li key={llave}>
                <button
                  type="button"
                  onClick={() => onAbrirCaja(llave)}
                  className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left active:bg-accent"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Box className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">Caja {caja.orden}</p>
                    <p className="font-mono text-xs text-muted-foreground">{legible(caja.codigo)}</p>
                    <p className="text-sm text-muted-foreground">
                      {plural(t.paquetes, "paquete", "paquetes")}
                      {t.sueltas > 0 ? " + sueltas" : ""} · {plural(t.piezas, "pza", "pzas")}
                    </p>
                  </div>
                  <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!!error && <AvisoError error={error} />}
      {editable && (
        <div className="pt-6">
          {confirmarBorrar ? (
            <ConfirmarEnLinea
              pregunta="¿Borrar este lote completo? Sus etiquetas ya no se podrán usar en otro lote."
              textoSi="Sí, borrar"
              ocupado={borrando}
              onSi={borrar}
              onNo={() => setConfirmarBorrar(false)}
            />
          ) : (
            <Button
              variant="ghost"
              className="h-12 w-full text-base text-destructive"
              onClick={() => setConfirmarBorrar(true)}
            >
              <Trash2 className="mr-2 h-5 w-5" /> Borrar lote
            </Button>
          )}
        </div>
      )}
    </Pantalla>
  );
}

// ============================================================
// Vista de una caja: sus paquetes y piezas sueltas
// ============================================================

function VistaCaja({
  sesion,
  lote,
  llave,
  editable,
  nombre,
  ultimo,
  aviso,
  onCerrarAviso,
  onVolver,
  onNuevoPaquete,
  onOtroIgual,
  onSuelta,
  onAbrirPaquete,
  onAbrirSuelta,
  onQuitada,
}: {
  sesion: SesionEnlace;
  lote: Lote;
  llave: string;
  editable: boolean;
  nombre: (articuloId: string, sub?: string) => string;
  ultimo?: LoteContenido[];
  aviso: string | null;
  onCerrarAviso: () => void;
  onVolver: () => void;
  onNuevoPaquete: () => void;
  onOtroIgual: (contenido: LoteContenido[]) => void;
  onSuelta: () => void;
  onAbrirPaquete: (llave: string) => void;
  onAbrirSuelta: (llave: string) => void;
  onQuitada: (lote: Lote) => void;
}) {
  const caja = lote.cajas[llave]!;
  const paquetes = paquetesDeCaja(lote, llave);
  const sueltas = sueltasDeCaja(lote, llave);
  const t = totalesCaja(lote, llave);
  // "Otro igual": lo último guardado aquí en esta sesión o, si no, el último
  // paquete de la caja.
  const igual = ultimo ?? paquetes[paquetes.length - 1]?.paquete.contenido;
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function quitar() {
    setQuitando(true);
    setError(null);
    try {
      onQuitada(await quitarCaja(sesion, lote.id, llave));
    } catch (e) {
      setError(e);
      setQuitando(false);
      setConfirmarQuitar(false);
    }
  }

  return (
    <Pantalla
      titulo={`Caja ${caja.orden}`}
      subtitulo={`${legible(caja.codigo)} · ${plural(t.paquetes, "paquete", "paquetes")} · ${plural(t.piezas, "pza", "pzas")}`}
      onVolver={onVolver}
      pie={
        editable ? (
          <>
            <BotonGrande onClick={onNuevoPaquete}>
              <PackagePlus className="mr-2 h-6 w-6" /> Nuevo paquete
            </BotonGrande>
            <div className="flex gap-2">
              {igual && igual.length > 0 && (
                <Button
                  variant="outline"
                  className="h-14 flex-1 text-base"
                  onClick={() => onOtroIgual(igual)}
                >
                  Otro igual
                </Button>
              )}
              <Button variant="outline" className="h-14 flex-1 text-base" onClick={onSuelta}>
                Suelto
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      {aviso && (
        <button type="button" onClick={onCerrarAviso} className="block w-full text-left">
          <Aviso tono="bien">{aviso}</Aviso>
        </button>
      )}
      {editable && igual && igual.length > 0 && (
        <p className="text-sm text-muted-foreground">
          "Otro igual" guarda: {describirContenido(igual, nombre)}
        </p>
      )}

      {paquetes.length === 0 && sueltas.length === 0 ? (
        <p className="py-6 text-center text-base text-muted-foreground">
          {editable
            ? 'Caja vacía. Toca "Nuevo paquete" y escanea su etiqueta.'
            : "Esta caja está vacía."}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Contenido de la caja">
          {paquetes.map(({ llave: k, paquete }, i) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => editable && onAbrirPaquete(k)}
                disabled={!editable}
                className="flex w-full items-start gap-3 rounded-md border bg-card p-3 text-left active:bg-accent disabled:opacity-100"
              >
                <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    Paquete {i + 1} · <span className="font-mono">{legible(paquete.codigo)}</span>
                  </p>
                  <p className="text-base">{describirContenido(paquete.contenido ?? [], nombre)}</p>
                </div>
                {editable && <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          ))}
          {sueltas.map(({ llave: k, suelta }) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => editable && onAbrirSuelta(k)}
                disabled={!editable}
                className="flex w-full items-start gap-3 rounded-md border border-dashed bg-card p-3 text-left active:bg-accent disabled:opacity-100"
              >
                <span className="mt-0.5 w-5 shrink-0 text-center text-muted-foreground">·</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Sueltas</p>
                  <p className="text-base">
                    {suelta.piezas} × {nombre(suelta.articuloId, suelta.subvariacionCodigo)}
                  </p>
                </div>
                {editable && <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!!error && <AvisoError error={error} />}
      {editable && (
        <div className="pt-6">
          {confirmarQuitar ? (
            <ConfirmarEnLinea
              pregunta={`¿Quitar la caja ${caja.orden} con ${plural(paquetes.length, "paquete", "paquetes")}${
                sueltas.length > 0 ? " y sus piezas sueltas" : ""
              }? Sus etiquetas solo se podrán volver a usar en este lote.`}
              textoSi="Sí, quitar"
              ocupado={quitando}
              onSi={quitar}
              onNo={() => setConfirmarQuitar(false)}
            />
          ) : (
            <Button
              variant="ghost"
              className="h-12 w-full text-base text-destructive"
              onClick={() => setConfirmarQuitar(true)}
            >
              <Trash2 className="mr-2 h-5 w-5" /> Quitar caja
            </Button>
          )}
        </div>
      )}
    </Pantalla>
  );
}

// ============================================================
// Cambiar el destino
// ============================================================

function CambiarDestino({
  sesion,
  lote,
  onListo,
  onCancelar,
}: {
  sesion: SesionEnlace;
  lote: Lote;
  onListo: (l: Lote) => void;
  onCancelar: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function elegir(suc: Sucursal) {
    if (suc.sucursalId === lote.sucursalDestinoId) {
      onCancelar();
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      onListo(
        await cambiarDestino(sesion, lote.id, {
          sucursalDestinoId: suc.sucursalId,
          sucursalDestinoNombre: suc.nombre,
        }),
      );
    } catch (e) {
      setError(e);
      setGuardando(false);
    }
  }

  return (
    <>
      <ElegirDestino
        sesion={sesion}
        actualId={lote.sucursalDestinoId}
        titulo="Cambiar destino"
        ocupado={guardando}
        onElegir={elegir}
        onCancelar={onCancelar}
      />
      {!!error && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-3">
          <AvisoError error={error} />
        </div>
      )}
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, LogIn, Printer, RefreshCw, RotateCcw, Tag } from "lucide-react";
import { estadoImpresoraParaOrden, textoEstadoTrabajo } from "@shared";
import { Button } from "@/components/ui/button";
import { rutaDeSesion, useEnlace } from "@/features/enlace/EnlaceContext";
import {
  escucharMisOrdenesAbiertas,
  escucharTrabajo,
  idNuevaOrden,
  listarImpresoras,
  mandarEtiquetaPrecio,
  problemasEtiquetaPrecio,
  reimprimir,
  type ImpresoraVista,
  type TrabajoVista,
} from "@/features/enlace/etiquetasService";
import {
  Aviso,
  AvisoError,
  BotonGrande,
  CampoPiezas,
  Cargando,
  Pantalla,
  plural,
} from "@/features/enlace/ui";
import { entrarConEnlace, type SesionEnlace } from "@/firebase/enlaceApp";

const claveImpresora = (enlaceId: string) => `precio.impresora.v1:${enlaceId}`;

function leerElegida(enlaceId: string): string {
  try {
    return localStorage.getItem(claveImpresora(enlaceId)) ?? "";
  } catch {
    return "";
  }
}

function useAhora(cada: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(t);
  }, [cada]);
  return ahora;
}

const CLASE_CAMPO =
  "h-14 w-full min-w-0 rounded-md border bg-background px-3 text-2xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Página aparte de etiquetas de precio (`/precio/:negocioId/:enlaceId`, con
 * un acceso `precio` de admin): se escribe el código y el precio y la
 * etiqueta sale en la impresora de etiquetas igual que en la app "codigos".
 */
export function PrecioPage() {
  const { negocioId, enlaceId, sesion } = useEnlace();
  if (!sesion) return <EntrarPrecio />;
  if (sesion.tipo !== "precio") {
    return <Navigate to={rutaDeSesion(negocioId, enlaceId, sesion.tipo)} replace />;
  }
  return <EtiquetasPrecio s={sesion} />;
}

/** Primera vez en este equipo: se canjea el enlace al tocar "Entrar". */
function EntrarPrecio() {
  const { negocioId, enlaceId, setSesion, secreto } = useEnlace();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function entrar() {
    if (!secreto) return;
    setEntrando(true);
    setError(null);
    try {
      setSesion(await entrarConEnlace(negocioId, enlaceId, secreto));
    } catch (e) {
      setError(e);
      setEntrando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Tag className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold">Etiquetas de precio</h1>
        <p className="text-lg text-muted-foreground">
          Escribe el código y el precio, y la etiqueta sale en la impresora de etiquetas.
        </p>
      </div>
      {!secreto ? (
        <Aviso tono="ojo">
          Abre el enlace completo que te mandaron. Si lo copiaste, revisa que traiga todo, también lo
          que va después del #.
        </Aviso>
      ) : (
        <>
          <BotonGrande onClick={entrar} disabled={entrando}>
            <LogIn className="mr-2 h-6 w-6" />
            {entrando ? "Entrando…" : "Entrar"}
          </BotonGrande>
          {!!error && <AvisoError error={error} />}
        </>
      )}
    </div>
  );
}

function EtiquetasPrecio({ s }: { s: SesionEnlace }) {
  const ahora = useAhora(15_000);
  const [impresoras, setImpresoras] = useState<ImpresoraVista[] | null>(null);
  const [errorLista, setErrorLista] = useState<unknown>(null);
  const [elegida, setElegida] = useState(() => leerElegida(s.enlaceId));
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [salioDelCodigo, setSalioDelCodigo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [trabajoId, setTrabajoId] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<TrabajoVista | null>(null);
  const [abiertas, setAbiertas] = useState<TrabajoVista[]>([]);
  // La orden que se intentó mandar y con qué: si salió "Sin internet" pero sí
  // llegó, reintentar lo MISMO usa el mismo id y no sale doble.
  const intento = useRef<{ id: string; firma: string } | null>(null);
  const refCodigo = useRef<HTMLInputElement>(null);
  const refPrecio = useRef<HTMLInputElement>(null);

  const cargar = useCallback(() => {
    setErrorLista(null);
    listarImpresoras(s)
      .then((lista) => {
        setImpresoras(lista);
        // Si solo hay una (o la recordada ya no existe), la primera.
        setElegida((x) => (lista.some((i) => i.id === x) ? x : lista.length === 1 ? lista[0]!.id : ""));
      })
      .catch(setErrorLista);
  }, [s]);
  useEffect(cargar, [cargar]);

  useEffect(() => {
    if (!trabajoId) return;
    return escucharTrabajo(s, trabajoId, setTrabajo, setError);
  }, [s, trabajoId]);
  useEffect(() => escucharMisOrdenesAbiertas(s, setAbiertas, () => undefined), [s]);

  const etiqueta = { codigo: codigo.trim(), precio: precio.trim(), piezas: Number(cantidad) };
  const problemas = problemasEtiquetaPrecio(etiqueta);
  const valida = Object.keys(problemas).length === 0;
  const impresora = impresoras?.find((i) => i.id === elegida);
  const errCodigo = codigo && (salioDelCodigo || codigo.length > 8) ? problemas.codigo : undefined;
  const errPrecio = precio ? problemas.precio : undefined;
  const errPiezas = cantidad !== "" ? problemas.piezas : undefined;

  async function imprimir() {
    if (!impresora || !valida || enviando) return;
    setEnviando(true);
    setError(null);
    const firma = JSON.stringify([impresora.id, etiqueta.codigo, etiqueta.precio, etiqueta.piezas]);
    if (intento.current?.firma !== firma) intento.current = { id: idNuevaOrden(s), firma };
    const id = intento.current.id;
    if (id !== trabajoId) setTrabajo(null);
    try {
      try {
        localStorage.setItem(claveImpresora(s.enlaceId), impresora.id);
      } catch {
        /* sin almacenamiento */
      }
      await mandarEtiquetaPrecio(s, impresora.id, etiqueta, id);
      intento.current = null;
      setTrabajoId(id);
      setCodigo("");
      setPrecio("");
      setCantidad("1");
      setSalioDelCodigo(false);
      refCodigo.current?.focus();
    } catch (e) {
      // No se sabe si llegó: se queda viendo esa orden (si llegó, aparece su
      // avance aquí) y un reintento con lo mismo usa su mismo id.
      setTrabajoId(id);
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  const otrasAbiertas = abiertas.filter((t) => t.id !== trabajoId);

  return (
    <Pantalla
      titulo="Etiquetas de precio"
      subtitulo={s.nombre || undefined}
      derecha={
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={cargar} aria-label="Actualizar">
          <RefreshCw className="h-6 w-6" />
        </Button>
      }
    >
      {errorLista ? (
        <AvisoError error={errorLista} onReintentar={cargar} />
      ) : !impresoras ? (
        <Cargando />
      ) : impresoras.length === 0 ? (
        <Aviso tono="ojo">
          Todavía no hay impresoras de etiquetas. Pide al administrador que conecte una (admin → Accesos →
          Impresoras de etiquetas).
        </Aviso>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Impresora</h2>
            <ul className="space-y-2">
              {impresoras.map((i) => {
                const e = estadoImpresoraParaOrden(i, ahora);
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setElegida(i.id)}
                      aria-pressed={i.id === elegida}
                      className={`flex min-h-16 w-full items-center gap-3 rounded-md border px-4 py-3 text-left active:bg-accent ${
                        i.id === elegida ? "border-primary bg-accent" : "bg-card"
                      }`}
                    >
                      <Printer className="h-6 w-6 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-medium">{i.nombre}</span>
                        <span className={`block text-sm ${e.lista ? "text-emerald-700" : "text-amber-800"}`}>{e.texto}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              void imprimir();
            }}
          >
            <label className="block space-y-2">
              <span className="block text-base font-semibold">Código</span>
              <input
                ref={refCodigo}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                value={codigo}
                placeholder="8 dígitos"
                onChange={(e) => setCodigo(e.target.value.replace(/\s/g, "").slice(0, 20))}
                onBlur={() => setSalioDelCodigo(true)}
                onKeyDown={(e) => {
                  // El lector de códigos (o la persona) da Enter: sigue el precio.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setSalioDelCodigo(true);
                    refPrecio.current?.focus();
                  }
                }}
                aria-invalid={!!errCodigo}
                className={`${CLASE_CAMPO} ${errCodigo ? "border-destructive" : "border-input"}`}
              />
              {errCodigo && <span className="block text-sm text-destructive">{errCodigo}</span>}
            </label>

            <label className="block space-y-2">
              <span className="block text-base font-semibold">Precio</span>
              <span className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-muted-foreground">$</span>
                <input
                  ref={refPrecio}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={precio}
                  placeholder="0"
                  onChange={(e) => setPrecio(e.target.value.replace(/[$\s]/g, "").replace(",", ".").slice(0, 10))}
                  aria-invalid={!!errPrecio}
                  className={`${CLASE_CAMPO} ${errPrecio ? "border-destructive" : "border-input"}`}
                />
              </span>
              {errPrecio && <span className="block text-sm text-destructive">{errPrecio}</span>}
            </label>

            <div className="space-y-2">
              <span className="block text-base font-semibold">Cuántas</span>
              <CampoPiezas valor={cantidad} onCambio={setCantidad} etiqueta="Cuántas etiquetas" />
              {errPiezas && <p className="text-sm text-destructive">{errPiezas}</p>}
            </div>

            {!!error && <AvisoError error={error} />}

            <BotonGrande type="submit" disabled={enviando || !impresora || !valida}>
              {enviando ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Printer className="mr-2 h-6 w-6" />}
              {Number.isInteger(etiqueta.piezas) && etiqueta.piezas > 0
                ? `Imprimir ${plural(etiqueta.piezas, "etiqueta", "etiquetas")}`
                : "Imprimir"}
            </BotonGrande>
            {!impresora && <p className="text-center text-sm text-muted-foreground">Elige la impresora.</p>}
          </form>

          {trabajo && <EstadoOrden s={s} trabajo={trabajo} onError={setError} />}

          {otrasAbiertas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Otras órdenes</h2>
              {otrasAbiertas.map((t) => (
                <EstadoOrden key={t.id} s={s} trabajo={t} onError={setError} />
              ))}
            </section>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Para volver a esta página, guárdala en favoritos.
          </p>
        </>
      )}
    </Pantalla>
  );
}

function EstadoOrden({
  s,
  trabajo,
  onError,
}: {
  s: SesionEnlace;
  trabajo: TrabajoVista;
  onError: (e: unknown) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const r = trabajo.renglones?.[0];
  const tono = trabajo.estado === "impreso" ? "bien" : trabajo.estado === "error" ? "mal" : "info";
  return (
    <div data-estado-impresion={trabajo.estado}>
      <Aviso tono={tono}>
        <p className="flex items-center gap-2">
          {(trabajo.estado === "pendiente" || trabajo.estado === "imprimiendo") && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          )}
          <span>
            {r ? `${r.codigo ?? "Sin código"} · $${r.precio} · ${plural(r.piezas, "etiqueta", "etiquetas")}` : "Etiquetas"}
            : {textoEstadoTrabajo(trabajo)}
          </span>
        </p>
        {trabajo.estado === "error" && (
          <Button
            variant="outline"
            className="mt-2 h-11 text-base"
            disabled={ocupado}
            onClick={() => {
              setOcupado(true);
              reimprimir(s, trabajo.id)
                .catch(onError)
                .finally(() => setOcupado(false));
            }}
          >
            <RotateCcw className="mr-2 h-5 w-5" /> Reimprimir
          </Button>
        )}
      </Aviso>
    </div>
  );
}

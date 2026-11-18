import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Printer, RefreshCw, RotateCcw } from "lucide-react";
import {
  IMPRESION_TOPE_ENLACE,
  estadoImpresoraParaOrden,
  textoEstadoTrabajo,
} from "@shared";
import { Button } from "@/components/ui/button";
import { useEnlace } from "@/features/enlace/EnlaceContext";
import {
  escucharMisOrdenesAbiertas,
  escucharTrabajo,
  listarImpresoras,
  pedirEtiquetas,
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
import type { SesionEnlace } from "@/firebase/enlaceApp";

const claveImpresora = (enlaceId: string) => `enlace.impresora.v1:${enlaceId}`;

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

/** Pedir etiquetas numeradas a una impresora de etiquetas (teléfono). */
export function EtiquetasPage() {
  const { base, sesion } = useEnlace();
  if (!sesion) return <Navigate to={base} replace />;
  if (sesion.tipo !== "armar") return <Navigate to={`${base}/fotos`} replace />;
  return <Etiquetas sesion={sesion} />;
}

function Etiquetas({ sesion: s }: { sesion: SesionEnlace }) {
  const navigate = useNavigate();
  const { base } = useEnlace();
  const [params] = useSearchParams();
  const volver = params.get("volver");
  const volverA = volver && volver.startsWith(base) ? volver : `${base}/lotes`;
  const ahora = useAhora(15_000);

  const [impresoras, setImpresoras] = useState<ImpresoraVista[] | null>(null);
  const [errorLista, setErrorLista] = useState<unknown>(null);
  const [elegida, setElegida] = useState(() => leerElegida(s.enlaceId));
  const [cantidad, setCantidad] = useState("10");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [trabajoId, setTrabajoId] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<TrabajoVista | null>(null);
  const [abiertas, setAbiertas] = useState<TrabajoVista[]>([]);

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

  const n = Number(cantidad);
  const valida = Number.isInteger(n) && n >= 1 && n <= IMPRESION_TOPE_ENLACE;
  const impresora = impresoras?.find((i) => i.id === elegida);

  async function imprimir() {
    if (!impresora || !valida) return;
    setEnviando(true);
    setError(null);
    setTrabajo(null);
    try {
      try {
        localStorage.setItem(claveImpresora(s.enlaceId), impresora.id);
      } catch {
        /* sin almacenamiento */
      }
      setTrabajoId(await pedirEtiquetas(s, impresora.id, n));
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  }

  const otrasAbiertas = abiertas.filter((t) => t.id !== trabajoId);

  return (
    <Pantalla
      titulo="Imprimir etiquetas"
      subtitulo="Etiquetas numeradas para cajas y paquetes"
      onVolver={() => navigate(volverA)}
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
          Impresoras).
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

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Cuántas</h2>
            <CampoPiezas valor={cantidad} onCambio={setCantidad} etiqueta="Cuántas etiquetas" />
            {!valida && cantidad !== "" && (
              <p className="text-sm text-destructive">De 1 a {IMPRESION_TOPE_ENLACE} por vez.</p>
            )}
          </section>

          {!!error && <AvisoError error={error} />}

          {trabajo && <EstadoOrden s={s} trabajo={trabajo} onError={setError} />}

          <BotonGrande onClick={() => void imprimir()} disabled={enviando || !impresora || !valida}>
            {enviando ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Printer className="mr-2 h-6 w-6" />}
            {valida ? `Imprimir ${plural(n, "etiqueta", "etiquetas")}` : "Imprimir"}
          </BotonGrande>

          {otrasAbiertas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Otras órdenes</h2>
              {otrasAbiertas.map((t) => (
                <EstadoOrden key={t.id} s={s} trabajo={t} onError={setError} />
              ))}
            </section>
          )}

          {trabajo?.estado === "impreso" && volver && (
            <Button variant="outline" className="h-12 w-full text-base" onClick={() => navigate(volverA)}>
              Volver al lote
            </Button>
          )}
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
  const tono = trabajo.estado === "impreso" ? "bien" : trabajo.estado === "error" ? "mal" : "info";
  return (
    <div data-estado-impresion={trabajo.estado}>
      <Aviso tono={tono}>
        <p className="flex items-center gap-2">
          {(trabajo.estado === "pendiente" || trabajo.estado === "imprimiendo") && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          )}
          <span>
            {plural(trabajo.cantidad ?? 0, "etiqueta", "etiquetas")}: {textoEstadoTrabajo(trabajo)}
          </span>
        </p>
        {trabajo.estado === "impreso" && <p className="mt-1 text-sm">Pégalas en las cajas y paquetes y escanéalas.</p>}
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

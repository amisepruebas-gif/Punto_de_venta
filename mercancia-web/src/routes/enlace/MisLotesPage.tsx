import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { totalesLote, type ResurtidoEstado, type Sucursal } from "@shared";
import { Button } from "@/components/ui/button";
import { useEnlace, usePantalla } from "@/features/enlace/EnlaceContext";
import { crearLote, listarMisLotes, seArma, type Lote } from "@/features/enlace/lotesService";
import { sucursalesDestino } from "@/features/enlace/catalogoService";
import {
  AvisoError,
  BotonGrande,
  Cargando,
  Pantalla,
  plural,
} from "@/features/enlace/ui";
import type { SesionEnlace } from "@/firebase/enlaceApp";

export function estadoDeLote(l: Pick<Lote, "estado" | "listo">): string {
  if (l.estado === "creando") return l.listo ? "Listo: espera al administrador" : "Armándose";
  const textos: Record<ResurtidoEstado, string> = {
    creando: "Armándose",
    enviado: "Enviado",
    parcial: "Recibido en parte",
    cerrado: "Recibido",
    en_transito: "En camino",
    recibido: "Recibido",
  };
  return textos[l.estado] ?? l.estado;
}

export function resumenTotales(l: Lote): string {
  const t = totalesLote(l);
  return `${plural(t.cajas, "caja", "cajas")} · ${plural(t.paquetes, "paquete", "paquetes")} · ${plural(t.piezas, "pza", "pzas")}`;
}

/** Lista de sucursales para elegir el destino. */
export function ElegirDestino({
  sesion,
  actualId,
  titulo,
  ocupado,
  onElegir,
  onCancelar,
}: {
  sesion: SesionEnlace;
  actualId?: string;
  titulo: string;
  ocupado?: boolean;
  onElegir: (s: Sucursal) => void;
  onCancelar: () => void;
}) {
  const [sucursales, setSucursales] = useState<Sucursal[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const cargar = useCallback(() => {
    setError(null);
    sucursalesDestino(sesion).then(setSucursales).catch(setError);
  }, [sesion]);
  useEffect(cargar, [cargar]);

  return (
    <Pantalla titulo={titulo} subtitulo="¿A qué sucursal va?" onVolver={onCancelar}>
      {error ? (
        <AvisoError error={error} onReintentar={cargar} />
      ) : !sucursales ? (
        <Cargando />
      ) : (
        <ul className="space-y-2">
          {sucursales.map((s) => (
            <li key={s.sucursalId}>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onElegir(s)}
                className={`flex min-h-16 w-full items-center gap-2 rounded-md border px-4 py-3 text-left text-lg active:bg-accent disabled:opacity-50 ${
                  s.sucursalId === actualId ? "border-primary bg-accent" : "bg-card"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.nombre}</span>
                  {s.modoMayoreo && (
                    <span className="block text-sm text-muted-foreground">Mayoreo</span>
                  )}
                </span>
                {s.sucursalId === actualId ? (
                  <span className="text-sm text-muted-foreground">Ahora</span>
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {ocupado && <Cargando texto="Guardando…" />}
    </Pantalla>
  );
}

type PantallaMisLotes = { tipo: "destino" };

/** Lotes de este acceso: los que se arman y, abajo, los ya listos. */
export function MisLotesPage() {
  const navigate = useNavigate();
  const { base, sesion } = useEnlace();
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<unknown>(null);
  const { pantalla, abrir, cerrar, irA } = usePantalla<PantallaMisLotes>();

  const cargar = useCallback(() => {
    if (!sesion || sesion.tipo !== "armar") return;
    setCargando(true);
    setError(null);
    listarMisLotes(sesion)
      .then(setLotes)
      .catch(setError)
      .finally(() => setCargando(false));
  }, [sesion]);
  useEffect(cargar, [cargar]);

  if (!sesion) return <Navigate to={base} replace />;
  if (sesion.tipo !== "armar") return <Navigate to={`${base}/fotos`} replace />;
  const s = sesion;

  async function nuevo(destino: Sucursal) {
    setCreando(true);
    setErrorCrear(null);
    try {
      const lote = await crearLote(
        s,
        { sucursalDestinoId: destino.sucursalId, sucursalDestinoNombre: destino.nombre },
        lotes ?? undefined,
      );
      setLotes((prev) => [lote, ...(prev ?? [])]);
      irA(`${base}/lotes/${encodeURIComponent(lote.id)}`);
    } catch (e) {
      setErrorCrear(e);
    } finally {
      setCreando(false);
    }
  }

  if (pantalla?.tipo === "destino") {
    return (
      <>
        <ElegirDestino
          sesion={s}
          titulo="Nuevo lote"
          ocupado={creando}
          onElegir={nuevo}
          onCancelar={cerrar}
        />
        {!!errorCrear && (
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-3">
            <AvisoError error={errorCrear} />
          </div>
        )}
      </>
    );
  }

  const enCurso = (lotes ?? []).filter(seArma);
  const otros = (lotes ?? []).filter((l) => !seArma(l));

  const tarjeta = (l: Lote) => (
    <li key={l.id}>
      <button
        type="button"
        onClick={() => navigate(`${base}/lotes/${encodeURIComponent(l.id)}`)}
        className="flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left active:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-lg font-semibold">{l.folio ?? l.id}</p>
          <p className="truncate text-base">→ {l.sucursalDestinoNombre}</p>
          <p className="truncate text-sm text-muted-foreground">{resumenTotales(l)}</p>
          {!seArma(l) && <p className="text-sm font-medium">{estadoDeLote(l)}</p>}
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );

  return (
    <Pantalla
      titulo="Mis lotes"
      subtitulo={s.nombre || undefined}
      derecha={
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          onClick={cargar}
          disabled={cargando}
          aria-label="Actualizar"
        >
          {cargando ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCw className="h-6 w-6" />}
        </Button>
      }
    >
      <BotonGrande
        onClick={() => {
          setErrorCrear(null);
          abrir({ tipo: "destino" });
        }}
        disabled={!lotes}
      >
        <Plus className="mr-2 h-6 w-6" /> Nuevo lote
      </BotonGrande>

      {error ? (
        <AvisoError error={error} onReintentar={cargar} />
      ) : !lotes ? (
        <Cargando />
      ) : lotes.length === 0 ? (
        <p className="py-6 text-center text-base text-muted-foreground">
          Todavía no hay lotes. Toca "Nuevo lote" para empezar.
        </p>
      ) : (
        <>
          {enCurso.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Armándose</h2>
              <ul className="space-y-2">{enCurso.map(tarjeta)}</ul>
            </section>
          )}
          {otros.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Listos y enviados</h2>
              <p className="text-sm text-muted-foreground">Solo se pueden ver.</p>
              <ul className="space-y-2">{otros.map(tarjeta)}</ul>
            </section>
          )}
        </>
      )}
    </Pantalla>
  );
}

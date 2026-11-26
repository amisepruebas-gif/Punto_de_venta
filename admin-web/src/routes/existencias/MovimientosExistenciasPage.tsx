import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { ArrowRightLeft, ChevronDown, Loader2 } from "lucide-react";
import { db } from "@/firebase/config";
import { Label } from "@/components/ui/label";
import { useNegocio } from "@/hooks/useNegocio";
import { useArticulos } from "@/features/articulos/useArticulos";
import { Miniatura } from "@/features/articulos/Miniatura";
import { useSucursales } from "@/features/sucursales/useSucursales";
import {
  paths,
  type DireccionMovimientoExistencias,
  type MovimientoExistencias,
} from "@shared";

const MAXIMO = 100;

const ETIQUETA_DIRECCION: Record<DireccionMovimientoExistencias, string> = {
  bodega_a_tienda: "Bodega → Tienda",
  tienda_a_bodega: "Tienda → Bodega",
};

const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** `fecha` (ISO en UTC) en hora de la Ciudad de México. */
function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : FECHA_HORA.format(d);
}

const SELECT_CLS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Movimientos de piezas entre la bodega y la tienda de una sucursal de
 * mayoreo: quién, cuándo, hacia dónde y cómo quedó cada artículo. Los
 * registra la function `moverExistencias` (nadie más puede escribirlos).
 */
export function MovimientosExistenciasPage() {
  const { negocioId } = useNegocio();
  const { sucursales, loading: cargandoSucursales } = useSucursales();
  const tiendas = useMemo(() => sucursales.filter((s) => s.modoMayoreo), [sucursales]);
  // Foto de cada artículo final (la de la variación o, si no tiene, la del
  // artículo), para la miniatura de cada renglón.
  const { articulos } = useArticulos();
  const fotos = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of articulos) {
      if (a.imagenUrl) m.set(a.id, a.imagenUrl);
      for (const sv of a.subvariaciones ?? []) {
        const url = sv.imagenUrl ?? a.imagenUrl;
        if (url && sv.codigo) m.set(`${a.id}|${sv.codigo}`, url);
      }
    }
    return m;
  }, [articulos]);
  const [sucursalId, setSucursalId] = useState("");
  const [movimientos, setMovimientos] = useState<MovimientoExistencias[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quien, setQuien] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    if (!sucursalId && tiendas.length > 0) setSucursalId(tiendas[0]!.sucursalId);
  }, [tiendas, sucursalId]);

  useEffect(() => {
    setMovimientos([]);
    setQuien("");
    setAbierto(null);
    if (!negocioId || !sucursalId) return;
    setCargando(true);
    return onSnapshot(
      query(
        collection(db, paths.movimientosExistenciasCol(negocioId, sucursalId)),
        orderBy("creadoEn", "desc"),
        limit(MAXIMO),
      ),
      (snap) => {
        setMovimientos(snap.docs.map((d) => d.data() as MovimientoExistencias));
        setError(null);
        setCargando(false);
      },
      (e) => {
        console.error("MovimientosExistenciasPage:", e);
        setError("No se pudieron leer los movimientos.");
        setCargando(false);
      },
    );
  }, [negocioId, sucursalId]);

  const personas = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of movimientos) m.set(x.usuarioId, x.usuarioNombre || x.usuarioId);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [movimientos]);
  const visibles = quien ? movimientos.filter((m) => m.usuarioId === quien) : movimientos;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-xl font-semibold">Movimientos de existencias</h1>
        <p className="text-xs text-muted-foreground">
          Lo que el encargado de cada tienda de mayoreo movió entre su bodega y su tienda. Un
          movimiento no crea ni quita piezas: lo que sale de un lado entra al otro.
        </p>
      </div>

      {!cargandoSucursales && tiendas.length === 0 ? (
        <p className="rounded-md border bg-muted p-4 text-center text-sm text-muted-foreground">
          No hay sucursales de mayoreo. Márcala en Sucursales.
        </p>
      ) : (
        <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 sm:p-5">
          <div className="space-y-1.5">
            <Label htmlFor="mov-sucursal">Tienda</Label>
            <select
              id="mov-sucursal"
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className={SELECT_CLS}
            >
              {tiendas.map((s) => (
                <option key={s.sucursalId} value={s.sucursalId}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mov-quien">Quién</Label>
            <select
              id="mov-quien"
              value={quien}
              onChange={(e) => setQuien(e.target.value)}
              disabled={personas.length === 0}
              className={SELECT_CLS}
            >
              <option value="">Todos</option>
              {personas.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {cargando && (
        <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}
      {!cargando && !error && sucursalId && visibles.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <ArrowRightLeft className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay movimientos.</p>
        </div>
      )}

      <ul className="space-y-2">
        {visibles.map((m) => {
          const estaAbierto = abierto === m.movimientoId;
          return (
            <li key={m.movimientoId} className="overflow-hidden rounded-md border bg-card">
              <button
                type="button"
                onClick={() => setAbierto(estaAbierto ? null : m.movimientoId)}
                aria-expanded={estaAbierto}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ETIQUETA_DIRECCION[m.direccion]}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fechaHora(m.fecha)} · {m.usuarioNombre || m.usuarioId}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {m.piezas} {m.piezas === 1 ? "pieza" : "piezas"}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    estaAbierto ? "rotate-180" : ""
                  }`}
                />
              </button>
              {estaAbierto && (
                <div className="overflow-x-auto border-t p-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">Artículo</th>
                        <th className="py-1 pr-3 font-medium">Código</th>
                        <th className="py-1 pr-3 text-right font-medium">Piezas</th>
                        <th className="py-1 pr-3 text-right font-medium">Bodega</th>
                        <th className="py-1 text-right font-medium">Tienda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.renglones.map((r) => (
                        <tr
                          key={`${r.articuloId}|${r.subvariacionCodigo ?? ""}`}
                          className="border-b last:border-0"
                        >
                          <td className="py-1.5 pr-3">
                            <span className="flex items-center gap-2">
                              <Miniatura
                                url={fotos.get(
                                  r.subvariacionCodigo
                                    ? `${r.articuloId}|${r.subvariacionCodigo}`
                                    : r.articuloId,
                                )}
                                alt={r.nombre}
                                size={32}
                              />
                              <span className="min-w-0">{r.nombre}</span>
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 font-mono">{r.codigo}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.piezas}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {r.bodegaAntes} → <strong>{r.bodegaDespues}</strong>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {r.tiendaAntes} → <strong>{r.tiendaDespues}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {movimientos.length === MAXIMO && (
        <p className="text-center text-xs text-muted-foreground">
          Se muestran los últimos {MAXIMO}.
        </p>
      )}
    </div>
  );
}

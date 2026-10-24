import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MinusCircle, Pencil, PlusCircle, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArticulo } from "@/features/articulos/useArticulos";
import { useResurtidos } from "@/features/resurtidos/useResurtidos";
import { useZonasPrecio } from "@/features/zonas-precio/useZonasPrecio";
import { resumenZona } from "@/features/zonas-precio/zonaPrecioService";
import {
  TALLER_ID,
  useAjustesArticulo,
  useLotesProduccion,
  useUbicaciones,
} from "@/features/fabricacion/useFabricacion";
import {
  calcularExistencias,
  embarqueAbierto,
} from "@/features/fabricacion/existenciasFabricado";
import {
  ReducirExistenciaModal,
  type UbicacionConStock,
} from "@/features/fabricacion/ReducirExistenciaModal";
import type { PrefillResurtido } from "@/features/resurtidos/prefill";
import { MOTIVOS_AJUSTE } from "@shared";

const ESTADO_EMBARQUE: Record<string, string> = {
  creando: "Armando",
  en_transito: "En tránsito",
  recibido: "Recibido",
  cerrado: "Cerrado",
};

type Evento = {
  clave: string;
  fecha: string;
  titulo: string;
  detalle: string;
  delta: number | null;
  enlace?: string;
};

/** Detalle de un artículo fabricado: dónde está cada pieza y su historial
 *  (producción, embarques y reducciones con motivo). */
export function FabricadoDetallePage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { articulo, loading } = useArticulo(id);
  const { resurtidos } = useResurtidos();
  const { lotes } = useLotesProduccion();
  const { ajustes } = useAjustesArticulo(id);
  const { zonas } = useZonasPrecio();
  const { sucursales, defaultSucursalId } = useUbicaciones();
  const [reduciendo, setReduciendo] = useState(false);

  const existencias = useMemo(
    () =>
      articulo
        ? calcularExistencias(articulo, sucursales, defaultSucursalId, resurtidos)
        : null,
    [articulo, sucursales, defaultSucursalId, resurtidos],
  );

  const eventos = useMemo<Evento[]>(() => {
    const ev: Evento[] = [];
    for (const l of lotes) {
      if (l.articuloId !== id) continue;
      ev.push({
        clave: `l-${l.loteId}`,
        fecha: l.fechaRegistro,
        titulo: `${l.esAlta ? "Alta" : "Producción"} ${l.folio}`,
        detalle: `${l.fechaProduccion} → ${l.destinoNombre} · ${l.usuario}${l.notas ? ` · ${l.notas}` : ""}`,
        delta: l.cantidad,
      });
    }
    for (const a of ajustes) {
      ev.push({
        clave: `a-${a.ajusteId}`,
        fecha: a.fecha,
        titulo: `Reducción · ${MOTIVOS_AJUSTE[a.motivo]}${a.motivoDetalle ? `: ${a.motivoDetalle}` : ""}`,
        detalle: `${a.ubicacionNombre} (${a.cantidadAnterior} → ${a.cantidadNueva}) · ${a.usuario}`,
        delta: a.delta,
      });
    }
    for (const r of resurtidos) {
      const piezas = r.lineas
        .filter((l) => l.articuloId === id)
        .reduce((acc, l) => acc + l.cantidadEnviada, 0);
      if (piezas === 0) continue;
      ev.push({
        clave: `r-${r.id}`,
        fecha: r.fechaCreacion,
        titulo: `Embarque a ${r.sucursalDestinoNombre} · ${ESTADO_EMBARQUE[r.estado] ?? r.estado}`,
        detalle: `${piezas} pz · empacó ${r.responsableEmpaco}`,
        delta: null,
        enlace: `/resurtidos/${r.id}`,
      });
    }
    return ev.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [lotes, ajustes, resurtidos, id]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!articulo || !existencias) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Artículo no encontrado.</p>;
  }

  const zona = zonas.find((z) => z.zonaId === articulo.zonaPrecioId);
  const conStock: UbicacionConStock[] = [
    { id: TALLER_ID, nombre: "Taller", cantidad: existencias.taller },
    ...existencias.sucursales.map((s) => ({
      id: s.sucursalId,
      nombre: s.nombre,
      cantidad: s.cantidad,
    })),
  ].filter((u) => u.cantidad > 0);
  const prefill: PrefillResurtido = {
    lineas: [
      {
        articuloId: articulo.id,
        nombreSnapshot: articulo.nombre,
        ...(articulo.sigla ? { siglaSnapshot: articulo.sigla } : {}),
        cantidadEnviada: Math.max(1, existencias.taller),
      },
    ],
  };
  const embarquesAbiertos = resurtidos.filter(
    (r) => embarqueAbierto(r) && r.lineas.some((l) => l.articuloId === articulo.id),
  ).length;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/fabricacion/articulos")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Artículos fabricados
      </Button>

      <section className="flex flex-wrap gap-4 rounded-lg border bg-card p-4">
        {articulo.imagenUrl ? (
          <img src={articulo.imagenUrl} alt="" className="h-28 w-28 rounded-md object-cover" />
        ) : (
          <div className="h-28 w-28 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-xl font-semibold">{articulo.nombre}</h2>
          <p className="font-mono text-xs text-muted-foreground">#{articulo.id}</p>
          <p className="text-sm">
            {zona ? `${zona.nombre}: ${resumenZona(zona)}` : `$${articulo.precioVenta}`}
          </p>
          {articulo.soloMayoreo && (
            <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Solo mayoreo
            </span>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
          <Button asChild size="sm">
            <Link to={`/fabricacion/registrar?articuloId=${articulo.id}`}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar producción
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={existencias.taller === 0}
            onClick={() => navigate("/resurtidos/nuevo", { state: { prefillResurtido: prefill } })}
          >
            <Send className="mr-2 h-4 w-4" /> Enviar a sucursal
          </Button>
          <Button size="sm" variant="outline" onClick={() => setReduciendo(true)}>
            <MinusCircle className="mr-2 h-4 w-4" /> Reducir existencia
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/fabricacion/etiquetas?articuloId=${articulo.id}`}>
              <Printer className="mr-2 h-4 w-4" /> Etiquetas
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/articulos/${articulo.id}`}>
              <Pencil className="mr-2 h-4 w-4" /> Editar datos
            </Link>
          </Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-base font-semibold">¿Dónde está cada pieza?</h3>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Cuadro titulo="Taller" valor={existencias.taller} />
          <Cuadro
            titulo="En tránsito"
            valor={existencias.enTransito}
            nota={embarquesAbiertos ? `${embarquesAbiertos} embarque(s) sin cerrar` : undefined}
          />
          {existencias.sucursales.map((s) => (
            <Cuadro key={s.sucursalId} titulo={s.nombre} valor={s.cantidad} />
          ))}
          <Cuadro titulo="Total" valor={existencias.total} fuerte />
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <h3 className="border-b px-4 py-2 text-base font-semibold">Historial</h3>
        {eventos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="divide-y">
            {eventos.map((e) => (
              <li key={e.clave} className="flex items-start gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  {e.enlace ? (
                    <Link to={e.enlace} className="font-medium hover:underline">{e.titulo}</Link>
                  ) : (
                    <p className="font-medium">{e.titulo}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{e.detalle}</p>
                </div>
                {e.delta !== null && (
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      e.delta > 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {e.delta > 0 ? `+${e.delta}` : e.delta}
                  </span>
                )}
                <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                  {e.fecha.slice(0, 16)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reduciendo && (
        <ReducirExistenciaModal
          articulo={articulo}
          ubicaciones={conStock}
          onClose={() => setReduciendo(false)}
        />
      )}
    </div>
  );
}

function Cuadro({
  titulo,
  valor,
  nota,
  fuerte = false,
}: {
  titulo: string;
  valor: number;
  nota?: string;
  fuerte?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${fuerte ? "bg-muted/40" : ""}`}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={`tabular-nums ${fuerte ? "text-2xl font-bold" : "text-xl font-semibold"}`}>
        {valor}
      </p>
      {nota && <p className="text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

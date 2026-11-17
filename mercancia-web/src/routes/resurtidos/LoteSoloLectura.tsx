import { useEffect, useMemo, useState } from "react";
import { Box, ChevronLeft, Info, Package } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import {
  cajasOrdenadas,
  claveArticulo,
  contenidoDePaquete,
  declaradoPorArticulo,
  etiquetaLoteLegible,
  infoArticuloLote,
  paquetesDeCaja,
  partirClaveArticulo,
  paths,
  resumenLote,
  sueltasDeCaja,
  totalesLote,
  type Articulo,
  type Resurtido,
} from "@shared";
import { Button } from "@/components/ui/button";
import { db } from "@/firebase/config";

const ESTADO_LOTE: Record<string, string> = {
  creando: "Armándose",
  enviado: "Enviado",
  parcial: "Recibido en parte",
  cerrado: "Cerrado",
};

/**
 * Nombres de los artículos del lote. Un lote enviado trae `lineas` con el
 * nombre de cada uno; uno que se arma todavía no (`lineas: []`), así que
 * los que falten se leen por su código.
 */
function useNombres(negocioId: string | null, lote: Resurtido) {
  const [leidos, setLeidos] = useState<Map<string, Articulo>>(new Map());
  const claves = useMemo(() => [...declaradoPorArticulo(lote).keys()], [lote]);

  const deLineas = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lote.lineas ?? []) {
      m.set(claveArticulo(l.articuloId, l.subvariacionCodigo), l.nombreSnapshot);
    }
    return m;
  }, [lote]);

  useEffect(() => {
    if (!negocioId) return;
    const faltan = [
      ...new Set(
        claves.filter((k) => !deLineas.has(k)).map((k) => partirClaveArticulo(k).articuloId),
      ),
    ].filter((id) => !leidos.has(id));
    if (faltan.length === 0) return;
    let vivo = true;
    Promise.all(
      faltan.map((id) =>
        getDoc(doc(db, paths.articulo(negocioId, id)))
          .then((s) => (s.exists() ? ([id, s.data() as Articulo] as const) : null))
          .catch(() => null),
      ),
    ).then((rs) => {
      if (!vivo) return;
      setLeidos((prev) => {
        const m = new Map(prev);
        for (const r of rs) if (r) m.set(r[0], r[1]);
        return m;
      });
    });
    return () => {
      vivo = false;
    };
    // `leidos` no va: solo se piden los que faltan al cambiar el lote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, claves, deLineas]);

  return (articuloId: string, sub?: string): string => {
    const k = claveArticulo(articuloId, sub);
    return (
      deLineas.get(k) ??
      infoArticuloLote(leidos.get(articuloId), sub)?.nombre ??
      sub ??
      articuloId
    );
  };
}

/**
 * Un lote de envío visto desde mercancía: SOLO LECTURA. Se arma desde el
 * teléfono (enlace), se confirma en admin y lo recibe la caja; aquí no hay
 * botones del flujo viejo de resurtidos.
 */
export function LoteSoloLectura({
  lote,
  negocioId,
  onVolver,
}: {
  lote: Resurtido;
  negocioId: string | null;
  onVolver: () => void;
}) {
  const nombre = useNombres(negocioId, lote);
  const totales = totalesLote(lote);
  const resumen = useMemo(() => resumenLote(lote), [lote]);
  const cajas = cajasOrdenadas(lote);
  const enviado = lote.estado !== "creando";
  const estado =
    lote.estado === "creando" && lote.listo ? "Listo, falta enviar" : (ESTADO_LOTE[lote.estado] ?? lote.estado);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <Button variant="ghost" size="icon" onClick={onVolver} aria-label="Volver" className="-ml-1">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 truncate text-base font-semibold">
          Lote <span className="font-mono">{lote.folio ?? lote.id}</span>
        </h1>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
          {estado}
        </span>
      </header>

      <main className="flex-1 space-y-4 px-3 pb-10 pt-3">
        <p className="flex items-start gap-2 rounded-md border bg-muted p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Este envío es un lote: se confirma y se sigue en admin.
        </p>

        <section className="space-y-2 rounded-lg border bg-card p-3 text-sm">
          <p className="font-semibold">→ {lote.sucursalDestinoNombre}</p>
          <p>
            {totales.cajas} caja{totales.cajas === 1 ? "" : "s"} · {totales.paquetes} paquete
            {totales.paquetes === 1 ? "" : "s"} · {totales.piezas} pza{totales.piezas === 1 ? "" : "s"} ·{" "}
            {totales.articulos} artículo{totales.articulos === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Dato label="Armó" value={lote.responsableEmpaco} />
            <Dato label="Paquetería" value={lote.paqueteria} />
            <Dato label="Creado" value={lote.fechaCreacion?.slice(0, 16)} />
            <Dato label="Listo" value={lote.fechaListo?.slice(0, 16)} />
            <Dato label="Enviado" value={lote.fechaEnTransito?.slice(0, 16)} />
            <Dato label="Recibido" value={lote.fechaRecibido?.slice(0, 16)} />
          </div>
        </section>

        {enviado && (
          <section className="space-y-2 rounded-lg border bg-card p-3">
            <h3 className="text-sm font-semibold">Recepción</h3>
            <p className="text-xs text-muted-foreground">
              Paquetes {resumen.paquetesRecibidos + resumen.paquetesDanados} de {resumen.paquetesTotal}
              {" · "}bien {resumen.totales.bien} · dañadas {resumen.totales.danado} · no llegó{" "}
              {resumen.totales.noLlego} · faltan {resumen.totales.pendiente}
            </p>
            <ul className="divide-y text-sm">
              {[...resumen.porArticulo].map(([clave, c]) => {
                const { articuloId, subvariacionCodigo } = partirClaveArticulo(clave);
                return (
                  <li key={clave} className="flex items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{nombre(articuloId, subvariacionCodigo)}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {c.bien + c.danado + c.noLlego} de {c.declarado}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {cajas.length === 0 ? (
          <p className="rounded-md border bg-muted py-6 text-center text-sm text-muted-foreground">
            Todavía no tiene cajas.
          </p>
        ) : (
          cajas.map(({ llave, caja }) => {
            const paquetes = paquetesDeCaja(lote, llave);
            const sueltas = sueltasDeCaja(lote, llave);
            const guia = lote.guias?.[llave];
            return (
              <section key={llave} className="space-y-2 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <h3 className="flex-1 text-sm font-semibold">Caja {caja.orden}</h3>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {etiquetaLoteLegible(caja.codigo)}
                  </span>
                </div>
                {guia && <p className="text-xs text-muted-foreground">Guía: {guia}</p>}
                <ul className="space-y-1.5 text-sm">
                  {paquetes.map(({ llave: k, paquete }) => {
                    const estadoP = resumen.paquetes.get(k)?.estado;
                    return (
                      <li key={k} className="flex items-start gap-2 rounded-md border bg-background p-2">
                        <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {etiquetaLoteLegible(paquete.codigo)}
                            {enviado && estadoP === "recibido" ? " · recibido" : ""}
                            {enviado && estadoP === "danado" ? " · dañado" : ""}
                          </p>
                          <p>
                            {[...contenidoDePaquete(paquete)]
                              .map(([clave, n]) => {
                                const p = partirClaveArticulo(clave);
                                return `${n} × ${nombre(p.articuloId, p.subvariacionCodigo)}`;
                              })
                              .join(", ")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  {sueltas.map(({ llave: k, suelta }) => (
                    <li key={k} className="rounded-md border border-dashed bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">Sueltas</p>
                      <p>
                        {suelta.piezas} × {nombre(suelta.articuloId, suelta.subvariacionCodigo)}
                      </p>
                    </li>
                  ))}
                  {paquetes.length === 0 && sueltas.length === 0 && (
                    <li className="text-xs text-muted-foreground">Vacía</li>
                  )}
                </ul>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

function Dato({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate">{value || "—"}</p>
    </div>
  );
}

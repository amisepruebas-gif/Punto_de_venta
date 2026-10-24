import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Factory, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLotesProduccion } from "@/features/fabricacion/useFabricacion";
import { ymdPaddedMX, type LoteProduccion } from "@shared";

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymdPaddedMX(d);
}

/** Historial de producción por fechas: cada lote con su folio único. */
export function ProduccionPage() {
  const navigate = useNavigate();
  const { lotes, loading } = useLotesProduccion();
  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(ymdPaddedMX());
  const [q, setQ] = useState("");

  const porDia = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const filtrados = lotes.filter(
      (l) =>
        (!desde || l.fechaProduccion >= desde) &&
        (!hasta || l.fechaProduccion <= hasta) &&
        (!texto ||
          l.nombreSnapshot.toLowerCase().includes(texto) ||
          l.folio.toLowerCase().includes(texto) ||
          l.articuloId.includes(texto)),
    );
    const grupos = new Map<string, LoteProduccion[]>();
    for (const l of filtrados) {
      const g = grupos.get(l.fechaProduccion) ?? [];
      g.push(l);
      grupos.set(l.fechaProduccion, g);
    }
    return [...grupos.entries()];
  }, [lotes, desde, hasta, q]);

  const totalPiezas = porDia.reduce(
    (acc, [, ls]) => acc + ls.reduce((a, l) => a + l.cantidad, 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="prod-desde" className="text-xs">Desde</Label>
          <Input id="prod-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prod-hasta" className="text-xs">Hasta</Label>
          <Input id="prod-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="prod-q" className="text-xs">Buscar</Label>
          <Input id="prod-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artículo o folio (FAB-…)" />
        </div>
        <Button onClick={() => navigate("/fabricacion/registrar")}>
          <Plus className="mr-2 h-4 w-4" /> Registrar producción
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : porDia.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Factory className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sin producción en estas fechas.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {totalPiezas} pz en {porDia.reduce((a, [, ls]) => a + ls.length, 0)} lotes
          </p>
          {porDia.map(([dia, ls]) => (
            <section key={dia} className="rounded-lg border bg-card">
              <header className="flex items-center justify-between border-b px-4 py-2">
                <h3 className="text-sm font-semibold">{dia}</h3>
                <span className="text-xs text-muted-foreground">
                  {ls.reduce((a, l) => a + l.cantidad, 0)} pz
                </span>
              </header>
              <ul className="divide-y">
                {ls.map((l) => (
                  <li key={l.loteId} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{l.folio}</span>
                    <Link
                      to={`/fabricacion/articulos/${l.articuloId}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {l.nombreSnapshot}
                    </Link>
                    {l.esAlta && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        Alta
                      </span>
                    )}
                    <span className="tabular-nums font-semibold">{l.cantidad} pz</span>
                    <span className="text-xs text-muted-foreground">→ {l.destinoNombre}</span>
                    <span className="text-xs text-muted-foreground">{l.usuario}</span>
                    <Button asChild size="sm" variant="ghost" title="Imprimir etiquetas de este lote">
                      <Link to={`/fabricacion/etiquetas?articuloId=${l.articuloId}&cantidad=${l.cantidad}`}>
                        <Printer className="h-4 w-4" />
                      </Link>
                    </Button>
                    {l.notas && (
                      <p className="w-full text-xs text-muted-foreground">{l.notas}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

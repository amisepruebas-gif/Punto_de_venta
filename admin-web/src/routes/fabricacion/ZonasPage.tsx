import { useMemo, useState } from "react";
import { Pencil, Plus, Power, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNegocio } from "@/hooks/useNegocio";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCategorias } from "@/features/categorias/useCategorias";
import { useZonasPrecio } from "@/features/zonas-precio/useZonasPrecio";
import { ZonaFormModal } from "@/features/zonas-precio/ZonaFormModal";
import {
  activarZona,
  resumenZona,
} from "@/features/zonas-precio/zonaPrecioService";
import type { ZonaPrecio } from "@shared";

/** Zonas de precios: precio normal + mayoreo compartido por varios
 *  artículos. Cambiar una zona cambia todos sus artículos. */
export function ZonasPage() {
  const { negocioId } = useNegocio();
  const { zonas, loading } = useZonasPrecio();
  const { articulos } = useArticulos();
  const { categorias } = useCategorias();
  const [modal, setModal] = useState<{ editando: ZonaPrecio | null } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const usoPorZona = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of articulos) {
      if (a.zonaPrecioId) m.set(a.zonaPrecioId, (m.get(a.zonaPrecioId) ?? 0) + 1);
    }
    return m;
  }, [articulos]);
  const nombreCategoria = (id?: string) =>
    categorias.find((c) => c.categoriaId === id)?.nombre;

  async function alternar(z: ZonaPrecio) {
    if (!negocioId) return;
    setError(null);
    try {
      await activarZona(negocioId, z.zonaId, !z.activa);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada zona tiene un precio normal y hasta 3 precios de mayoreo. Las
          piezas de artículos distintos de la misma zona se suman para llegar
          al mayoreo. Si cambias una zona, todos sus artículos se actualizan
          solos.
        </p>
        <Button onClick={() => setModal({ editando: null })}>
          <Plus className="mr-2 h-4 w-4" /> Nueva zona
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : zonas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Tags className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Aún no hay zonas. Crea la primera (ej. "Llaveros": $35, 10 pz a
            $30, 25 pz a $27, 40 pz a $24).
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {zonas.map((z) => {
            const uso = usoPorZona.get(z.zonaId) ?? 0;
            const cat = nombreCategoria(z.categoriaId);
            return (
              <div
                key={z.zonaId}
                className={`rounded-lg border bg-card p-4 ${z.activa ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{z.nombre}</h3>
                    <p className="text-sm tabular-nums">{resumenZona(z)}</p>
                    <p className="text-xs text-muted-foreground">
                      {uso} {uso === 1 ? "artículo" : "artículos"}
                      {cat ? ` · ${cat}` : ""}
                    </p>
                  </div>
                  {!z.activa && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModal({ editando: z })}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => alternar(z)}>
                    <Power className="mr-1 h-3 w-3" />
                    {z.activa ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <ZonaFormModal editando={modal.editando} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

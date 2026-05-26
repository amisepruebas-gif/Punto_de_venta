import { useEffect, useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useApartadosSucursal } from "@/features/apartados-admin/useApartadosAdmin";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Apartado, EstadoApartado } from "@shared";

export function ApartadosPage() {
  const { sucursales } = useSucursales();
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  // FIX H4: sync con la primera sucursal cuando cargan async.
  useEffect(() => {
    if (!sucursalId && sucursales.length > 0) {
      setSucursalId(sucursales[0].sucursalId);
    }
  }, [sucursales, sucursalId]);
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoApartado | "todos">(
    "pendiente",
  );

  const { apartados, loading } = useApartadosSucursal(sucursalId);

  const filtrados = useMemo(() => {
    if (estadoFiltro === "todos") return apartados;
    return apartados.filter((a) => a.estado === estadoFiltro);
  }, [apartados, estadoFiltro]);

  return (
    <div className="container max-w-5xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Apartados</h1>
        <p className="text-sm text-muted-foreground">
          Apartados y abonos por sucursal
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Sucursal</Label>
          <select
            value={sucursalId ?? ""}
            onChange={(e) => setSucursalId(e.target.value || null)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <div className="flex flex-wrap gap-1">
            {(
              ["todos", "pendiente", "parcial", "completo", "cancelado"] as const
            ).map((e) => (
              <Button
                key={e}
                size="sm"
                variant={estadoFiltro === e ? "default" : "outline"}
                onClick={() => setEstadoFiltro(e)}
              >
                {e}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Sin apartados</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtrados.map((a) => (
            <ApartadoCard key={a.apartadoId} apartado={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApartadoCard({ apartado }: { apartado: Apartado }) {
  const pagado = apartado.abonos.reduce((acc, ab) => acc + ab.monto, 0);
  const saldo = Math.max(0, apartado.totalApartado - pagado);

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{apartado.cliente}</h3>
          {apartado.telefonoCliente && (
            <p className="text-xs text-muted-foreground">
              {apartado.telefonoCliente}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {apartado.fechaCreacion}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {apartado.estado}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/50 p-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold">${apartado.totalApartado.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="font-semibold">${pagado.toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className="font-semibold">${saldo.toFixed(0)}</p>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          {apartado.articulos.length} artículo(s) · {apartado.abonos.length} abono(s)
        </summary>
        <ul className="mt-2 space-y-1">
          {apartado.articulos.map((art, i) => (
            <li key={i} className="flex justify-between text-xs">
              <span>
                {art.cantidad}× {art.nombre}
              </span>
              <span>${(art.cantidad * art.precio).toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

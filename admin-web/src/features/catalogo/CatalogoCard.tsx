import { Package } from "lucide-react";
import { resolverEscalones, type Articulo } from "@shared";

/** Tarjeta del catálogo: foto, nombre, código, existencia en la sucursal,
 *  precio y precios de mayoreo. */
export function CatalogoCard({
  articulo,
  existencia,
}: {
  articulo: Articulo;
  existencia: number;
}) {
  const escalones = resolverEscalones(articulo);
  const variaciones = articulo.subvariaciones?.length ?? 0;
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card">
      {articulo.imagenUrl ? (
        <img
          src={articulo.imagenUrl}
          alt={articulo.nombre}
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex aspect-square items-center justify-center bg-muted">
          <Package className="h-10 w-10 text-muted-foreground/40" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h4 className="line-clamp-2 text-sm font-semibold leading-tight">
          {articulo.nombre}
        </h4>
        <p className="font-mono text-[11px] text-muted-foreground">
          #{articulo.id}
          {variaciones > 0 ? ` · ${variaciones} variaciones` : ""}
        </p>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <span className="text-base font-bold">${articulo.precioVenta}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
              existencia > 0
                ? "bg-emerald-100 text-emerald-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {existencia} pz
          </span>
        </div>
        {escalones.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-orange-800">
            {escalones.map((e) => (
              <li key={e.minPz}>
                {e.minPz}+ pz: ${e.precio} c/u
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

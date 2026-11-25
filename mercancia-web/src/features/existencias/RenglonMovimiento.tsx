import type { RenglonMovimientoExistencias } from "@shared";

/** Un artículo de un movimiento: cuántas piezas y cómo quedaron la bodega
 *  y la tienda (antes → después). */
export function RenglonMovimiento({ renglon: r }: { renglon: RenglonMovimientoExistencias }) {
  return (
    <li className="rounded-md border bg-background p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium">{r.nombre}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {r.codigo}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {r.piezas} pz
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
        <AntesDespues etiqueta="Bodega" antes={r.bodegaAntes} despues={r.bodegaDespues} />
        <AntesDespues etiqueta="Tienda" antes={r.tiendaAntes} despues={r.tiendaDespues} />
      </div>
    </li>
  );
}

function AntesDespues({
  etiqueta,
  antes,
  despues,
}: {
  etiqueta: string;
  antes: number;
  despues: number;
}) {
  return (
    <p className="rounded bg-muted px-2 py-1">
      <span className="text-muted-foreground">{etiqueta} </span>
      <span className="tabular-nums">
        {antes} → <strong>{despues}</strong>
      </span>
    </p>
  );
}

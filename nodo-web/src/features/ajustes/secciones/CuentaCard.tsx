import { User } from "lucide-react";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useSucursal } from "@/features/sucursal/useSucursal";

/** Tarjeta con info del nodo / sesión. */
export function CuentaCard() {
  const { session } = useNodoSession();
  const { sucursal } = useSucursal();

  return (
    <section className="space-y-2 rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Nodo</h3>
      </div>
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Nombre: </span>
          {session?.nombreNodo ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Sucursal: </span>
          {sucursal?.nombre ?? session?.sucursalId ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">ID: </span>
          <span className="font-mono text-xs">
            {session?.nodoId?.slice(0, 16) ?? "—"}…
          </span>
        </p>
      </div>
    </section>
  );
}

import { useEffect } from "react";
import { useEquipo } from "@/features/equipo/useEquipo";
import { useCarrito } from "./carritoStore";
import { Button } from "@/components/ui/button";

type Props = {
  className?: string;
};

export function SelectorVendedor({ className = "" }: Props) {
  const { equipo, loading } = useEquipo();
  const { enTurno, setVendedor } = useCarrito();

  // Auto-clear de `enTurno` fantasma: si el admin eliminó al vendedor de
  // equipo pero el nombre sigue en localStorage, lo limpiamos en cuanto
  // el equipo termine de cargar. Sin esto el `<select>` mostraría un
  // value sin option correspondiente y el cajero quedaría atrapado.
  useEffect(() => {
    if (loading || equipo.length === 0) return;
    if (enTurno && !equipo.some((e) => e.nombre === enTurno)) {
      setVendedor("", undefined);
    }
  }, [loading, equipo, enTurno, setVendedor]);

  if (loading) {
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        Cargando equipo…
      </span>
    );
  }

  const sinEquipo = equipo.length === 0;
  const unico = equipo.length === 1;
  const multi = equipo.length > 1;

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      <span className="shrink-0 text-xs text-muted-foreground">En turno:</span>
      {sinEquipo && (
        <span className="shrink-0 text-xs text-muted-foreground">
          (sin equipo)
        </span>
      )}
      {unico && (
        <Button
          size="sm"
          onClick={() =>
            setVendedor(equipo[0]!.nombre, equipo[0]!.idUsuario)
          }
          className={`h-7 shrink-0 rounded-full border border-white/30 backdrop-blur-sm transition-colors ${
            enTurno === equipo[0]!.nombre
              ? "bg-white/70 text-foreground hover:bg-white/80"
              : "bg-white/20 text-foreground hover:bg-white/40"
          }`}
        >
          {equipo[0]!.nombre}
        </Button>
      )}
      {multi && (
        <select
          value={enTurno ?? ""}
          onChange={(ev) => {
            const nombre = ev.target.value;
            if (!nombre) return;
            const m = equipo.find((e) => e.nombre === nombre);
            if (m) setVendedor(m.nombre, m.idUsuario);
          }}
          className="h-7 shrink-0 rounded-full border border-white/30 bg-white/20 px-2 text-xs text-foreground backdrop-blur-sm transition-colors hover:bg-white/40"
        >
          {!enTurno && (
            <option value="" disabled>
              — elegir —
            </option>
          )}
          {equipo.map((e) => (
            <option key={e.idUsuario} value={e.nombre}>
              {e.nombre}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

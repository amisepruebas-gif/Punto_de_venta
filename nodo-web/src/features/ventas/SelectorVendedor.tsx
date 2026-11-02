import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useEquipo } from "@/features/equipo/useEquipo";
import { useCarrito } from "./carritoStore";

type Props = {
  className?: string;
};

/** "Vendedor Prueba" → "VP", para el círculo del chip. */
function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Chip "En turno" de la cabecera. Sin vendedor elegido va en ámbar: no se
 * puede cobrar hasta elegir (el panel de cobro también lo avisa).
 */
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
  const elegido = !!enTurno && equipo.some((e) => e.nombre === enTurno);

  const etiqueta = unico && !elegido ? "Toca para elegir" : "En turno";
  const nombre = elegido
    ? enTurno!
    : sinEquipo
      ? "Sin equipo"
      : unico
        ? equipo[0]!.nombre
        : "Elegir";

  const chip = `relative flex h-11 min-w-0 items-center gap-2 rounded-full border pl-1 pr-2.5 text-left ${
    elegido ? "border-border bg-muted" : "border-aviso-borde bg-aviso-suave"
  } ${className}`;

  const contenido = (
    <>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          elegido ? "bg-marca-suave text-marca-oscuro" : "bg-card text-aviso"
        }`}
        aria-hidden
      >
        {elegido ? iniciales(enTurno!) : unico ? iniciales(nombre) : "?"}
      </span>
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="text-[11px] text-muted-foreground">{etiqueta}</span>
        <span className="max-w-[6.5rem] truncate text-sm font-semibold min-[1000px]:max-w-[9rem]">
          {nombre}
        </span>
      </span>
      {multi && (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );

  if (sinEquipo) {
    return <div className={chip}>{contenido}</div>;
  }

  if (unico) {
    return (
      <button
        type="button"
        onClick={() => setVendedor(equipo[0]!.nombre, equipo[0]!.idUsuario)}
        className={chip}
      >
        {contenido}
      </button>
    );
  }

  // Varios vendedores: el <select> nativo va encima del chip, transparente,
  // para que la tablet abra su lista de siempre.
  return (
    <label className={chip}>
      {contenido}
      <select
        value={enTurno ?? ""}
        onChange={(ev) => {
          const elegidoNombre = ev.target.value;
          if (!elegidoNombre) return;
          const m = equipo.find((e) => e.nombre === elegidoNombre);
          if (m) setVendedor(m.nombre, m.idUsuario);
        }}
        aria-label="Quién atiende"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
    </label>
  );
}

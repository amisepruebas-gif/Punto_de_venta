import { Image as ImageIcon } from "lucide-react";
import {
  CABECERAS,
  FONDOS,
  LOGOS,
  useApariencia,
  type CabeceraOpcion,
  type FondoOpcion,
  type LogoOpcion,
} from "@/features/apariencia/useApariencia";

/**
 * Sección "Apariencia" — permite elegir el fondo de la pantalla principal
 * y la cabecera, con sliders de transparencia para cada uno. Todo persiste
 * en localStorage del dispositivo (preferencia per-tablet).
 */
export function AparienciaCard() {
  const {
    fondo,
    fondoOpacidad,
    setFondo,
    setFondoOpacidad,
    cabecera,
    cabeceraOpacidad,
    setCabecera,
    setCabeceraOpacidad,
    logo,
    setLogo,
  } = useApariencia();

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Apariencia</h3>
      </div>

      {/* ---------- Fondo ---------- */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Fondo (desde el buscador hasta el footer)
        </p>
        <div className="grid grid-cols-4 gap-2">
          {FONDOS.map((f) => (
            <ThumbnailFondo
              key={f.id}
              opcion={f}
              activa={f.id === fondo.id}
              onClick={() => setFondo(f.id)}
            />
          ))}
        </div>
        {fondo.src && (
          <SliderOpacidad
            label="Transparencia del fondo"
            valor={fondoOpacidad}
            onChange={setFondoOpacidad}
          />
        )}
      </div>

      {/* ---------- Logo ---------- */}
      <div className="space-y-2 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">
          Logo (esquina superior izquierda de la pantalla de ventas)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LOGOS.map((l) => (
            <ThumbnailLogo
              key={l.id}
              opcion={l}
              activa={l.id === logo.id}
              onClick={() => setLogo(l.id)}
            />
          ))}
        </div>
      </div>

      {/* ---------- Cabecera ---------- */}
      <div className="space-y-2 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">
          Cabecera (fondo de la barra superior)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CABECERAS.map((c) => (
            <ThumbnailCabecera
              key={c.id}
              opcion={c}
              activa={c.id === cabecera.id}
              onClick={() => setCabecera(c.id)}
            />
          ))}
        </div>
        {cabecera.src && (
          <SliderOpacidad
            label="Transparencia de la cabecera"
            valor={cabeceraOpacidad}
            onChange={setCabeceraOpacidad}
          />
        )}
      </div>
    </section>
  );
}

function ThumbnailFondo({
  opcion,
  activa,
  onClick,
}: {
  opcion: FondoOpcion;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-md border-2 ${
        activa
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      }`}
      aria-pressed={activa}
      aria-label={opcion.nombre}
    >
      {opcion.src ? (
        <img
          src={opcion.src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          Sin fondo
        </div>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-center text-[9px] text-white">
        {opcion.nombre}
      </span>
    </button>
  );
}

function ThumbnailCabecera({
  opcion,
  activa,
  onClick,
}: {
  opcion: CabeceraOpcion;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative h-12 overflow-hidden rounded-md border-2 ${
        activa
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      }`}
      aria-pressed={activa}
      aria-label={opcion.nombre}
    >
      {opcion.src ? (
        <img
          src={opcion.src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          Sin cabecera
        </div>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-center text-[9px] text-white">
        {opcion.nombre}
      </span>
    </button>
  );
}

function ThumbnailLogo({
  opcion,
  activa,
  onClick,
}: {
  opcion: LogoOpcion;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-16 items-center justify-center overflow-hidden rounded-md border-2 bg-white p-2 ${
        activa
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      }`}
      aria-pressed={activa}
      aria-label={opcion.nombre}
    >
      {opcion.src ? (
        <img
          src={opcion.src}
          alt=""
          className="max-h-full max-w-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          Sin logo
        </div>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-center text-[9px] text-white">
        {opcion.nombre}
      </span>
    </button>
  );
}

function SliderOpacidad({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(valor * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
    </div>
  );
}

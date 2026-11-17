/** El apagador de un acceso (enlace de armar o impresora). */
export function Apagador({
  activo,
  disabled,
  onCambiar,
}: {
  activo: boolean;
  disabled?: boolean;
  onCambiar: (activo: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        activo
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`relative inline-block h-4 w-7 rounded-full transition ${activo ? "bg-emerald-600" : "bg-muted-foreground/40"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${activo ? "left-3.5" : "left-0.5"}`}
        />
      </span>
      {activo ? "Prendido" : "Apagado"}
    </button>
  );
}

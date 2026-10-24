import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Etiquetas tipo hashtag: se escriben y se agregan con Enter o coma. Misma
 * normalización que el editor de artículos (sin #, minúsculas, sin
 * repetidas).
 */
export function EtiquetasInput({
  etiquetas,
  onChange,
}: {
  etiquetas: string[];
  onChange: (etiquetas: string[]) => void;
}) {
  const [borrador, setBorrador] = useState("");

  function agregar() {
    const t = borrador.trim().replace(/^#+/, "").toLowerCase();
    setBorrador("");
    if (!t || etiquetas.includes(t)) return;
    onChange([...etiquetas, t]);
  }

  return (
    <div className="space-y-2">
      <Input
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            agregar();
          }
        }}
        onBlur={agregar}
        placeholder="Ej. anime, dragonball (Enter para agregar)"
      />
      {etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {etiquetas.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              #{t}
              <button
                type="button"
                onClick={() => onChange(etiquetas.filter((x) => x !== t))}
                aria-label={`Quitar etiqueta ${t}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

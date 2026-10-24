import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ZonaPrecio } from "@shared";
import { useZonasPrecio } from "./useZonasPrecio";
import { ZonaFormModal } from "./ZonaFormModal";
import { resumenZona } from "./zonaPrecioService";

/**
 * Selector de zona de precios con "+ Nueva zona" (la crea en el momento y
 * la deja seleccionada). Ofrece las activas, sugiriendo primero las de
 * `categoriaId`; la zona actual se muestra aunque esté inactiva.
 */
export function ZonaPrecioSelect({
  value,
  onChange,
  categoriaId,
  requerida = false,
}: {
  value: string;
  onChange: (zona: ZonaPrecio | null) => void;
  categoriaId?: string;
  requerida?: boolean;
}) {
  const { zonas } = useZonasPrecio();
  const [creando, setCreando] = useState(false);
  const actual = zonas.find((z) => z.zonaId === value) ?? null;
  const ofrecidas = zonas
    .filter((z) => z.activa || z.zonaId === value)
    .sort((a, b) => {
      // Primero las de la categoría del artículo.
      const pa = categoriaId && a.categoriaId === categoriaId ? 0 : 1;
      const pb = categoriaId && b.categoriaId === categoriaId ? 0 : 1;
      return pa - pb || a.nombre.localeCompare(b.nombre, "es");
    });

  return (
    <div className="space-y-1.5">
      <Label>{requerida ? "Zona de precios *" : "Zona de precios"}</Label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) =>
            onChange(zonas.find((z) => z.zonaId === e.target.value) ?? null)
          }
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">
            {requerida ? "— Elige una zona —" : "— Sin zona (precio propio) —"}
          </option>
          {ofrecidas.map((z) => (
            <option key={z.zonaId} value={z.zonaId}>
              {z.nombre} — {resumenZona(z)}
              {z.activa ? "" : " (inactiva)"}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setCreando(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Nueva
        </Button>
      </div>
      {actual && (
        <p className="text-[11px] text-muted-foreground">
          Precio y mayoreo los manda la zona: {resumenZona(actual)}. Si cambias
          la zona, cambian todos sus artículos.
        </p>
      )}
      {creando && (
        <ZonaFormModal
          editando={null}
          categoriaSugerida={categoriaId}
          onClose={() => setCreando(false)}
          onCreada={(z) => onChange(z)}
        />
      )}
    </div>
  );
}

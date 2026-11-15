import { useNegocio } from "@/hooks/useNegocio";
import { CampoConNuevo } from "./CategoriaInlineSelect";
import { asegurarGenero } from "./generoService";
import { useGeneros } from "./useGeneros";

/**
 * Género (temática) del artículo, con "+ Nuevo" para crearlo en el momento.
 * Escribir un nombre que ya existe lo selecciona (mismo slug).
 */
export function GeneroInlineSelect({
  generoId,
  onChange,
}: {
  generoId: string;
  onChange: (generoId: string) => void;
}) {
  const { negocioId } = useNegocio();
  const { generos } = useGeneros();
  return (
    <CampoConNuevo
      etiqueta="Género (opcional)"
      placeholderNuevo="Ej. Anime"
      valor={generoId}
      opciones={generos.map((g) => ({ id: g.generoId, nombre: g.nombre }))}
      vacio="— Sin género —"
      textoNuevo="Nuevo"
      onElegir={onChange}
      onCrear={async (nombre) => {
        if (!negocioId) throw new Error("Sin negocio");
        const g = await asegurarGenero(negocioId, nombre);
        onChange(g.generoId);
      }}
    />
  );
}

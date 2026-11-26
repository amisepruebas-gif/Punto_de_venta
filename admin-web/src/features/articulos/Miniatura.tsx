import { Package } from "lucide-react";

/**
 * Miniatura de la foto de un artículo (o de una de sus variaciones). Sin
 * foto, un recuadro con ícono del mismo tamaño: así toda mención de un
 * artículo lleva su imagen y las filas no brincan.
 */
export function Miniatura({
  url,
  alt,
  size = 40,
}: {
  url?: string;
  alt: string;
  size?: number;
}) {
  const estilo = { width: size, height: size };
  return url ? (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      style={estilo}
      className="shrink-0 rounded-md border object-cover"
    />
  ) : (
    <span
      style={estilo}
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
    >
      <Package className="h-1/2 w-1/2" />
    </span>
  );
}

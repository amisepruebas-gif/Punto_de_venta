import type { ReactNode } from "react";

/**
 * Pila de los botones flotantes de Ventas: se apilan de abajo hacia arriba en
 * el orden en que se pasan, desde arriba del pie de cobro (bottom-32) y sin
 * pasar del encabezado (top-16). Antes cada botón tenía su altura fija y en
 * pantallas bajas (tablet acostada, ~540 px) los de arriba se salían; ahora
 * los que no caben pasan a otra columna a la izquierda.
 */
export function PilaBotonesFlotantes({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-32 right-4 top-16 z-40 flex flex-col-reverse flex-wrap-reverse content-start gap-3">
      {children}
    </div>
  );
}

import type { TicketConfig, TicketLinea, Sucursal } from "@shared";

export function nuevaLineaId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nuevaLinea(parcial?: Partial<TicketLinea>): TicketLinea {
  return {
    id: nuevaLineaId(),
    texto: "",
    estilo: "normal",
    alineacion: "center",
    ...parcial,
  };
}

/**
 * Plantilla por defecto basada en los datos administrativos de la sucursal.
 * Replica el header automático que nodo-web usa cuando no hay `ticketConfig`,
 * para que el admin parta de algo coherente y solo edite lo que cambie.
 */
export function plantillaDesdeSucursal(s: Sucursal): TicketConfig {
  const encabezado: TicketLinea[] = [
    nuevaLinea({ texto: s.nombre || "NOMBRE DEL NEGOCIO", estilo: "big" }),
  ];
  if (s.direccion) {
    encabezado.push(nuevaLinea({ texto: s.direccion, estilo: "small" }));
  }
  if (s.telefono) {
    encabezado.push(
      nuevaLinea({ texto: `Tel: ${s.telefono}`, estilo: "small" }),
    );
  }
  const pie: TicketLinea[] = [
    nuevaLinea({ texto: "¡Gracias por tu compra!", estilo: "small" }),
  ];
  return { encabezado, pie };
}

export function configVacia(): TicketConfig {
  return { encabezado: [], pie: [] };
}

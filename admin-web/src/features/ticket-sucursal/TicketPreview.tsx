import { mostrarMetaTicket } from "@shared";
import type { TicketConfig, TicketLinea } from "@shared";
import { TicketQrPreview } from "./TicketQrEditor";

const ANCHO = 32;

function clasesEstilo(linea: TicketLinea): string {
  const estilo = linea.estilo ?? "normal";
  switch (estilo) {
    case "big":
      return "text-base font-bold leading-tight";
    case "bold":
      return "font-bold";
    case "small":
      return "text-[10px] text-zinc-700";
    default:
      return "";
  }
}

function clasesAlineacion(linea: TicketLinea): string {
  const a = linea.alineacion ?? "center";
  if (a === "left") return "text-left";
  if (a === "right") return "text-right";
  return "text-center";
}

function Linea({ linea }: { linea: TicketLinea }) {
  const texto = linea.texto || " ";
  return (
    <div
      className={`whitespace-pre-wrap break-words font-mono text-xs ${clasesEstilo(linea)} ${clasesAlineacion(linea)}`}
    >
      {texto}
    </div>
  );
}

function Divisor() {
  return (
    <div className="text-center font-mono text-[10px] text-zinc-400">
      {"-".repeat(ANCHO)}
    </div>
  );
}

function MetaPreview({ config }: { config: TicketConfig }) {
  const numero = mostrarMetaTicket(config, "numeroTicket");
  const fecha = mostrarMetaTicket(config, "fecha");
  const vendedor = mostrarMetaTicket(config, "vendedor");
  if (!numero && !fecha && !vendedor) {
    return (
      <p className="py-2 text-center font-mono text-[10px] italic text-zinc-400">
        (sin datos automáticos)
      </p>
    );
  }
  return (
    <div className="space-y-1 py-2 text-center font-mono text-[10px] text-zinc-500">
      {(numero || fecha) && (
        <div>
          {numero && <span>Ticket #1234</span>}
          {numero && fecha && <span> · </span>}
          {fecha && <span>2026-04-30</span>}
        </div>
      )}
      {vendedor && <div>Vendedor: ejemplo</div>}
    </div>
  );
}

/**
 * Render aproximado de cómo se verá el ticket impreso. Muestra el
 * encabezado y pie configurables; el cuerpo (datos venta, items, totales)
 * aparece como placeholder porque ese contenido lo genera nodo-web al
 * momento de la venta y no es editable.
 */
export function TicketPreview({ config }: { config: TicketConfig }) {
  const enc = config.encabezado ?? [];
  const pie = config.pie ?? [];

  return (
    <div
      className="mx-auto w-[260px] rounded-md border bg-white p-3 shadow-sm"
      style={{ minHeight: 320 }}
    >
      {enc.length === 0 ? (
        <p className="text-center font-mono text-[10px] italic text-zinc-400">
          (encabezado vacío — nodo-web usará nombre/dirección/teléfono de la
          sucursal)
        </p>
      ) : (
        enc.map((l) => <Linea key={l.id} linea={l} />)
      )}

      <Divisor />
      <MetaPreview config={config} />
      <Divisor />
      <div className="space-y-0.5 py-1 font-mono text-[10px] text-zinc-700">
        <div className="flex justify-between">
          <span>2x Camiseta</span>
          <span>$200</span>
        </div>
        <div className="flex justify-between">
          <span>1x Pantalón</span>
          <span>$350</span>
        </div>
      </div>
      <Divisor />
      <div className="flex justify-between py-1 font-mono text-xs font-bold">
        <span>TOTAL</span>
        <span>$550</span>
      </div>
      <Divisor />

      {pie.length === 0 ? (
        <p className="text-center font-mono text-[10px] italic text-zinc-400">
          (pie vacío — nodo-web usará "¡Gracias por tu compra!")
        </p>
      ) : (
        pie.map((l) => <Linea key={l.id} linea={l} />)
      )}

      <TicketQrPreview qr={config.qr} />
    </div>
  );
}

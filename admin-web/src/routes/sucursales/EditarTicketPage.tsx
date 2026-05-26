import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw, Save, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNegocio } from "@/hooks/useNegocio";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { guardarTicketSucursal } from "@/features/sucursales/sucursalService";
import { TicketLineasEditor } from "@/features/ticket-sucursal/TicketLineasEditor";
import { TicketMetaEditor } from "@/features/ticket-sucursal/TicketMetaEditor";
import { TicketPreview } from "@/features/ticket-sucursal/TicketPreview";
import { TicketQrEditor } from "@/features/ticket-sucursal/TicketQrEditor";
import {
  configVacia,
  nuevaLinea,
  plantillaDesdeSucursal,
} from "@/features/ticket-sucursal/ticketDefaults";
import type {
  TicketConfig,
  TicketLinea,
  TicketMostrar,
  TicketQr,
} from "@shared";

function clonarLineas(lineas: TicketLinea[] | undefined): TicketLinea[] {
  return (lineas ?? []).map((l) => ({ ...l }));
}

export function EditarTicketPage() {
  const { sid } = useParams<{ sid: string }>();
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { sucursales, loading } = useSucursales();

  const sucursal = useMemo(
    () => sucursales.find((s) => s.sucursalId === sid) ?? null,
    [sucursales, sid],
  );

  const [encabezado, setEncabezado] = useState<TicketLinea[]>([]);
  const [pie, setPie] = useState<TicketLinea[]>([]);
  const [qr, setQr] = useState<TicketQr | undefined>(undefined);
  const [mostrar, setMostrar] = useState<TicketMostrar | undefined>(undefined);
  const [hidratadoSid, setHidratadoSid] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Hidrata el form al cargar la sucursal y cada vez que cambia el `sid`
  // de la URL (cubre el caso de navegar entre tickets sin remontaje).
  useEffect(() => {
    if (!sucursal) return;
    if (hidratadoSid === sucursal.sucursalId) return;
    const cfg = sucursal.ticketConfig ?? configVacia();
    setEncabezado(clonarLineas(cfg.encabezado));
    setPie(clonarLineas(cfg.pie));
    setQr(cfg.qr ? { ...cfg.qr } : undefined);
    setMostrar(cfg.mostrar ? { ...cfg.mostrar } : undefined);
    setHidratadoSid(sucursal.sucursalId);
    setError(null);
    setOkMsg(null);
  }, [sucursal, hidratadoSid]);

  // Auto-limpia el toast de éxito tras unos segundos.
  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => setOkMsg(null), 4000);
    return () => clearTimeout(t);
  }, [okMsg]);

  const hidratado = sucursal != null && hidratadoSid === sucursal.sucursalId;

  const config: TicketConfig = useMemo(
    () => ({
      encabezado,
      pie,
      ...(qr ? { qr } : {}),
      ...(mostrar ? { mostrar } : {}),
    }),
    [encabezado, pie, qr, mostrar],
  );

  function cargarPlantilla() {
    if (!sucursal) return;
    const plantilla = plantillaDesdeSucursal(sucursal);
    setEncabezado(clonarLineas(plantilla.encabezado));
    setPie(clonarLineas(plantilla.pie));
    // No tocamos `qr`: la plantilla por defecto no incluye QR; el admin
    // decide aparte si lo agrega.
    setError(null);
    setOkMsg(null);
  }

  function vaciarTodo() {
    setEncabezado([]);
    setPie([]);
    setQr(undefined);
    setMostrar(undefined);
    setError(null);
    setOkMsg(null);
  }

  function descartar() {
    if (!sucursal) return;
    const cfg = sucursal.ticketConfig ?? configVacia();
    setEncabezado(clonarLineas(cfg.encabezado));
    setPie(clonarLineas(cfg.pie));
    setQr(cfg.qr ? { ...cfg.qr } : undefined);
    setMostrar(cfg.mostrar ? { ...cfg.mostrar } : undefined);
    setError(null);
    setOkMsg(null);
  }

  async function onGuardar() {
    if (!negocioId || !sid) return;
    setGuardando(true);
    setError(null);
    setOkMsg(null);
    try {
      // Sanitizamos primero (descarta líneas con texto vacío después del
      // trim, omite el QR si su contenido está vacío, y omite `mostrar`
      // si todos sus flags son default). El estado de "todo vacío" se
      // evalúa SOBRE el resultado sanitizado.
      const limpio = sanitizar({ encabezado, pie, qr, mostrar });
      const todoVacio =
        (limpio.encabezado?.length ?? 0) === 0 &&
        (limpio.pie?.length ?? 0) === 0 &&
        !limpio.qr &&
        !limpio.mostrar;
      await guardarTicketSucursal(
        negocioId,
        sid,
        todoVacio ? null : limpio,
      );
      // Reflejamos el resultado sanitizado en el form para que el admin
      // vea exactamente lo que quedó persistido (sin filas en blanco).
      setEncabezado(clonarLineas(limpio.encabezado));
      setPie(clonarLineas(limpio.pie));
      setQr(limpio.qr);
      setMostrar(limpio.mostrar);
      setOkMsg(
        todoVacio
          ? "Configuración borrada. Se usará el ticket por defecto."
          : "Cambios guardados.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (loading || !hidratado) {
    return (
      <p className="container max-w-5xl py-12 text-center text-sm text-muted-foreground">
        Cargando…
      </p>
    );
  }

  if (!sucursal) {
    return (
      <div className="container max-w-3xl space-y-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sucursales")}>
          <ArrowLeft className="mr-1 h-3 w-3" /> Sucursales
        </Button>
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sucursal no encontrada.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl space-y-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/sucursales")}
            className="-ml-2 mb-1"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Sucursales
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Editor de ticket
          </h1>
          <p className="text-sm text-muted-foreground">
            Sucursal: <span className="font-medium">{sucursal.nombre}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={cargarPlantilla}
          >
            <FileText className="mr-1 h-3 w-3" /> Cargar plantilla
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={vaciarTodo}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Vaciar
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={descartar}
          >
            <RotateCcw className="mr-1 h-3 w-3" /> Descartar
          </Button>
          <Button size="sm" type="button" onClick={onGuardar} disabled={guardando}>
            <Save className="mr-1 h-3 w-3" />
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {okMsg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <TicketLineasEditor
            titulo="Encabezado"
            hint="Líneas que aparecen arriba del listado de artículos. Si la dejas vacía, el ticket usará nombre/dirección/teléfono de la sucursal."
            lineas={encabezado}
            onChange={setEncabezado}
          />
          <TicketMetaEditor mostrar={mostrar} onChange={setMostrar} />
          <TicketLineasEditor
            titulo="Pie de ticket"
            hint='Líneas que aparecen debajo de los totales y método de pago. Vacío usa "¡Gracias por tu compra!".'
            lineas={pie}
            onChange={setPie}
          />
          <TicketQrEditor qr={qr} onChange={setQr} />
          <details className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              Sugerencia rápida
            </summary>
            <p className="pt-2">
              Pulsa <strong>Cargar plantilla</strong> para empezar con
              nombre/dirección/teléfono de la sucursal y el agradecimiento.
              Después agrega líneas de promoción, redes sociales o lo que
              necesite cada sucursal. Pulsa <strong>Vaciar</strong> y luego
              guarda para volver al ticket por defecto.
            </p>
            <p className="pt-2">
              Tip: las líneas vacías se descartan al guardar; usa una línea con
              un espacio o un guión si quieres dejar separación.
            </p>
            <button
              type="button"
              className="mt-2 text-primary underline"
              onClick={() =>
                setEncabezado((prev) => [
                  ...prev,
                  nuevaLinea({ texto: "—", estilo: "small" }),
                ])
              }
            >
              + Agregar separador al encabezado
            </button>
          </details>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vista previa
          </p>
          <TicketPreview config={config} />
          <p className="text-[10px] text-muted-foreground">
            La vista previa es aproximada. La impresora térmica de 48 mm
            renderiza ~32 caracteres por línea.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Limpia líneas con texto vacío, normaliza estilos/alineaciones, omite
 *  el QR si su contenido queda vacío después del trim y omite `mostrar`
 *  si todos los flags son default (true). */
function sanitizar(cfg: TicketConfig): TicketConfig {
  const limpiarLista = (xs?: TicketLinea[]) =>
    (xs ?? [])
      .map((l) => ({
        id: l.id,
        texto: l.texto.trim(),
        estilo: l.estilo ?? "normal",
        alineacion: l.alineacion ?? "center",
      }))
      .filter((l) => l.texto.length > 0);
  let qr: TicketConfig["qr"];
  if (cfg.qr) {
    const contenido = cfg.qr.contenido.trim();
    const leyenda = cfg.qr.leyenda?.trim();
    if (contenido.length > 0) {
      qr = leyenda ? { contenido, leyenda } : { contenido };
    }
  }
  let mostrar: TicketConfig["mostrar"];
  if (cfg.mostrar) {
    const m: NonNullable<TicketConfig["mostrar"]> = {};
    if (cfg.mostrar.numeroTicket === false) m.numeroTicket = false;
    if (cfg.mostrar.fecha === false) m.fecha = false;
    if (cfg.mostrar.vendedor === false) m.vendedor = false;
    if (Object.keys(m).length > 0) mostrar = m;
  }
  return {
    encabezado: limpiarLista(cfg.encabezado),
    pie: limpiarLista(cfg.pie),
    ...(qr ? { qr } : {}),
    ...(mostrar ? { mostrar } : {}),
  };
}

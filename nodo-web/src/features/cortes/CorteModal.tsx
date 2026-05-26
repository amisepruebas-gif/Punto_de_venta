import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useCarrito } from "@/features/ventas/carritoStore";
import { useCorteActivo } from "./useCorteActivo";
import { iniciarCorte, finalizarCorte } from "./corteService";
import type { Corte } from "@shared";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CorteModal({ open, onClose }: Props) {
  const { negocioId, sucursalId, nodoId } = useNodoSession();
  const { corte, ymd } = useCorteActivo();
  const enTurno = useCarrito((s) => s.enTurno);
  const [esOtraPersona, setEsOtraPersona] = useState(false);
  const [usuarioOverride, setUsuarioOverride] = useState("");
  const [fondoInicialInput, setFondoInicialInput] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumenCierre, setResumenCierre] = useState<Corte | null>(null);

  useEffect(() => {
    if (!open) {
      setEsOtraPersona(false);
      setUsuarioOverride("");
      setFondoInicialInput("0");
      setError(null);
      setResumenCierre(null);
    }
  }, [open]);

  if (!open) return null;

  // El usuario que registra el corte sale del vendedor en turno por
  // default; sólo si el cajero marca "Es otra persona" se permite override.
  const usuarioFinal = esOtraPersona
    ? usuarioOverride.trim()
    : (enTurno ?? "").trim();

  async function onIniciar() {
    if (!negocioId || !sucursalId || !nodoId) return;
    if (!usuarioFinal) return;
    setSubmitting(true);
    setError(null);
    try {
      // Nombre auto-generado con fecha+hora local. Suficiente para
      // distinguir cortes del mismo día sin pedir input al cajero.
      const ahora = new Date();
      const hh = String(ahora.getHours()).padStart(2, "0");
      const mm = String(ahora.getMinutes()).padStart(2, "0");
      const fechaCorta = `${ahora.getFullYear()}-${String(
        ahora.getMonth() + 1,
      ).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      const nombreAuto = `Corte ${fechaCorta} ${hh}:${mm}`;
      await iniciarCorte({
        negocioId,
        sucursalId,
        nodoId,
        usuarioCreador: usuarioFinal,
        nombre_corte: nombreAuto,
        fondoInicial: fondoInicialInput.trim() || "0",
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onFinalizar() {
    if (!negocioId || !sucursalId || !corte || !ymd) return;
    setSubmitting(true);
    setError(null);
    try {
      const finalizado = await finalizarCorte({
        negocioId,
        sucursalId,
        corte,
        y: ymd.y,
        m: ymd.m,
        d: ymd.d,
      });
      setResumenCierre(finalizado);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {resumenCierre ? (
          <>
            <h2 className="text-lg font-semibold">Corte finalizado</h2>
            <p className="text-sm text-muted-foreground">
              {resumenCierre.nombre_corte} ·{" "}
              {resumenCierre.fecha_inicio} → {resumenCierre.fecha_fin}
            </p>
            <TotalesCorte corte={resumenCierre} />
            <Button className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </>
        ) : corte ? (
          <>
            <div>
              <h2 className="text-lg font-semibold">Corte en curso</h2>
              <p className="text-sm text-muted-foreground">
                {corte.nombre_corte} · desde {corte.fecha_inicio}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Al finalizar, se calcularán los totales por forma de pago de las
              ventas de este nodo desde la hora de inicio.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={onFinalizar}
                disabled={submitting}
              >
                {submitting ? "Cerrando…" : "Finalizar corte"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold">Iniciar corte</h2>
              <p className="text-sm text-muted-foreground">
                Nuevo corte para este nodo
              </p>
            </div>
            <div className="space-y-2 rounded-md border bg-background p-3">
              <p className="text-sm">
                Inicia:{" "}
                <span className="font-medium">
                  {esOtraPersona
                    ? usuarioOverride.trim() || "(sin nombre)"
                    : enTurno ?? "(sin vendedor en turno)"}
                </span>
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={esOtraPersona}
                  onChange={(e) => setEsOtraPersona(e.target.checked)}
                />
                Es otra persona
              </label>
              {esOtraPersona && (
                <Input
                  placeholder="Nombre de quien inicia"
                  value={usuarioOverride}
                  onChange={(e) => setUsuarioOverride(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1">
              <label
                htmlFor="fondoInicial"
                className="text-sm text-muted-foreground"
              >
                Fondo de caja inicial
              </label>
              <Input
                id="fondoInicial"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={fondoInicialInput}
                onChange={(e) => {
                  // Defensa contra navegadores que ignoran type="number":
                  // sólo aceptamos dígitos opcionalmente seguidos de punto
                  // y decimales. Cualquier otro carácter se descarta en
                  // el momento de teclearlo (no se ve "abc" en pantalla).
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) {
                    setFondoInicialInput(v);
                  }
                }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={onIniciar}
                disabled={submitting || !usuarioFinal}
              >
                {submitting ? "Iniciando…" : "Iniciar"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TotalesCorte({ corte }: { corte: Corte }) {
  const fondo = Number(corte.fondoInicial ?? "0") || 0;
  const efe = Number(corte.totalEfectivo) || 0;
  const esperado = (fondo + efe).toFixed(0);
  return (
    <div className="space-y-1 rounded-md border bg-background p-3 text-sm">
      <Row label="Fondo inicial" value={corte.fondoInicial ?? "0"} />
      <Row label="Efectivo (ventas)" value={corte.totalEfectivo} />
      <Row label="Transferencia" value={corte.totalTransferencia} />
      <Row label="Tarjeta" value={corte.totalTarjeta} />
      <div className="mt-2 border-t pt-2">
        <Row label="Total ventas" value={corte.totalGeneral} strong />
        <Row label="Esperado en caja" value={esperado} strong />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>${value}</span>
    </div>
  );
}

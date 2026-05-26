import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Building2, Power, Pencil, Receipt } from "lucide-react";
import { useNegocio } from "@/hooks/useNegocio";
import { useSucursales } from "@/features/sucursales/useSucursales";
import {
  crearSucursal,
  editarSucursal,
  activarSucursal,
  desactivarSucursal,
} from "@/features/sucursales/sucursalService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sucursal } from "@shared";

export function SucursalesPage() {
  const { negocioId } = useNegocio();
  const { sucursales, loading } = useSucursales();
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Sucursal | null>(null);

  return (
    <div className="container max-w-5xl space-y-4 py-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sucursales</h1>
          <p className="text-sm text-muted-foreground">
            {sucursales.length}{" "}
            {sucursales.length === 1 ? "sucursal" : "sucursales"} en el negocio
          </p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva sucursal
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : sucursales.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sin sucursales todavía
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sucursales.map((s) => (
            <div
              key={s.sucursalId}
              className="rounded-lg border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{s.nombre}</h3>
                  <p className="text-sm text-muted-foreground">
                    {s.direccion}
                  </p>
                  {s.telefono && (
                    <p className="text-xs text-muted-foreground">
                      Tel: {s.telefono}
                    </p>
                  )}
                </div>
                <span
                  className={
                    s.activa
                      ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {s.activa ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditando(s);
                    setModalOpen(true);
                  }}
                >
                  <Pencil className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/sucursales/${s.sucursalId}/ticket`}>
                    <Receipt className="mr-1 h-3 w-3" /> Ticket
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    negocioId &&
                    (s.activa
                      ? desactivarSucursal(negocioId, s.sucursalId)
                      : activarSucursal(negocioId, s.sucursalId))
                  }
                >
                  <Power className="mr-1 h-3 w-3" />
                  {s.activa ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && negocioId && (
        <SucursalFormModal
          negocioId={negocioId}
          editando={editando}
          onClose={() => {
            setModalOpen(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function SucursalFormModal({
  negocioId,
  editando,
  onClose,
}: {
  negocioId: string;
  editando: Sucursal | null;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState(editando?.nombre ?? "");
  const [direccion, setDireccion] = useState(editando?.direccion ?? "");
  const [telefono, setTelefono] = useState(editando?.telefono ?? "");
  const [cobrarComision, setCobrarComision] = useState(
    editando?.cobrarComision ?? false,
  );
  const [comisionPct, setComisionPct] = useState(
    String(((editando?.comisionTarjetaPct ?? 0.04) * 100).toFixed(2)),
  );
  const [trBanco, setTrBanco] = useState(
    editando?.datosTransferencia?.banco ?? "",
  );
  const [trCuenta, setTrCuenta] = useState(
    editando?.datosTransferencia?.cuenta ?? "",
  );
  const [trTitular, setTrTitular] = useState(
    editando?.datosTransferencia?.titular ?? "",
  );
  const [trReferencia, setTrReferencia] = useState(
    editando?.datosTransferencia?.referencia ?? "",
  );
  const [trMotivo, setTrMotivo] = useState(
    editando?.datosTransferencia?.motivo ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !direccion.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editando) {
        const pctNumber = Number(comisionPct) / 100;
        const tieneTransferencia =
          trBanco.trim() || trCuenta.trim() || trTitular.trim();
        await editarSucursal(negocioId, editando.sucursalId, {
          nombre: nombre.trim(),
          direccion: direccion.trim(),
          telefono: telefono.trim() || undefined,
          cobrarComision,
          comisionTarjetaPct: Number.isFinite(pctNumber) ? pctNumber : 0.04,
          datosTransferencia: tieneTransferencia
            ? {
                banco: trBanco.trim(),
                cuenta: trCuenta.trim(),
                titular: trTitular.trim(),
                referencia: trReferencia.trim() || undefined,
                motivo: trMotivo.trim() || undefined,
              }
            : null,
        });
      } else {
        await crearSucursal({
          negocioId,
          nombre: nombre.trim(),
          direccion: direccion.trim(),
          telefono: telefono.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-card p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold">
          {editando ? "Editar sucursal" : "Nueva sucursal"}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="direccion">Dirección</Label>
          <Input
            id="direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono (opcional)</Label>
          <Input
            id="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
          />
        </div>

        {editando && (
          <>
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-semibold">Pagos con tarjeta</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cobrarComision}
                  onChange={(e) => setCobrarComision(e.target.checked)}
                />
                Cobrar comisión al cliente
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="comisionPct" className="text-xs">
                  % comisión
                </Label>
                <Input
                  id="comisionPct"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={comisionPct}
                  onChange={(e) => setComisionPct(e.target.value)}
                  disabled={!cobrarComision}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-semibold">Datos de transferencia</p>
              <p className="text-xs text-muted-foreground">
                Mostrados al elegir transferencia en nodo-web. Vacío = ocultar.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="trBanco" className="text-xs">
                  Banco
                </Label>
                <Input
                  id="trBanco"
                  value={trBanco}
                  onChange={(e) => setTrBanco(e.target.value)}
                  placeholder="SANTANDER"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trCuenta" className="text-xs">
                  CLABE / cuenta
                </Label>
                <Input
                  id="trCuenta"
                  value={trCuenta}
                  onChange={(e) => setTrCuenta(e.target.value)}
                  placeholder="5579 0900 4256 7371"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trTitular" className="text-xs">
                  Titular
                </Label>
                <Input
                  id="trTitular"
                  value={trTitular}
                  onChange={(e) => setTrTitular(e.target.value)}
                  placeholder="VALERIA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trReferencia" className="text-xs">
                  Referencia (opcional)
                </Label>
                <Input
                  id="trReferencia"
                  value={trReferencia}
                  onChange={(e) => setTrReferencia(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trMotivo" className="text-xs">
                  Motivo (opcional)
                </Label>
                <Input
                  id="trMotivo"
                  value={trMotivo}
                  onChange={(e) => setTrMotivo(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : editando ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import {
  MOTIVOS_AJUSTE,
  validarAjuste,
  type Articulo,
  type MotivoAjuste,
} from "@shared";
import { reducirExistencia } from "./ajusteService";
import { useUbicaciones } from "./useFabricacion";

export type UbicacionConStock = { id: string; nombre: string; cantidad: number };

/**
 * Reducir existencia a mano: dónde, cuántas piezas y por qué (extravío,
 * dañado, otro con texto, o sin motivo). Queda registrado como ajuste.
 */
export function ReducirExistenciaModal({
  articulo,
  ubicaciones,
  onClose,
}: {
  articulo: Articulo;
  /** Solo las ubicaciones con piezas. */
  ubicaciones: UbicacionConStock[];
  onClose: () => void;
}) {
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { resolver } = useUbicaciones();
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? "");
  const [piezas, setPiezas] = useState("1");
  const [motivo, setMotivo] = useState<MotivoAjuste | "">("");
  const [detalle, setDetalle] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegida = ubicaciones.find((u) => u.id === ubicacionId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId || !elegida) return;
    if (!motivo) {
      setError("Elige el motivo");
      return;
    }
    const n = Number(piezas);
    const err = validarAjuste({ piezas: n, motivo, motivoDetalle: detalle });
    if (err) {
      setError(err);
      return;
    }
    if (n > elegida.cantidad) {
      setError(`En ${elegida.nombre} solo hay ${elegida.cantidad}`);
      return;
    }
    const ubicacion = resolver(ubicacionId);
    if (!ubicacion) {
      setError("Aún se están cargando las sucursales; intenta de nuevo");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await reducirExistencia(negocioId, {
        articuloId: articulo.id,
        ubicacion,
        ubicacionNombre: elegida.nombre,
        piezas: n,
        motivo,
        motivoDetalle: detalle,
        usuario: user?.user.email ?? user?.user.uid ?? "?",
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
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
        className="w-full max-w-md space-y-4 rounded-lg bg-card p-5 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold">Reducir existencia</h2>
          <p className="text-sm text-muted-foreground">{articulo.nombre}</p>
        </div>
        {ubicaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay piezas en ninguna ubicación.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="red-ubicacion">¿Dónde?</Label>
                <select
                  id="red-ubicacion"
                  value={ubicacionId}
                  onChange={(e) => setUbicacionId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.cantidad} pz)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="red-piezas">Piezas a quitar</Label>
                <Input
                  id="red-piezas"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={elegida?.cantidad}
                  step={1}
                  value={piezas}
                  onChange={(e) => setPiezas(e.target.value)}
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Motivo</legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MOTIVOS_AJUSTE) as MotivoAjuste[]).map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      motivo === m ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={m}
                      checked={motivo === m}
                      onChange={() => setMotivo(m)}
                    />
                    {MOTIVOS_AJUSTE[m]}
                  </label>
                ))}
              </div>
              {motivo === "otro" && (
                <Input
                  autoFocus
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  placeholder="Especifica el motivo"
                  aria-label="Especifica el motivo"
                />
              )}
            </fieldset>
          </>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={guardando || ubicaciones.length === 0}
          >
            {guardando ? "Guardando…" : "Reducir"}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useCortesDia } from "@/features/cortes-admin/useCortesAdmin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Corte } from "@shared";

export function CortesPage() {
  const { sucursales } = useSucursales();
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  // FIX H4: sucursales cargan async; sync con la primera cuando aparezcan.
  useEffect(() => {
    if (!sucursalId && sucursales.length > 0) {
      setSucursalId(sucursales[0].sucursalId);
    }
  }, [sucursales, sucursalId]);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  const fechaDate = new Date(fecha + "T12:00:00");
  const { cortes, loading } = useCortesDia(sucursalId, fechaDate);

  return (
    <div className="container max-w-4xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cortes de caja</h1>
        <p className="text-sm text-muted-foreground">
          Historial por sucursal y día
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Sucursal</Label>
          <select
            value={sucursalId ?? ""}
            onChange={(e) => setSucursalId(e.target.value || null)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : cortes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ScrollText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sin cortes en esta fecha
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cortes.map((c) => (
            <CorteCard key={c.corteId} corte={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CorteCard({ corte }: { corte: Corte }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{corte.nombre_corte}</h3>
          <p className="text-xs text-muted-foreground">
            Inicio {corte.fecha_inicio}
            {corte.fecha_fin && ` · Fin ${corte.fecha_fin}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Por {corte.usuarioCreador} · Nodo {corte.nodoId.slice(0, 10)}…
          </p>
        </div>
        <span
          className={
            corte.estado === "corte_finalizado"
              ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700"
          }
        >
          {corte.estado === "corte_finalizado" ? "Cerrado" : "En curso"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
        <Kpi label="Efectivo" value={corte.totalEfectivo} />
        <Kpi label="Transferencia" value={corte.totalTransferencia} />
        <Kpi label="Tarjeta" value={corte.totalTarjeta} />
        <Kpi label="Total" value={corte.totalGeneral} strong />
      </div>
    </div>
  );
}

function Kpi({
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
      className={`rounded-md ${strong ? "bg-primary/10" : "bg-muted/50"} p-2`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base ${strong ? "font-bold" : "font-semibold"}`}>
        ${value}
      </p>
    </div>
  );
}

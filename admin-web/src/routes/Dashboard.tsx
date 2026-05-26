import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingBag,
  ScrollText,
  Package,
  AlertTriangle,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNegocio } from "@/hooks/useNegocio";
import { useVentasHoyRT } from "@/features/ventas-admin/useVentasAdmin";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useCortesActivos } from "@/features/cortes-admin/useCortesAdmin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Dashboard() {
  const { user } = useAuth();
  const { negocio } = useNegocio();
  const { ventas: ventasHoy, loading: loadingVentas } = useVentasHoyRT();
  const { articulos } = useArticulos();
  const { sucursales } = useSucursales();
  const { cortes: cortesActivos } = useCortesActivos();

  const { totalHoy, countHoy, porSucursal } = useMemo(() => {
    let total = 0;
    const porSuc = new Map<string, { count: number; total: number }>();
    for (const v of ventasHoy) {
      const m = Number(v.montoCobro) || 0;
      total += m;
      const key = v.sucursalId;
      const prev = porSuc.get(key) ?? { count: 0, total: 0 };
      porSuc.set(key, { count: prev.count + 1, total: prev.total + m });
    }
    return {
      totalHoy: total,
      countHoy: ventasHoy.length,
      porSucursal: porSuc,
    };
  }, [ventasHoy]);

  const stockBajo = useMemo(
    () => articulos.filter((a) => Number(a.cantidad) < 5).length,
    [articulos],
  );

  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {negocio?.nombre ?? "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user?.user.email} · {user?.claims.role}
        </p>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ShoppingBag}
          label="Ventas hoy"
          value={loadingVentas ? "…" : `$${totalHoy.toFixed(0)}`}
          sub={`${countHoy} tickets`}
          to="/ventas"
        />
        <KpiCard
          icon={ScrollText}
          label="Cortes en curso"
          value={String(cortesActivos.length)}
          sub="Abiertos ahora"
          to="/cortes"
        />
        <KpiCard
          icon={Package}
          label="Catálogo"
          value={String(articulos.length)}
          sub={`${stockBajo} con stock bajo`}
          to="/articulos"
          alert={stockBajo > 0}
        />
        <KpiCard
          icon={Bookmark}
          label="Sucursales"
          value={String(sucursales.filter((s) => s.activa).length)}
          sub={`${sucursales.length} total`}
          to="/sucursales"
        />
      </div>

      {/* Ventas por sucursal hoy */}
      {sucursales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas de hoy por sucursal</CardTitle>
            <CardDescription>En vivo</CardDescription>
          </CardHeader>
          <CardContent>
            {sucursales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin sucursales</p>
            ) : (
              <ul className="divide-y">
                {sucursales.map((s) => {
                  const stats = porSucursal.get(s.sucursalId) ?? {
                    count: 0,
                    total: 0,
                  };
                  return (
                    <li
                      key={s.sucursalId}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{s.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.count} ventas
                        </p>
                      </div>
                      <p className="font-semibold">${stats.total.toFixed(0)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {stockBajo > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium">
              {stockBajo} artículo{stockBajo === 1 ? "" : "s"} con stock bajo
              (&lt; 5)
            </p>
            <Link
              to="/articulos"
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Revisar catálogo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  to?: string;
  alert?: boolean;
}) {
  const content = (
    <Card
      className={`transition-colors ${
        to ? "hover:bg-accent/50" : ""
      } ${alert ? "border-destructive/50" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-md p-2 ${
              alert ? "bg-destructive/10 text-destructive" : "bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="truncate text-2xl font-bold">{value}</p>
            {sub && (
              <p className="truncate text-xs text-muted-foreground">{sub}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

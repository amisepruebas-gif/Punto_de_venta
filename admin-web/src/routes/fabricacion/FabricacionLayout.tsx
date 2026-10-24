import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/fabricacion", label: "Producción", end: true },
  { to: "/fabricacion/articulos", label: "Artículos fabricados", end: false },
  { to: "/fabricacion/zonas", label: "Zonas de precios", end: false },
  { to: "/fabricacion/catalogo", label: "Catálogo", end: false },
];

/** Encabezado y pestañas de la sección Fabricación. */
export function FabricacionLayout() {
  return (
    <div className="container max-w-6xl space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fabricación</h1>
        <p className="text-sm text-muted-foreground">
          Lo que elaboras: producción por fechas, existencias en taller y
          sucursales, precios por zona y catálogo de mayoreo.
        </p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

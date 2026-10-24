import { Route, Routes } from "react-router-dom";
import { FabricacionLayout } from "./FabricacionLayout";
import { ZonasPage } from "./ZonasPage";

/** Rutas de `/fabricacion/*`. App.tsx solo monta este componente. */
export function FabricacionRoutes() {
  return (
    <Routes>
      <Route element={<FabricacionLayout />}>
        <Route index element={<EnConstruccion />} />
        <Route path="articulos" element={<EnConstruccion />} />
        <Route path="zonas" element={<ZonasPage />} />
        <Route path="catalogo" element={<EnConstruccion />} />
      </Route>
    </Routes>
  );
}

function EnConstruccion() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Próximamente.
    </p>
  );
}

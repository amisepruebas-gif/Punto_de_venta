import { Route, Routes } from "react-router-dom";
import { FabricacionLayout } from "./FabricacionLayout";
import { ProduccionPage } from "./ProduccionPage";
import { RegistrarProduccionPage } from "./RegistrarProduccionPage";
import { FabricadosPage } from "./FabricadosPage";
import { FabricadoDetallePage } from "./FabricadoDetallePage";
import { ZonasPage } from "./ZonasPage";

/** Rutas de `/fabricacion/*`. App.tsx solo monta este componente. */
export function FabricacionRoutes() {
  return (
    <Routes>
      <Route element={<FabricacionLayout />}>
        <Route index element={<ProduccionPage />} />
        <Route path="registrar" element={<RegistrarProduccionPage />} />
        <Route path="articulos" element={<FabricadosPage />} />
        <Route path="articulos/:id" element={<FabricadoDetallePage />} />
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

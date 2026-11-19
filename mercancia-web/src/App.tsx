import { Navigate, Route, Routes } from "react-router-dom";
import { FirstRun } from "@/routes/FirstRun";
import { Login } from "@/routes/Login";
import { Home } from "@/routes/Home";
import { ArticulosListPage } from "@/routes/articulos/ArticulosListPage";
import { ArticuloEditPage } from "@/routes/articulos/ArticuloEditPage";
import { CategoriasPage } from "@/routes/categorias/CategoriasPage";
import { TallasPage } from "@/routes/tallas/TallasPage";
import { IngresoMercanciaPage } from "@/routes/ingreso-mercancia/IngresoMercanciaPage";
import { ResurtidosListPage } from "@/routes/resurtidos/ResurtidosListPage";
import { ResurtidoCreatePage } from "@/routes/resurtidos/ResurtidoCreatePage";
import { ResurtidoDetailPage } from "@/routes/resurtidos/ResurtidoDetailPage";
import { EnlaceLayout } from "@/routes/enlace/EnlaceLayout";
import { EntrarPage } from "@/routes/enlace/EntrarPage";
import { MisLotesPage } from "@/routes/enlace/MisLotesPage";
import { ArmarLotePage } from "@/routes/enlace/ArmarLotePage";
import { FotosPage } from "@/routes/enlace/FotosPage";
import { EtiquetasPage } from "@/routes/enlace/EtiquetasPage";
import { PrecioPage } from "@/routes/precio/PrecioPage";
import { AuthWatcher } from "@/features/auth/AuthWatcher";
import { useSession } from "@/hooks/useSession";

export default function App() {
  const { binding, auth } = useSession();

  // Guard común para rutas autenticadas: requiere binding + auth.
  function Protected({ children }: { children: React.ReactNode }) {
    if (!binding) return <Navigate to="/first-run" replace />;
    if (!auth) return <Navigate to="/login" replace />;
    return <>{children}</>;
  }

  return (
    <>
      <AuthWatcher />
      <Routes>
        <Route path="/first-run" element={<FirstRun />} />
      <Route
        path="/login"
        element={
          binding ? (
            auth ? (
              <Navigate to="/" replace />
            ) : (
              <Login />
            )
          ) : (
            <Navigate to="/first-run" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Home />
          </Protected>
        }
      />
      <Route
        path="/articulos"
        element={
          <Protected>
            <ArticulosListPage />
          </Protected>
        }
      />
      <Route
        path="/articulos/nuevo"
        element={
          <Protected>
            <ArticuloEditPage />
          </Protected>
        }
      />
      <Route
        path="/articulos/:id"
        element={
          <Protected>
            <ArticuloEditPage />
          </Protected>
        }
      />
      <Route
        path="/categorias"
        element={
          <Protected>
            <CategoriasPage />
          </Protected>
        }
      />
      <Route
        path="/tallas"
        element={
          <Protected>
            <TallasPage />
          </Protected>
        }
      />
      <Route
        path="/ingreso"
        element={
          <Protected>
            <IngresoMercanciaPage />
          </Protected>
        }
      />
      <Route
        path="/resurtidos"
        element={
          <Protected>
            <ResurtidosListPage />
          </Protected>
        }
      />
      <Route
        path="/resurtidos/nuevo"
        element={
          <Protected>
            <ResurtidoCreatePage />
          </Protected>
        }
      />
      <Route
        path="/resurtidos/:id"
        element={
          <Protected>
            <ResurtidoDetailPage />
          </Protected>
        }
      />
      {/* Teléfono que entra por un enlace de lote: SIN PIN ni sucursal
          (va fuera de Protected). Usa su propia sesión de Firebase
          (`firebase/enlaceApp.ts`); AuthWatcher solo vigila la de PIN. */}
      <Route path="/enlace/:negocioId/:enlaceId" element={<EnlaceLayout />}>
        <Route index element={<EntrarPage />} />
        <Route path="lotes" element={<MisLotesPage />} />
        <Route path="lotes/:loteId" element={<ArmarLotePage />} />
        <Route path="fotos" element={<FotosPage />} />
        <Route path="etiquetas" element={<EtiquetasPage />} />
        <Route path="*" element={<EntrarPage />} />
      </Route>
      {/* Página aparte de etiquetas de precio (código + precio, como la app
          "codigos"): entra un equipo con un enlace `precio` de admin, sin PIN. */}
      <Route path="/precio/:negocioId/:enlaceId" element={<EnlaceLayout prefijo="precio" />}>
        <Route index element={<PrecioPage />} />
        <Route path="*" element={<PrecioPage />} />
      </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

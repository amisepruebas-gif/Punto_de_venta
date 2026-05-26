import { Routes, Route, Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Login } from "./routes/Login";
import { Dashboard } from "./routes/Dashboard";
import { ArticulosPage } from "./routes/articulos/ArticulosPage";
import { ArticuloEditPage } from "./routes/articulos/ArticuloEditPage";
import { CategoriasPage } from "./routes/categorias/CategoriasPage";
import { IngresoMercanciaPage } from "./routes/ingreso-mercancia/IngresoMercanciaPage";
import { SucursalesPage } from "./routes/sucursales/SucursalesPage";
import { EditarTicketPage } from "./routes/sucursales/EditarTicketPage";
import { NodosPage } from "./routes/nodos/NodosPage";
import { EquipoPage } from "./routes/equipo/EquipoPage";
import { UsuariosMercanciaPage } from "./routes/usuarios-mercancia/UsuariosMercanciaPage";
import { ResurtidosPage } from "./routes/resurtidos/ResurtidosPage";
import { ResurtidoCreatePage } from "./routes/resurtidos/ResurtidoCreatePage";
import { ResurtidoDetailPage } from "./routes/resurtidos/ResurtidoDetailPage";
import { TallasPage } from "./routes/tallas/TallasPage";
import { VentasPage } from "./routes/ventas/VentasPage";
import { PinAdminVentasGate } from "./features/ventas-admin/PinAdminVentasGate";
import { CortesPage } from "./routes/cortes/CortesPage";
import { ApartadosPage } from "./routes/apartados/ApartadosPage";
import { MasVendidosPage } from "./routes/reportes/MasVendidosPage";
import { BuscarPorArticuloPage } from "./routes/reportes/BuscarPorArticuloPage";
import { GastosFirebasePage } from "./routes/gastos/GastosFirebasePage";
import { NanobananaPage } from "./routes/gastos/NanobananaPage";
import { MigracionPage } from "./routes/ajustes/MigracionPage";
import { AjustesPage } from "./routes/ajustes/AjustesPage";
import { EquipoChatPage } from "./routes/equipo-chat/EquipoChatPage";
import { ChatPage } from "./routes/chat/ChatPage";
import { AppShell } from "./components/AppShell";
import { useAuth } from "./hooks/useAuth";
import { auth } from "./firebase/config";
import { Button } from "./components/ui/button";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  // FIX A5: role guard. Solo superadmin/admin entran. Un nodo o vendedor
  // autenticado no puede entrar al panel admin.
  const rolePermitido =
    user?.claims.role === "superadmin" || user?.claims.role === "admin";

  if (user && !rolePermitido) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Acceso denegado</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta no tiene permisos de administrador.
            {user.claims.role ? ` (rol: ${user.claims.role})` : ""}
          </p>
          <Button variant="outline" onClick={() => signOut(auth)} className="w-full">
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      {user ? (
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="articulos" element={<ArticulosPage />} />
          <Route path="articulos/nuevo" element={<ArticuloEditPage />} />
          <Route path="articulos/:id" element={<ArticuloEditPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="ingreso-mercancia" element={<IngresoMercanciaPage />} />
          <Route path="sucursales" element={<SucursalesPage />} />
          <Route
            path="sucursales/:sid/ticket"
            element={<EditarTicketPage />}
          />
          <Route path="nodos" element={<NodosPage />} />
          <Route path="equipo" element={<EquipoPage />} />
          <Route path="equipo-chat" element={<EquipoChatPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route
            path="usuarios-mercancia"
            element={<UsuariosMercanciaPage />}
          />
          <Route path="resurtidos" element={<ResurtidosPage />} />
          <Route
            path="resurtidos/nuevo"
            element={<ResurtidoCreatePage />}
          />
          <Route
            path="resurtidos/:id"
            element={<ResurtidoDetailPage />}
          />
          <Route path="tallas" element={<TallasPage />} />
          <Route
            path="ventas"
            element={
              <PinAdminVentasGate>
                <VentasPage />
              </PinAdminVentasGate>
            }
          />
          <Route path="cortes" element={<CortesPage />} />
          <Route path="apartados" element={<ApartadosPage />} />
          <Route path="reportes/mas-vendidos" element={<MasVendidosPage />} />
          <Route path="reportes/articulo" element={<BuscarPorArticuloPage />} />
          <Route path="gastos-firebase" element={<GastosFirebasePage />} />
          <Route path="gastos-firebase/nanobanana" element={<NanobananaPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="ajustes/migracion" element={<MigracionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

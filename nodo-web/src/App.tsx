import { Routes, Route, Navigate } from "react-router-dom";
import { FirstRun } from "./routes/FirstRun";
import { Ventas } from "./routes/Ventas";
import { Ajustes } from "./routes/Ajustes";
import { ResurtidosNodoPage } from "./routes/resurtidos/ResurtidosNodoPage";
import { ResurtidoNodoDetailPage } from "./routes/resurtidos/ResurtidoNodoDetailPage";
import { useNodoSession } from "./hooks/useNodoSession";
import { useRefrescoRender } from "./hooks/useRefrescoRender";
import { useSubirSesiones } from "./features/resurtidos/recepcionStore";

/** Sube las recepciones de lotes que quedaron en la tablet sin internet,
 *  aunque la caja esté en otra pantalla (vendiendo). */
function SubidorRecepcionesLote() {
  useSubirSesiones();
  return null;
}

export default function App() {
  const { nodoId, loading } = useNodoSession();
  // Escucha la señal remota de "Forzar recarga" disparada por admin-web
  // desde NodosPage. El hook se auto-skipea cuando aún no hay sesión.
  useRefrescoRender();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <>
      {nodoId && <SubidorRecepcionesLote />}
      <Routes>
        <Route
          path="/first-run"
          element={nodoId ? <Navigate to="/" replace /> : <FirstRun />}
        />
        <Route
          path="/"
          element={nodoId ? <Ventas /> : <Navigate to="/first-run" replace />}
        />
        <Route
          path="/ajustes"
          element={nodoId ? <Ajustes /> : <Navigate to="/first-run" replace />}
        />
        <Route
          path="/resurtidos"
          element={
            nodoId ? <ResurtidosNodoPage /> : <Navigate to="/first-run" replace />
          }
        />
        <Route
          path="/resurtidos/:id"
          element={
            nodoId ? (
              <ResurtidoNodoDetailPage />
            ) : (
              <Navigate to="/first-run" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

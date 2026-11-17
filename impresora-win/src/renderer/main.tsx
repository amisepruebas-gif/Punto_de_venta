import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilos.css";

// Sin StrictMode: montaría dos veces el agente (dos escuchas de la cola).
createRoot(document.getElementById("root")!).render(<App />);

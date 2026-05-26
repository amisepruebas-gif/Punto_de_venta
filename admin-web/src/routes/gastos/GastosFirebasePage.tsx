import { Link } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";

/**
 * Hub de "Gastos Firebase". Por ahora solo lista el módulo de
 * Nano Banana (Gemini); a futuro pueden agregarse otros (Storage,
 * Functions, Firestore reads, etc.).
 */
export function GastosFirebasePage() {
  return (
    <div className="container max-w-4xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Gastos Firebase
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Costos asociados a servicios externos. Cada módulo lleva su
          propio registro.
        </p>
      </div>

      <ul className="space-y-2">
        <li>
          <Link
            to="/gastos-firebase/nanobanana"
            className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">API Nano Banana (Gemini)</p>
              <p className="text-xs text-muted-foreground">
                Imágenes de productos con fondo eliminado · ~$0.039 USD
                por operación
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      </ul>
    </div>
  );
}

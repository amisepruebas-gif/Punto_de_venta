import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePinAdminVentas } from "./usePinAdminVentas";

const STORAGE_KEY = "amise.adminVentas.pinOk";

/**
 * Envoltorio de la página `/ventas`. Pide un PIN antes de mostrar el
 * contenido. Una vez ingresado correctamente, queda autorizado mientras
 * dure la pestaña (sessionStorage). Si recargas o cierras pestaña,
 * vuelve a pedirlo.
 *
 * El PIN sale de Firestore (`pinAdminVentas.valor`) o del fallback
 * hardcoded ("7849"). Solo se cambia editando el doc en Firebase
 * Console — no hay UI para hacerlo desde la app.
 */
function leerSesion(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function PinAdminVentasGate({ children }: { children: ReactNode }) {
  const { pin: pinCorrecto, loading } = usePinAdminVentas();
  const [pinSesion, setPinSesion] = useState<string | null>(() => leerSesion());
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-des-autorizar si el PIN correcto cambia y ya no coincide con el
  // que el usuario había ingresado en esta sesión. Esto hace que cambiar
  // el PIN en Firestore expulse a sesiones activas que estaban con el
  // PIN viejo (medida útil si se cambia por sospecha de filtración).
  // Mientras `loading` es true, no comparamos — `pinCorrecto` aún tiene
  // el fallback default y podría dar falso negativo.
  const autorizado = !loading && pinSesion !== null && pinSesion === pinCorrecto;

  useEffect(() => {
    if (!autorizado) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autorizado]);

  // Si pinSesion quedó obsoleto, limpiamos sessionStorage.
  useEffect(() => {
    if (loading) return;
    if (pinSesion !== null && pinSesion !== pinCorrecto) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
      setPinSesion(null);
    }
  }, [loading, pinSesion, pinCorrecto]);

  function intentar() {
    if (loading) return;
    if (valor === pinCorrecto) {
      try {
        sessionStorage.setItem(STORAGE_KEY, valor);
      } catch {
        /* noop */
      }
      setPinSesion(valor);
      setValor("");
      setError(null);
    } else {
      setError("Contraseña incorrecta");
      setValor("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  if (autorizado) return <>{children}</>;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-[20rem] max-w-full rounded-2xl border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight">Acceso a Ventas</h2>
            <p className="text-[11px] text-muted-foreground">
              Esta sección está protegida con contraseña.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") intentar();
          }}
          placeholder="••••"
          disabled={loading}
          className="block h-12 w-full rounded-md border border-input bg-background px-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/40"
        />

        {error && (
          <p className="mt-2 text-center text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <Button
          onClick={intentar}
          disabled={loading || !valor}
          className="mt-3 w-full"
        >
          {loading ? "Cargando…" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}

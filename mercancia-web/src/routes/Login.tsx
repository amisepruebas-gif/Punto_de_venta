import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Delete, Loader2, Settings } from "lucide-react";
import { db } from "@/firebase/config";
import { Button } from "@/components/ui/button";
import {
  getBinding,
  setAuth,
  setBinding,
  useSession,
} from "@/hooks/useSession";
import {
  hashPin,
  isValidPin,
  paths,
  type UsuarioMercancia,
} from "@shared";

const PIN_LEN = 5;

/**
 * Pantalla de login con teclado numérico estilo POS. El operador ingresa
 * 5 dígitos; cada dígito que escribe se compara contra los PINs hasheados
 * de la sucursal vinculada. Cuando llega al 5° dígito, valida.
 */
export function Login() {
  const navigate = useNavigate();
  const { binding } = useSession();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  if (!binding) {
    // Sin binding no hay sucursal — manda a FirstRun.
    navigate("/first-run", { replace: true });
    return null;
  }

  function pulsar(d: string) {
    if (verificando) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= PIN_LEN) return prev;
      const next = prev + d;
      if (next.length === PIN_LEN) {
        verificar(next);
      }
      return next;
    });
  }

  function borrar() {
    if (verificando) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }

  async function verificar(intentado: string) {
    if (!binding) return;
    if (!isValidPin(intentado)) {
      setError("PIN inválido");
      return;
    }
    setVerificando(true);
    try {
      const hash = await hashPin(intentado);
      const colRef = collection(
        db,
        paths.usuariosMercanciaCol(binding.negocioId, binding.sucursalId),
      );
      const q = query(colRef, where("pinHash", "==", hash));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("PIN no reconocido");
        setPin("");
        return;
      }
      const docSnap = snap.docs[0]!;
      const data = docSnap.data() as UsuarioMercancia;
      if (!data.habilitado) {
        setError("Acceso deshabilitado para este usuario");
        setPin("");
        return;
      }
      setAuth({ usuarioId: data.id, nombre: data.nombre, ts: Date.now() });
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setPin("");
    } finally {
      setVerificando(false);
    }
  }

  function cambiarSucursal() {
    setBinding(null);
    navigate("/first-run", { replace: true });
  }

  const filled = pin.length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col p-4">
      <header className="flex items-start justify-between gap-2 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
            {getBinding()?.negocioNombre}
          </p>
          <h1 className="truncate text-lg font-semibold">
            {binding.sucursalNombre}
          </h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={cambiarSucursal}
          aria-label="Cambiar sucursal"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <p className="text-sm text-muted-foreground">Ingresa tu PIN</p>
        <div className="flex gap-2">
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full ${
                i < filled ? "bg-primary" : "border border-input bg-background"
              }`}
            />
          ))}
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}
        {verificando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Numpad key={d} onClick={() => pulsar(d)} disabled={verificando}>
            {d}
          </Numpad>
        ))}
        <div />
        <Numpad onClick={() => pulsar("0")} disabled={verificando}>
          0
        </Numpad>
        <Numpad
          onClick={borrar}
          disabled={verificando || filled === 0}
          aria-label="Borrar"
        >
          <Delete className="h-6 w-6" />
        </Numpad>
      </div>
    </div>
  );
}

function Numpad({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-16 items-center justify-center rounded-xl border bg-card text-2xl font-medium shadow-sm transition active:scale-95 active:bg-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}

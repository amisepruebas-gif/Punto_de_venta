import { useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { fnVerificarAdminWhitelist } from "../firebase/callables";

// Negocio default — mismo fallback que `useNegocio`. Antes del login no
// hay claims; se asume `amise` (single-tenant). Cuando haya UI multi-
// negocio, este valor lo elegirá el user al inicio.
const NEGOCIO_DEFAULT = import.meta.env.VITE_NEGOCIO_ID || "amise";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingGoogle, setSubmittingGoogle] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleSignIn() {
    setError(null);
    setSubmittingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);

      // Si la cuenta YA trae claims de superadmin/admin, saltamos la
      // verificación de whitelist. La whitelist sólo sirve para *elevar*
      // admin-delegados nuevos; para el superadmin (jesús, bootstrapeado por
      // setup-initial y que NO está en la whitelist) `verificarAdminWhitelist`
      // lanzaría permission-denied y el catch lo sacaría con signOut →
      // "abre y se regresa al login". Forzamos refresh del token para leer
      // los claims server-side más recientes.
      const tokenResult = await cred.user.getIdTokenResult(true);
      const rolActual = tokenResult.claims.role;
      if (rolActual === "superadmin" || rolActual === "admin") {
        return; // onIdTokenChanged ya tiene al usuario con rol válido.
      }

      // Verificar contra la whitelist del negocio. La CF persiste el `uid`
      // en el doc de la whitelist y eleva claims a {role:"admin", negocioId}.
      try {
        await fnVerificarAdminWhitelist({ negocioId: NEGOCIO_DEFAULT });
      } catch (verifyErr) {
        // El email no está en la whitelist o está deshabilitado. Salir y
        // explicar al usuario.
        await signOut(auth).catch(() => undefined);
        const msg = (verifyErr as { code?: string; message?: string }).message;
        setError(
          msg && msg.toLowerCase().includes("permission")
            ? "Cuenta no autorizada. Pide a un admin que te agregue a la whitelist desde Equipo chat."
            : msg || "No se pudo verificar la cuenta.",
        );
        return;
      }

      // Refrescar token para tomar los claims nuevos. Sin esto el cliente
      // sigue con un token sin role="admin" hasta el próximo refresh
      // (típicamente 1 h).
      await auth.currentUser?.getIdToken(true);
    } catch (err) {
      // El user cerró el popup o el provider falló.
      const code = (err as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError((err as Error).message);
      }
    } finally {
      setSubmittingGoogle(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Amise — Admin</h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu cuenta administrador
          </p>
        </div>

        {/* Google sign-in — admin-delegados con whitelist */}
        <Button
          type="button"
          variant="outline"
          onClick={onGoogleSignIn}
          disabled={submittingGoogle || submitting}
          className="w-full"
        >
          {submittingGoogle ? "Verificando…" : "Continuar con Google"}
        </Button>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-card px-2 text-muted-foreground">o</span>
          </div>
        </div>

        {/* Email + password legacy — fallback durante transición. Cuando
            todos los admins migren a Google + whitelist, este formulario
            se puede ocultar/eliminar (Fase F8+). */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={submitting || submittingGoogle}
            className="w-full"
          >
            {submitting ? "Entrando…" : "Iniciar sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}

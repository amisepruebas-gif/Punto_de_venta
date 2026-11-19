import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Copy, LogIn, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entrarConEnlace, urlCompletaEnMemoria } from "@/firebase/enlaceApp";
import { rutaDeSesion, useEnlace } from "@/features/enlace/EnlaceContext";
import { Aviso, AvisoError, BotonGrande } from "@/features/enlace/ui";

/** Navegadores dentro de otras apps (WhatsApp, Facebook, Instagram…) o
 *  sin acceso a la cámara: el escáner puede no abrir. */
function camaraDudosa(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return true;
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent);
}

/**
 * Primera pantalla del enlace. El secreto se canjea al tocar "Entrar" (no
 * al abrir), así se puede pasar el enlace a Chrome sin gastarlo. Si ya hay
 * sesión en este teléfono, pasa directo.
 */
export function EntrarPage() {
  const navigate = useNavigate();
  const { negocioId, enlaceId, sesion, setSesion, secreto } = useEnlace();
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copiado, setCopiado] = useState<"si" | "no" | null>(null);
  const [dudosa] = useState(camaraDudosa);

  if (sesion) {
    return <Navigate to={rutaDeSesion(negocioId, enlaceId, sesion.tipo)} replace />;
  }

  async function entrar() {
    if (!secreto) return;
    setEntrando(true);
    setError(null);
    try {
      const s = await entrarConEnlace(negocioId, enlaceId, secreto);
      setSesion(s);
      navigate(rutaDeSesion(negocioId, enlaceId, s.tipo), { replace: true });
    } catch (e) {
      setError(e);
      setEntrando(false);
    }
  }

  async function copiar() {
    const url = urlCompletaEnMemoria(enlaceId);
    try {
      if (!url) throw new Error("sin url");
      await navigator.clipboard.writeText(url);
      setCopiado("si");
    } catch {
      setCopiado("no");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Package className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold">Envíos de mercancía</h1>
        <p className="text-lg text-muted-foreground">
          Con este enlace usas tu teléfono para los envíos: armar lotes o subir fotos de un lote.
        </p>
      </div>

      {!secreto ? (
        <Aviso tono="ojo">
          Abre el enlace completo que te mandaron. Si lo copiaste, revisa que traiga todo, también lo
          que va después del #.
        </Aviso>
      ) : (
        <>
          {dudosa && (
            <Aviso tono="ojo">
              <p>
                En este navegador quizá no sirve la cámara para escanear. Mejor ábrelo en Chrome o
                Safari: copia el enlace y pégalo allá. (También puedes teclear los códigos.)
              </p>
              <Button variant="outline" className="mt-2 h-12 w-full bg-background text-base" onClick={copiar}>
                <Copy className="mr-2 h-5 w-5" /> Copiar enlace
              </Button>
              {copiado === "si" && <p className="mt-1 text-sm">Copiado. Pégalo en Chrome o Safari.</p>}
              {copiado === "no" && (
                <p className="mt-1 text-sm">
                  No se pudo copiar. En WhatsApp mantén presionado el enlace y elige abrirlo en el
                  navegador.
                </p>
              )}
            </Aviso>
          )}
          <BotonGrande onClick={entrar} disabled={entrando}>
            <LogIn className="mr-2 h-6 w-6" />
            {entrando ? "Entrando…" : "Entrar"}
          </BotonGrande>
          {!!error && <AvisoError error={error} />}
        </>
      )}
    </div>
  );
}

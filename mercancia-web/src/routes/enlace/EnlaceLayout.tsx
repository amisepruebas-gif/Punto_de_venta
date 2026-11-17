import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { WifiOff } from "lucide-react";
import {
  recuperarSesion,
  tomarSecretoDeLaBarra,
  type SesionEnlace,
} from "@/firebase/enlaceApp";
import { EnlaceContext, type EnlaceCtx } from "@/features/enlace/EnlaceContext";
import { AvisoError, PantallaCargando } from "@/features/enlace/ui";

/** `navigator.onLine` al momento (cambia con los eventos del navegador). */
function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener("online", si);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", si);
      window.removeEventListener("offline", no);
    };
  }, []);
  return enLinea;
}

/**
 * Marco de todo `/enlace/:negocioId/:enlaceId/*`: lee (y borra de la barra)
 * el secreto, recupera la sesión que ya hubiera en este teléfono y se la
 * pasa a las pantallas. Va FUERA de `Protected`: aquí no hay PIN.
 */
export function EnlaceLayout() {
  const { negocioId = "", enlaceId = "" } = useParams();
  // El secreto se toma al primer render, antes de que nada lea la barra.
  const [secreto] = useState(() => (enlaceId ? tomarSecretoDeLaBarra(enlaceId) : null));
  const [sesion, setSesion] = useState<SesionEnlace | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const enLinea = useEnLinea();

  const recuperar = useCallback(() => {
    if (!negocioId || !enlaceId) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    recuperarSesion(negocioId, enlaceId)
      .then(setSesion)
      .catch(setError)
      .finally(() => setCargando(false));
  }, [negocioId, enlaceId]);

  useEffect(recuperar, [recuperar]);

  const ctx = useMemo<EnlaceCtx>(
    () => ({
      negocioId,
      enlaceId,
      base: `/enlace/${encodeURIComponent(negocioId)}/${encodeURIComponent(enlaceId)}`,
      sesion,
      setSesion,
      secreto,
    }),
    [negocioId, enlaceId, sesion, secreto],
  );

  return (
    <EnlaceContext.Provider value={ctx}>
      {/* Todo se guarda al momento: sin señal, que se sepa antes de capturar. */}
      {!enLinea && (
        <p
          role="alert"
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2 bg-amber-400 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-base font-medium text-black"
        >
          <WifiOff className="h-5 w-5 shrink-0" /> Sin internet: no se puede guardar hasta que vuelva la señal.
        </p>
      )}
      {cargando ? (
        <PantallaCargando texto="Abriendo…" />
      ) : error ? (
        <div className="mx-auto w-full max-w-md p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <AvisoError error={error} onReintentar={recuperar} />
        </div>
      ) : (
        <Outlet />
      )}
    </EnlaceContext.Provider>
  );
}

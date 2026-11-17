import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import QRCode from "qrcode";
import { ImageOff, Loader2 } from "lucide-react";
import { db, storage } from "@/firebase/config";
import { ENLACE_RECIBIR_VENTANA_MS, paths, type LoteFoto } from "@shared";

/** El acceso de fotos que la caja tiene abierto para un lote. */
export type AccesoFotos = { enlaceId: string; url: string; creadoMs: number };

type FotoConId = { id: string; foto: LoteFoto };

/** Fotos del lote en vivo (las sube el teléfono). */
export function useFotosLote(negocioId: string | null, loteId: string): FotoConId[] {
  const [fotos, setFotos] = useState<FotoConId[]>([]);
  useEffect(() => {
    if (!negocioId) return;
    return onSnapshot(
      collection(db, paths.loteFotosCol(negocioId, loteId)),
      (snap) => {
        const arr: FotoConId[] = [];
        snap.forEach((d) => arr.push({ id: d.id, foto: d.data() as LoteFoto }));
        // El id es `{uid}_{nn}`: en orden de teléfono y de foto.
        arr.sort((a, b) => a.id.localeCompare(b.id));
        setFotos(arr);
      },
      (e) => console.warn("Fotos del lote:", e),
    );
  }, [negocioId, loteId]);
  return fotos;
}

/** URLs ya resueltas: al volver a abrir la lista no se piden otra vez. */
const urlsResueltas = new Map<string, string>();

function Miniatura({ foto }: { foto: LoteFoto }) {
  const [url, setUrl] = useState<string | null>(() => urlsResueltas.get(foto.ruta) ?? null);
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    if (url) return;
    let vivo = true;
    getDownloadURL(storageRef(storage, foto.ruta)).then(
      (u) => {
        urlsResueltas.set(foto.ruta, u);
        if (vivo) setUrl(u);
      },
      () => {
        if (vivo) setFalla(true);
      },
    );
    return () => {
      vivo = false;
    };
  }, [foto.ruta, url]);
  return (
    <figure className="overflow-hidden rounded-md border bg-card">
      {/* Sin enlace: dentro de la APK abrir otra pestaña no regresa a la caja. */}
      {url ? (
        <img src={url} alt={foto.nota || "Foto del lote"} className="aspect-square w-full object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
          {falla ? <ImageOff className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      )}
      {foto.nota && <figcaption className="line-clamp-2 p-1 text-xs">{foto.nota}</figcaption>}
    </figure>
  );
}

export function FotosLoteLista({ fotos }: { fotos: FotoConId[] }) {
  if (fotos.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay fotos de este lote.</p>;
  }
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {fotos.map((f) => (
        <li key={f.id}>
          <Miniatura foto={f.foto} />
        </li>
      ))}
    </ul>
  );
}

/** QR del acceso con su cuenta regresiva para entrar. La URL también queda
 *  en `data-url` (la usa la prueba automatizada). */
export function QrAccesoFotos({ acceso }: { acceso: AccesoFotos }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let vivo = true;
    QRCode.toString(acceso.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(
      (s) => {
        if (vivo) setSvg(s);
      },
      () => {
        if (vivo) setSvg(null);
      },
    );
    return () => {
      vivo = false;
    };
  }, [acceso.url]);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const restaMs = Math.max(0, acceso.creadoMs + ENLACE_RECIBIR_VENTANA_MS - ahora);
  const min = Math.floor(restaMs / 60_000);
  const seg = Math.floor((restaMs % 60_000) / 1000);

  return (
    <div className="flex items-start gap-4">
      <div
        data-url={acceso.url}
        aria-label="Código QR para fotos"
        role="img"
        className={`h-52 w-52 shrink-0 rounded-md bg-white p-2 [&>svg]:h-full [&>svg]:w-full ${
          restaMs === 0 ? "opacity-30" : ""
        }`}
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <div className="min-w-0 space-y-2">
        <p className="text-sm">
          Escanéalo con la cámara del teléfono. Tienes 5 minutos para entrar; después el teléfono
          tiene 30 minutos para subir fotos.
        </p>
        <p
          className={`text-3xl font-bold tabular-nums ${
            restaMs === 0 ? "text-muted-foreground" : restaMs < 60_000 ? "text-orange-600" : ""
          }`}
          aria-live="off"
        >
          {min}:{String(seg).padStart(2, "0")}
        </p>
        {restaMs === 0 && (
          <p className="text-sm text-muted-foreground">
            Ya pasó el tiempo para entrar. Si el teléfono no alcanzó, crea otro código.
          </p>
        )}
      </div>
    </div>
  );
}

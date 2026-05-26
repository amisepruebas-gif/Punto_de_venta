import { useState } from "react";
import {
  Database,
  Image as ImageIcon,
  Layout,
  RefreshCw,
  X,
} from "lucide-react";
import { terminate } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { db } from "@/firebase/config";
import { posDisponible, vaciarCacheImagenes } from "@/lib/pos-bridge";
import {
  limpiarRender as limpiarRenderUtil,
  recargarConCacheBust,
} from "@/lib/limpiarRender";

type Opcion = "render" | "imagenes" | "datos";
type Seleccion = Set<Opcion>;

const TODAS: Opcion[] = ["render", "imagenes", "datos"];

/**
 * Sección "App" — abre un modal que deja al usuario elegir qué cachés
 * limpiar al recargar:
 *
 *  - **Renderizado**: Service Worker + workbox-precache (HTML/JS/CSS).
 *  - **Imágenes**: cache local /img/ + cache de imágenes del catálogo
 *    en la APK (Firebase Storage). Llama al bridge `vaciarCacheImagenes`
 *    cuando corre dentro de la APK.
 *  - **Datos**: IndexedDB de Firestore (artículos, ventas, mensajes,
 *    apartados, equipo, etc.). El servidor mantiene la fuente de verdad,
 *    así que borrar el cache solo fuerza re-sincronización al reabrir.
 *
 * Después de aplicar las limpiezas seleccionadas, recarga la página con
 * cache-bust en la URL.
 */
export function AppCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="space-y-2 rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Aplicación</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Si la app se ve rara o quieres tomar un deploy nuevo, recárgala
          eligiendo qué limpiar.
        </p>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar app…
        </Button>
      </section>

      <RecargarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function RecargarModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [seleccion, setSeleccion] = useState<Seleccion>(new Set(["render"]));
  const [ejecutando, setEjecutando] = useState(false);

  function toggle(op: Opcion) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(op)) next.delete(op);
      else next.add(op);
      return next;
    });
  }

  function setTodo(activar: boolean) {
    setSeleccion(activar ? new Set(TODAS) : new Set());
  }

  async function ejecutar() {
    if (seleccion.size === 0 || ejecutando) return;
    setEjecutando(true);
    try {
      if (seleccion.has("render")) await limpiarRenderUtil();
      if (seleccion.has("imagenes")) await limpiarImagenes();
      if (seleccion.has("datos")) await limpiarDatos();
    } catch (err) {
      console.error("Error en recargar:", err);
    }
    recargarConCacheBust();
  }

  if (!open) return null;
  const todoMarcado = seleccion.size === TODAS.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[26rem] max-w-full overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Recargar app</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 p-4">
          <p className="text-xs text-muted-foreground">
            Marca qué quieres limpiar antes de recargar.
          </p>

          <CheckRow
            label="Todo"
            descripcion="Selecciona todos"
            icon={null}
            checked={todoMarcado}
            indeterminate={!todoMarcado && seleccion.size > 0}
            onChange={() => setTodo(!todoMarcado)}
            destacado
          />

          <CheckRow
            label="Renderizado"
            descripcion="HTML/JS/CSS de la app · service worker."
            icon={Layout}
            checked={seleccion.has("render")}
            onChange={() => toggle("render")}
          />
          <CheckRow
            label="Imágenes"
            descripcion="Catálogo (APK) · mensajes · fondos locales."
            icon={ImageIcon}
            checked={seleccion.has("imagenes")}
            onChange={() => toggle("imagenes")}
          />
          <CheckRow
            label="Datos del negocio"
            descripcion="Artículos, ventas, mensajes, apartados (cache de Firestore). El servidor los vuelve a enviar al reconectar."
            icon={Database}
            checked={seleccion.has("datos")}
            onChange={() => toggle("datos")}
          />
        </div>

        <div className="flex gap-2 border-t bg-muted/30 px-4 py-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={ejecutando}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={ejecutar}
            disabled={ejecutando || seleccion.size === 0}
            className="flex-1"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${ejecutando ? "animate-spin" : ""}`}
            />
            {ejecutando ? "Recargando…" : "Recargar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type CheckProps = {
  label: string;
  descripcion: string;
  icon: React.ComponentType<{ className?: string }> | null;
  checked: boolean;
  indeterminate?: boolean;
  destacado?: boolean;
  onChange: () => void;
};

function CheckRow({
  label,
  descripcion,
  icon: Icono,
  checked,
  indeterminate,
  destacado,
  onChange,
}: CheckProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
        checked
          ? "border-primary/60 bg-primary/5"
          : indeterminate
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:bg-muted/50"
      } ${destacado ? "border-dashed" : ""}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : indeterminate
              ? "border-primary bg-primary/30"
              : "border-input"
        }`}
        aria-hidden
      >
        {checked && <CheckMark />}
        {!checked && indeterminate && (
          <span className="block h-0.5 w-2.5 bg-primary" />
        )}
      </span>
      {Icono && (
        <Icono className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {descripcion}
        </p>
      </div>
    </button>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Limpiezas ----------

async function limpiarImagenes() {
  // Browser cache local de /img/ (fondos, billetes, cabeceras).
  if (typeof caches !== "undefined") {
    await caches.delete("img-static").catch(() => false);
  }
  // Cache de imágenes del catálogo en la APK (filesystem Android).
  if (posDisponible()) {
    try {
      vaciarCacheImagenes();
    } catch (e) {
      console.warn("vaciarCacheImagenes APK:", e);
    }
  }
}

async function limpiarDatos() {
  // Cerrar Firestore antes de borrar IndexedDB para evitar pelea entre la
  // SDK y el delete pendiente (`onblocked`).
  try {
    await terminate(db);
  } catch (e) {
    console.warn("terminate firestore:", e);
  }
  try {
    // `indexedDB.databases()` está disponible en Chromium (Android WebView).
    const idb = indexedDB as IDBFactory & {
      databases?: () => Promise<{ name?: string }[]>;
    };
    if (typeof idb.databases === "function") {
      const dbs = await idb.databases();
      await Promise.all(
        dbs
          // Solo `firestore*` (offline cache de Firestore). Evitamos
          // `firebase*` para no tocar `firebaseLocalStorageDb` (token de
          // Firebase Auth — desloguearía al usuario si se usa).
          .filter((d) => d.name && d.name.startsWith("firestore"))
          .map(
            (d) =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(d.name as string);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              }),
          ),
      );
    }
  } catch (e) {
    console.warn("limpiarDatos:", e);
  }
}

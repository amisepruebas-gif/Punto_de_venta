import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { ChevronRight, Loader2, Store } from "lucide-react";
import { db } from "@/firebase/config";
import { Button } from "@/components/ui/button";
import { setBinding } from "@/hooks/useSession";
import { COL_NEGOCIOS, COL_SUCURSALES, paths } from "@shared";

type NegocioMin = { id: string; nombre: string };
type SucursalMin = { id: string; nombre: string };

/**
 * Primera ejecución: el operador elige el negocio y luego la sucursal.
 * Se guarda en localStorage y de ahí en adelante el login es sólo PIN.
 *
 * Privacy caveat (mientras `firestore.rules` esté en `if true`): la lista
 * de negocios viene de un `getDocs(COL_NEGOCIOS)` sin filtro. Si en el
 * futuro el proyecto Firebase aloja múltiples tenants no relacionados, el
 * operador vería todos los nombres. Fix correcto: backend o reglas que
 * filtren por dominio/IP/QR. Hoy es aceptable porque la base es
 * single-tenant.
 */
export function FirstRun() {
  const navigate = useNavigate();
  const [negocios, setNegocios] = useState<NegocioMin[] | null>(null);
  const [sucursales, setSucursales] = useState<SucursalMin[] | null>(null);
  const [negocio, setNegocio] = useState<NegocioMin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDocs(collection(db, COL_NEGOCIOS))
      .then((snap) => {
        if (cancelled) return;
        const list: NegocioMin[] = [];
        snap.forEach((d) => {
          const data = d.data() as { nombre?: string };
          list.push({ id: d.id, nombre: data.nombre ?? d.id });
        });
        list.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setNegocios(list);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function elegirNegocio(n: NegocioMin) {
    setError(null);
    setLoading(true);
    try {
      const snap = await getDocs(
        collection(db, `${paths.negocio(n.id)}/${COL_SUCURSALES}`),
      );
      const list: SucursalMin[] = [];
      snap.forEach((d) => {
        const data = d.data() as { nombre?: string };
        list.push({ id: d.id, nombre: data.nombre ?? d.id });
      });
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setNegocio(n);
      setSucursales(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function elegirSucursal(s: SucursalMin) {
    if (!negocio) return;
    // Verificar que la sucursal exista (defensivo).
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, paths.sucursal(negocio.id, s.id)));
      if (!snap.exists()) {
        setError("La sucursal seleccionada ya no existe");
        return;
      }
      setBinding({
        negocioId: negocio.id,
        negocioNombre: negocio.nombre,
        sucursalId: s.id,
        sucursalNombre: s.nombre,
      });
      navigate("/login", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-4">
      <div className="flex items-center gap-2 py-4">
        <Store className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Configurar dispositivo</h1>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!negocio ? (
        <Sec
          title="Elige el negocio"
          loading={loading}
          empty={negocios?.length === 0 ? "No hay negocios" : null}
        >
          {negocios?.map((n) => (
            <RowButton key={n.id} title={n.nombre} subtitle={`#${n.id}`} onClick={() => elegirNegocio(n)} />
          ))}
        </Sec>
      ) : (
        <Sec
          title={`Sucursal de ${negocio.nombre}`}
          loading={loading}
          empty={sucursales?.length === 0 ? "Este negocio no tiene sucursales" : null}
        >
          {sucursales?.map((s) => (
            <RowButton key={s.id} title={s.nombre} subtitle={`#${s.id}`} onClick={() => elegirSucursal(s)} />
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 self-start"
            onClick={() => {
              setNegocio(null);
              setSucursales(null);
            }}
          >
            ← Cambiar negocio
          </Button>
        </Sec>
      )}
    </div>
  );
}

function Sec({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {loading && (
        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      )}
      {!loading && empty && (
        <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
      {!loading && children}
    </section>
  );
}

function RowButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border bg-card p-3 text-left transition hover:border-primary"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  IMPRESION_TOPE_PIEZAS,
  esCodigoArticuloFinal,
  impresoraConectada,
  type RenglonEtiquetaPrecio,
} from "@shared";
import {
  idsOrdenesPrecio,
  mandarEtiquetasPrecio,
} from "@/features/impresoras/impresoraService";
import { useImpresoras } from "@/features/impresoras/useImpresoras";

const LS_IMPRESORA = "admin.etiquetas.impresora";

function guardada(): string {
  try {
    return localStorage.getItem(LS_IMPRESORA) ?? "";
  } catch {
    return "";
  }
}

/** Precio como lo pide la etiqueta: hasta dos decimales, sin ceros de más. */
function precioEtiqueta(precio: string): string {
  const n = Number(precio);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export type FinalParaEtiqueta = { codigo: string; nombre: string };

/**
 * Manda a una impresora de etiquetas una etiqueta de precio por cada
 * artículo final (su código de 8 dígitos y el precio de mayoreo), con las
 * copias que se indiquen.
 */
export function EtiquetasFinales({
  negocioId,
  finales,
  precio,
}: {
  negocioId: string;
  finales: FinalParaEtiqueta[];
  precio: string;
}) {
  const { impresoras, loading } = useImpresoras();
  const { user } = useAuth();
  const quien = user?.user.email ?? "";
  const [ahora, setAhora] = useState(() => Date.now());
  const [impresoraId, setImpresoraId] = useState(guardada);
  const [copias, setCopias] = useState<Record<string, string>>({});
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviadas, setEnviadas] = useState<number | null>(null);
  // Los ids de las órdenes se reusan si se reintenta lo mismo: una orden que
  // sí llegó no sale doble.
  const intento = useRef<{ firma: string; ids: string[] } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!impresoraId && impresoras.length === 1) setImpresoraId(impresoras[0]!.id);
  }, [impresoras, impresoraId]);

  const conCodigo = useMemo(
    () => finales.filter((f) => esCodigoArticuloFinal(f.codigo)),
    [finales],
  );
  const precioTxt = precioEtiqueta(precio);
  const elegida = impresoras.find((i) => i.id === impresoraId);

  const renglones: RenglonEtiquetaPrecio[] = conCodigo
    .map((f) => ({
      codigo: f.codigo,
      precio: precioTxt,
      piezas: Number(copias[f.codigo] ?? "1"),
      nombre: f.nombre,
    }))
    .filter((r) => r.piezas !== 0);
  const invalido = renglones.some(
    (r) => !Number.isInteger(r.piezas) || r.piezas < 1 || r.piezas > IMPRESION_TOPE_PIEZAS,
  );
  const total = invalido ? 0 : renglones.reduce((s, r) => s + r.piezas, 0);

  function ponerATodas(valor: string) {
    setCopias(Object.fromEntries(conCodigo.map((f) => [f.codigo, valor])));
    setEnviadas(null);
  }

  async function mandar() {
    if (!elegida || invalido || total === 0 || !precioTxt) return;
    setMandando(true);
    setError(null);
    setEnviadas(null);
    try {
      try {
        localStorage.setItem(LS_IMPRESORA, elegida.id);
      } catch {
        /* sin almacenamiento */
      }
      const firma = JSON.stringify([elegida.id, renglones.map((r) => [r.codigo, r.precio, r.piezas])]);
      if (intento.current?.firma !== firma) {
        intento.current = { firma, ids: idsOrdenesPrecio(negocioId, renglones.length) };
      }
      await mandarEtiquetasPrecio(negocioId, elegida.id, renglones, quien, intento.current.ids);
      intento.current = null;
      setEnviadas(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMandando(false);
    }
  }

  if (conCodigo.length === 0) return null;
  if (!loading && impresoras.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay impresoras de etiquetas. Créala en{" "}
        <Link to="/enlaces-lote" className="underline">
          Accesos → Impresoras
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="etf-impresora">Impresora</Label>
          <select
            id="etf-impresora"
            value={impresoraId}
            onChange={(e) => setImpresoraId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">— Elige —</option>
            {impresoras.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ·{" "}
                {impresoraConectada(i, ahora) ? (i.pausada ? "en pausa" : "conectada") : "sin conexión"}
              </option>
            ))}
          </select>
          {elegida && !impresoraConectada(elegida, ahora) && (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Esa impresora no está conectada ahora: la orden espera en la cola y sale cuando se
              conecte.
            </p>
          )}
        </div>
        {conCodigo.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="etf-todas">Copias para todas</Label>
            <Input
              id="etf-todas"
              type="number"
              inputMode="numeric"
              min={0}
              max={IMPRESION_TOPE_PIEZAS}
              placeholder="1"
              onChange={(e) => ponerATodas(e.target.value)}
            />
          </div>
        )}
      </div>

      <ul className="divide-y rounded-md border">
        {conCodigo.map((f) => (
          <li key={f.codigo} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{f.nombre}</p>
              <p className="font-mono text-xs text-muted-foreground">{f.codigo}</p>
            </div>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={IMPRESION_TOPE_PIEZAS}
              value={copias[f.codigo] ?? "1"}
              onChange={(e) => {
                setCopias((c) => ({ ...c, [f.codigo]: e.target.value }));
                setEnviadas(null);
              }}
              className="w-20 text-right"
              aria-label={`Copias de ${f.nombre}`}
            />
          </li>
        ))}
      </ul>

      {!precioTxt && (
        <p className="text-sm text-destructive">Este artículo todavía no tiene precio.</p>
      )}
      {invalido && (
        <p className="text-sm text-destructive">
          Las copias van de 0 a {IMPRESION_TOPE_PIEZAS} por artículo.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {enviadas !== null && (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          Se mandaron {enviadas} {enviadas === 1 ? "etiqueta" : "etiquetas"} a {elegida?.nombre}.
        </p>
      )}

      <Button
        type="button"
        onClick={mandar}
        disabled={mandando || !elegida || invalido || total === 0 || !precioTxt}
      >
        {mandando ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Printer className="mr-2 h-4 w-4" />
        )}
        Imprimir {total} {total === 1 ? "etiqueta" : "etiquetas"} a ${precioTxt || "—"}
      </Button>
    </div>
  );
}

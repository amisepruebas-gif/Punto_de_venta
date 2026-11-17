import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Plus, Printer, RotateCcw, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNodoSession } from "@/hooks/useNodoSession";
import { useTecladoFisico } from "@/hooks/useTecladoFisico";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useCarrito } from "@/features/ventas/carritoStore";
import { resolverCodigoExacto } from "@/features/ventas/elegirArticulo";
import {
  mandarEtiquetasPrecio,
  reimprimirEtiquetas,
  useImpresorasSucursal,
  useTrabajo,
} from "@/features/etiquetas/etiquetasPrecioService";
import {
  IMPRESION_TOPE_PIEZAS,
  IMPRESION_TOPE_RENGLONES,
  RE_CODIGO_ARTICULO_ETIQUETA,
  RE_PRECIO_ETIQUETA,
  impresoraConectada,
  normalizarCodigoEscaneado,
  resolverPrecioEfectivo,
  textoEstadoTrabajo,
  type RenglonEtiquetaPrecio,
} from "@shared";

/** Un renglón en pantalla (los campos como texto mientras se escriben). */
type Fila = { id: number; codigo?: string; nombre: string; precio: string; piezas: string };

const sinFoco = (e: MouseEvent) => e.preventDefault();

function formatoPrecio(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function useAhora(cada: number): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(t);
  }, [cada]);
  return ahora;
}

/**
 * Etiquetas de precio (29 × 14 mm, como la app "codigos") en la impresora de
 * etiquetas de esta sucursal. Se escanea o teclea el código del artículo;
 * "No registrado" imprime solo el precio.
 */
export function EtiquetasPrecioPage() {
  const navigate = useNavigate();
  const { negocioId, nodoId, sucursalId } = useNodoSession();
  const enTurno = useCarrito((s) => s.enTurno);
  const { byId, bySigla, loading: cargandoArticulos } = useArticulos();
  const hayTecladoFisico = useTecladoFisico();
  const impresoras = useImpresorasSucursal(negocioId, sucursalId);
  const ahora = useAhora(15_000);
  const [impresoraId, setImpresoraId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trabajoId, setTrabajoId] = useState<string | null>(null);
  const trabajo = useTrabajo(negocioId, trabajoId);
  const siguienteId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (impresoras && impresoras.length > 0 && !impresoras.some((i) => i.id === impresoraId)) {
      setImpresoraId(impresoras[0]!.id);
    }
  }, [impresoras, impresoraId]);

  function enfocar() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function agregarFila(f: Omit<Fila, "id">) {
    setFilas((prev) => {
      // El mismo artículo otra vez: una pieza más.
      const ya = f.codigo ? prev.find((x) => x.codigo === f.codigo) : undefined;
      if (ya) {
        const n = Math.min(IMPRESION_TOPE_PIEZAS, (Number(ya.piezas) || 0) + 1);
        return prev.map((x) => (x.id === ya.id ? { ...x, piezas: String(n) } : x));
      }
      if (prev.length >= IMPRESION_TOPE_RENGLONES) {
        setAviso(`Máximo ${IMPRESION_TOPE_RENGLONES} artículos por orden: imprime estos primero.`);
        return prev;
      }
      return [...prev, { ...f, id: siguienteId.current++ }];
    });
  }

  function alEscanear(valor: string) {
    const c = normalizarCodigoEscaneado(valor);
    setCodigo("");
    setAviso(null);
    if (!c) return;
    if (cargandoArticulos) {
      setAviso("Cargando artículos… vuelve a escanear en un momento");
      return;
    }
    const r = resolverCodigoExacto(c, byId, bySigla, (id) => (byId.get(id)?.subvariaciones?.length ?? 0) > 0);
    if (!r) {
      setAviso(`"${c}" no es de ningún artículo. Para algo sin código usa "No registrado".`);
      return;
    }
    if (r.sub) {
      setAviso("Las variaciones todavía no se imprimen aquí: escanea el código del artículo.");
      return;
    }
    if (!RE_CODIGO_ARTICULO_ETIQUETA.test(r.padre.id)) {
      setAviso(`El código de "${r.padre.nombre}" no es de 8 dígitos: no cabe en la etiqueta.`);
      return;
    }
    agregarFila({
      codigo: r.padre.id,
      nombre: r.padre.nombre,
      precio: formatoPrecio(resolverPrecioEfectivo(r.padre).precio),
      piezas: "1",
    });
    enfocar();
  }

  function cambiar(id: number, campo: "precio" | "piezas", valor: string) {
    setFilas((prev) => prev.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }

  const renglones: RenglonEtiquetaPrecio[] = filas.map((f) => ({
    ...(f.codigo ? { codigo: f.codigo } : {}),
    precio: f.precio.trim(),
    piezas: Number(f.piezas),
    nombre: f.nombre,
  }));
  const validas =
    filas.length > 0 &&
    renglones.every(
      (r) =>
        RE_PRECIO_ETIQUETA.test(r.precio) &&
        Number.isInteger(r.piezas) &&
        r.piezas >= 1 &&
        r.piezas <= IMPRESION_TOPE_PIEZAS,
    );
  const total = renglones.reduce((s, r) => s + (Number.isInteger(r.piezas) ? r.piezas : 0), 0);
  const impresora = impresoras?.find((i) => i.id === impresoraId);

  async function imprimir() {
    if (!negocioId || !nodoId || !sucursalId || !impresora || !validas) return;
    setMandando(true);
    setError(null);
    try {
      const id = await mandarEtiquetasPrecio({
        negocioId,
        sucursalId,
        nodoId,
        impresoraId: impresora.id,
        renglones,
        quien: enTurno ?? "",
      });
      setTrabajoId(id);
      setFilas([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMandando(false);
      enfocar();
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 flex-col gap-2 border-b bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onMouseDown={sinFoco}
            onClick={() => navigate("/")}
            aria-label="Volver"
            className="-ml-1"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="shrink-0 truncate text-base font-semibold">Etiquetas de precio</h1>
          <div className="relative min-w-0 flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              aria-label="Código del artículo"
              placeholder="Escanea o escribe el código del artículo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  alEscanear(e.currentTarget.value);
                }
              }}
              inputMode={hayTecladoFisico ? "none" : "search"}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className="h-11 pl-10 text-base"
            />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {impresoras === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando la impresora…
          </p>
        ) : impresoras.length === 0 ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            Esta sucursal no tiene impresora de etiquetas. Pide a admin que le asigne una (Accesos → Impresoras).
          </p>
        ) : (
          <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-sm">
            <Printer className="h-5 w-5 text-muted-foreground" />
            {impresoras.length > 1 ? (
              <select
                aria-label="Impresora"
                value={impresoraId}
                onChange={(e) => setImpresoraId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2"
              >
                {impresoras.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <b>{impresora?.nombre}</b>
            )}
            {impresora && (
              <span
                className={
                  impresoraConectada(impresora, ahora) && !impresora.pausada
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-800 dark:text-amber-300"
                }
              >
                {!impresoraConectada(impresora, ahora)
                  ? "Sin conexión: la orden espera en la cola"
                  : impresora.pausada
                    ? "En pausa: la orden espera en la cola"
                    : "Conectada"}
              </span>
            )}
          </section>
        )}

        {aviso && (
          <p className="rounded-md bg-amber-500/10 p-2 text-sm text-amber-900 dark:text-amber-200" role="status">
            {aviso}
          </p>
        )}

        <section className="rounded-xl border bg-card">
          {filas.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Escanea los artículos. El mismo código otra vez suma una etiqueta.
            </p>
          ) : (
            <ul className="divide-y">
              {filas.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 p-2" data-fila={f.codigo ?? "no-registrado"}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.codigo ? f.nombre : "NO REGISTRADO"}</p>
                    {f.codigo && <p className="font-mono text-xs text-muted-foreground">{f.codigo}</p>}
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    $
                    <Input
                      aria-label={`Precio de ${f.codigo ?? "no registrado"}`}
                      value={f.precio}
                      onChange={(e) => cambiar(f.id, "precio", e.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
                      inputMode="decimal"
                      className={`h-10 w-24 text-right ${RE_PRECIO_ETIQUETA.test(f.precio) ? "" : "border-destructive"}`}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    ×
                    <Input
                      aria-label={`Etiquetas de ${f.codigo ?? "no registrado"}`}
                      value={f.piezas}
                      onChange={(e) => cambiar(f.id, "piezas", e.target.value.replace(/\D/g, "").slice(0, 3))}
                      inputMode="numeric"
                      className="h-10 w-16 text-center"
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onMouseDown={sinFoco}
                    onClick={() => setFilas((prev) => prev.filter((x) => x.id !== f.id))}
                    aria-label={`Quitar ${f.codigo ?? "no registrado"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button
          variant="outline"
          onMouseDown={sinFoco}
          onClick={() => agregarFila({ nombre: "NO REGISTRADO", precio: "", piezas: "1" })}
        >
          <Plus className="mr-2 h-4 w-4" /> No registrado (solo precio)
        </Button>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {trabajo && (
          <div
            data-estado-impresion={trabajo.estado}
            className={`flex flex-wrap items-center gap-2 rounded-md p-3 text-sm ${
              trabajo.estado === "impreso"
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : trabajo.estado === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted"
            }`}
          >
            {(trabajo.estado === "pendiente" || trabajo.estado === "imprimiendo") && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <span className="flex-1">{textoEstadoTrabajo(trabajo)}</span>
            {trabajo.estado === "error" && negocioId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void reimprimirEtiquetas(negocioId, trabajo.id).catch((e) =>
                    setError(e instanceof Error ? e.message : String(e)),
                  )
                }
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reimprimir
              </Button>
            )}
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          className="h-12 w-full text-base"
          onMouseDown={sinFoco}
          onClick={() => void imprimir()}
          disabled={mandando || !validas || !impresora}
        >
          {mandando ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
          {total > 0 ? `Imprimir ${total} etiqueta${total === 1 ? "" : "s"}` : "Imprimir"}
        </Button>
      </footer>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  ScanLine,
  Search,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useArticulos } from "@/features/articulos/useArticulos";
import { BarcodeScanner } from "@/features/ingreso-mercancia/BarcodeScanner";
import { useResolverCodigo } from "@/features/ingreso-mercancia/useResolverCodigo";
import { parseVariacionCodigo } from "@shared";

const PAGE = 30;

export function ArticulosListPage() {
  const navigate = useNavigate();
  const { articulos, loading } = useArticulos();
  const { resolver } = useResolverCodigo();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanError) return;
    const t = window.setTimeout(() => setScanError(null), 4000);
    return () => window.clearTimeout(t);
  }, [scanError]);

  function abrirPorCodigo(codigo: string) {
    const limpio = codigo.trim();
    if (!limpio) return;
    const r = resolver(limpio);
    if (r.ok) {
      navigate(`/articulos/${r.articulo.id}`);
      return;
    }
    // Si el código es v-NN-XXX y el padre existe pero la subvariación no,
    // igual abrir el padre para editar — el usuario está en gestión de
    // catálogo, no en ingreso de stock.
    if (limpio.startsWith("v-")) {
      const parts = parseVariacionCodigo(limpio);
      if (parts && articulos.some((a) => a.id === parts.idPadre)) {
        navigate(`/articulos/${parts.idPadre}`);
        return;
      }
    }
    setScanError(`Código no encontrado: ${limpio}`);
  }

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return articulos;
    return articulos.filter((a) => {
      const blob = [
        a.nombre,
        a.sigla,
        a.id,
        a.referencia ?? "",
        ...(a.etiquetas ?? []),
        ...(a.subvariaciones ?? []).flatMap((sv) => [
          sv.nombre,
          sv.codigo ?? "",
          sv.referencia ?? "",
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [q, articulos]);

  const visibles = filtrados.slice(0, limit);
  const hayMas = filtrados.length > limit;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex flex-col gap-2 border-b bg-card/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            aria-label="Volver al inicio"
            className="-ml-1"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 truncate text-base font-semibold">Artículos</h1>
          <span className="text-xs text-muted-foreground">
            {filtrados.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear código"
            className="-mr-1"
          >
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Buscar por nombre, sigla, ID, código…"
            className="rounded-full pl-9 pr-9"
            inputMode="search"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Limpiar"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        {scanError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{scanError}</span>
            <button
              type="button"
              onClick={() => setScanError(null)}
              aria-label="Cerrar"
              className="opacity-70 hover:opacity-100"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 px-3 pb-32 pt-3">
        {loading && articulos.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {!loading && filtrados.length === 0 && (
          <p className="rounded-md border bg-muted py-8 text-center text-sm text-muted-foreground">
            {q ? "Sin resultados" : "No hay artículos. Crea el primero."}
          </p>
        )}
        {filtrados.length > 0 && (
          <ul className="space-y-2">
            {visibles.map((a) => {
              const tieneVar = (a.subvariaciones?.length ?? 0) > 0;
              const stockTienda = Number(a.cantidad) || 0;
              const stockBodega = Number(a.cantidadBodega) || 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/articulos/${a.id}`)}
                    className={`flex w-full items-start gap-3 overflow-hidden rounded-md border bg-card p-2.5 text-left transition active:bg-accent ${
                      tieneVar ? "border-l-4 border-l-violet-500" : ""
                    }`}
                  >
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {a.imagenUrl ? (
                        <img
                          src={a.imagenUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                          loading="lazy"
                        />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground/40" />
                      )}
                      {tieneVar && (
                        <span
                          aria-hidden
                          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white shadow"
                        >
                          <Layers className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.sigla ? a.sigla + " · " : ""}#{a.id}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                          ${a.precioVenta || "—"}
                        </span>
                        {tieneVar ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 font-semibold text-violet-600 dark:text-violet-300">
                            <Layers className="h-2.5 w-2.5" />
                            {a.subvariaciones!.length} variantes
                          </span>
                        ) : (
                          <>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                              T {stockTienda}
                            </span>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">
                              B {stockBodega}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hayMas && (
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => setLimit((l) => l + PAGE)}
          >
            Ver más ({filtrados.length - limit} restantes)
          </Button>
        )}
      </main>

      <Button
        type="button"
        onClick={() => navigate("/articulos/nuevo")}
        aria-label="Nuevo artículo"
        className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+1rem))] right-4 z-30 h-14 w-14 rounded-full p-0 shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(codigo) => {
          setScannerOpen(false);
          abrirPorCodigo(codigo);
        }}
      />
    </div>
  );
}

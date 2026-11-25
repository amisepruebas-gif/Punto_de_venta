import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, ScanLine, Search, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/features/ingreso-mercancia/BarcodeScanner";
import { useExistencias } from "@/features/existencias/useExistencias";
import {
  filtrarFilas,
  opcionesDe,
  sumarExistencias,
  type FilaExistencias,
  type OpcionFiltro,
} from "@/features/existencias/filasExistencias";

/** Más filas hacen lenta la página; para lo demás está el buscador. */
const MAX_FILAS = 200;

/**
 * Existencias de la tienda (solo lectura): cada artículo final de esta
 * sucursal con sus piezas en la bodega y en la tienda.
 */
export function ExistenciasPage() {
  const navigate = useNavigate();
  const { filas, cargando } = useExistencias();
  const [texto, setTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [subcategoriaId, setSubcategoriaId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const buscadorRef = useRef<HTMLInputElement>(null);
  // Escribir no espera a que se filtren miles de filas.
  const textoDiferido = useDeferredValue(texto);

  const opcionesCategoria = useMemo(() => opcionesDe(filas, "categoria"), [filas]);
  const opcionesSubcategoria = useMemo(
    () =>
      categoriaId
        ? opcionesDe(
            filtrarFilas(filas, { texto: "", categoriaId, subcategoriaId: "" }),
            "subcategoria",
          )
        : [],
    [filas, categoriaId],
  );
  const filtradas = useMemo(
    () => filtrarFilas(filas, { texto: textoDiferido, categoriaId, subcategoriaId }),
    [filas, textoDiferido, categoriaId, subcategoriaId],
  );
  const totales = useMemo(() => sumarExistencias(filtradas), [filtradas]);
  const visibles = filtradas.slice(0, MAX_FILAS);

  // Lector USB: escribe el código y da Enter. Se deja seleccionado para que
  // el siguiente escaneo lo reemplace.
  function onBuscar(e: React.FormEvent) {
    e.preventDefault();
    buscadorRef.current?.select();
  }

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
          <h1 className="flex-1 truncate text-base font-semibold">Existencias</h1>
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
        <form onSubmit={onBuscar} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={buscadorRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="rounded-full pl-9 pr-9"
            inputMode="search"
            aria-label="Buscar"
          />
          {texto && (
            <button
              type="button"
              onClick={() => setTexto("")}
              aria-label="Limpiar"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </form>
      </header>

      <main className="flex-1 space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <SelectFiltro
            etiqueta="Categoría"
            todas="Todas las categorías"
            valor={categoriaId}
            opciones={opcionesCategoria}
            onCambio={(v) => {
              setCategoriaId(v);
              setSubcategoriaId("");
            }}
          />
          <SelectFiltro
            etiqueta="Subcategoría"
            todas="Todas las subcategorías"
            valor={subcategoriaId}
            opciones={opcionesSubcategoria}
            onCambio={setSubcategoriaId}
            disabled={!categoriaId}
          />
        </div>

        <section className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-3 text-center">
          <Total etiqueta="Artículos" valor={filtradas.length} />
          <Total etiqueta="Bodega" valor={totales.bodega} />
          <Total etiqueta="Tienda" valor={totales.tienda} />
        </section>

        {cargando && filas.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : filtradas.length === 0 ? (
          <p className="rounded-md border bg-muted py-8 text-center text-sm text-muted-foreground">
            {filas.length === 0 ? "No hay artículos en esta sucursal." : "Sin resultados"}
          </p>
        ) : (
          <ListaExistencias filas={visibles} />
        )}

        {filtradas.length > MAX_FILAS && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900">
            Se ven {MAX_FILAS} de {filtradas.length}. Busca o filtra para ver los
            demás.
          </p>
        )}
      </main>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(codigo) => {
          setScannerOpen(false);
          setTexto(codigo.trim());
        }}
      />
    </div>
  );
}

function SelectFiltro({
  etiqueta,
  todas,
  valor,
  opciones,
  onCambio,
  disabled,
}: {
  etiqueta: string;
  todas: string;
  valor: string;
  opciones: OpcionFiltro[];
  onCambio: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">{todas}</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}

function Total({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

function ListaExistencias({ filas }: { filas: FilaExistencias[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 px-2.5 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="flex-1">Artículo</span>
        <span className="w-14 text-right">Bodega</span>
        <span className="w-14 text-right">Tienda</span>
      </div>
      <ul className="space-y-1.5">
        {filas.map((f) => (
          <li
            key={f.clave}
            className="flex items-center gap-3 rounded-md border bg-card p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{f.nombre}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {f.codigo}
              </p>
            </div>
            <Cantidad valor={f.bodega} />
            <Cantidad valor={f.tienda} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cantidad({ valor }: { valor: number }) {
  return (
    <span
      className={`w-14 shrink-0 text-right text-base font-semibold tabular-nums ${
        valor === 0 ? "text-muted-foreground/60" : ""
      }`}
    >
      {valor}
    </span>
  );
}

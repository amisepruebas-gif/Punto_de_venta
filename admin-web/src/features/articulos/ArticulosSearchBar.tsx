import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useNegocio } from "@/hooks/useNegocio";
import { Input } from "@/components/ui/input";
import type { Articulo } from "@shared";
import { resolverTrios, StockTrio } from "./stockHelpers";

const MAX_SUGERENCIAS = 6;

/**
 * Entry del índice de autocomplete — mismo shape conceptual que el de
 * nodo-web/useArticulos. Cuando un artículo tiene variaciones, el padre
 * NO entra y cada variación entra como su propia fila. Cuando no tiene,
 * entra el padre.
 */
type SearchEntry = {
  kind: "articulo" | "variacion";
  idPadre: string;
  subvariacionCodigo?: string;
  subvariacionNombre?: string;
  titulo: string;
  /** texto en lowercase para `includes` */
  blob: string;
};

type Props = {
  /** Cuando `true`, el contenedor usa `position: sticky` para mantenerse
   *  visible al hacer scroll dentro del `<main>` de AppShell. Útil en la
   *  página de edición para no perder el buscador al recorrer el form. */
  sticky?: boolean;
  /** Filtro de sucursal a aplicar al trío de stock del dropdown. Cuando
   *  la search bar se monta en una página que no tiene este filtro (p. ej.
   *  el editor de artículo), el caller pasa `""` y el trío muestra el
   *  total sobre todas las sucursales. */
  filtroSucursal?: string;
  /** Texto de fondo del input. */
  placeholder?: string;
  /** Modo controlado: si se pasan, el caller maneja `q` (útil en
   *  `ArticulosPage` donde el mismo texto también filtra la lista de
   *  abajo). Si se omiten, la barra es self-contained — el editor lo usa
   *  así porque no hay lista que filtrar. */
  q?: string;
  onQChange?: (q: string) => void;
};

/**
 * Buscador con autocomplete usado tanto en la página de lista
 * (`ArticulosPage`) como en la de edición (`ArticuloEditPage`). Click en
 * una sugerencia que sea variación agrega `?sub=v-NN-XXX` al navegar; el
 * editor lo lee y expande + scrollea a esa sub.
 */
export function ArticulosSearchBar({
  sticky,
  filtroSucursal = "",
  placeholder = "Buscar por nombre, sigla, ID, referencia o etiqueta…",
  q: qProp,
  onQChange,
}: Props) {
  const navigate = useNavigate();
  const { articulos, loading } = useArticulos();
  const { sucursales } = useSucursales();
  const { negocio } = useNegocio();

  // Default fallback igual que ArticulosPage: si el negocio no define
  // `sucursalDefaultId`, la primera sucursal alfabéticamente actúa como
  // default (contrato legacy del schema).
  const defaultSucursalId = useMemo(() => {
    if (negocio?.sucursalDefaultId) return negocio.sucursalDefaultId;
    const ids = sucursales.map((s) => s.sucursalId).sort();
    return ids[0];
  }, [negocio?.sucursalDefaultId, sucursales]);

  // Soporta los dos modos: controlled (caller maneja q) y self-contained.
  const [internalQ, setInternalQ] = useState("");
  const q = qProp ?? internalQ;
  const setQ = (v: string) => {
    if (onQChange) onQChange(v);
    else setInternalQ(v);
  };
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Índice de búsqueda — artículos sin variaciones entran como `articulo`,
  // con variaciones entran SOLO las variaciones (el padre se omite).
  const searchIndex = useMemo<SearchEntry[]>(() => {
    const out: SearchEntry[] = [];
    for (const a of articulos) {
      const subs = a.subvariaciones ?? [];
      const blobBase = `${a.nombre ?? ""} ${a.sigla ?? ""} ${a.id ?? ""} ${
        a.referencia ?? ""
      } ${(a.etiquetas ?? []).join(" ")}`.toLowerCase();
      if (subs.length > 0) {
        for (const sv of subs) {
          out.push({
            kind: "variacion",
            idPadre: a.id,
            subvariacionCodigo: sv.codigo,
            subvariacionNombre: sv.nombre,
            titulo: `${a.nombre} — ${sv.nombre}`,
            blob: `${blobBase} ${sv.nombre ?? ""} ${
              sv.codigo ?? ""
            } ${sv.referencia ?? ""}`.toLowerCase(),
          });
        }
      } else {
        out.push({
          kind: "articulo",
          idPadre: a.id,
          titulo: a.nombre,
          blob: blobBase,
        });
      }
    }
    return out;
  }, [articulos]);

  const byId = useMemo(() => {
    const m = new Map<string, Articulo>();
    for (const a of articulos) m.set(a.id, a);
    return m;
  }, [articulos]);

  const sugerencias = useMemo<SearchEntry[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return searchIndex
      .filter((e) => e.blob.includes(s))
      .slice(0, MAX_SUGERENCIAS);
  }, [q, searchIndex]);

  useEffect(() => {
    setHighlight(0);
  }, [q]);

  // Click fuera del wrapper cierra el dropdown.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setAutocompleteOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  function elegirSugerencia(idx: number) {
    const entry = sugerencias[idx];
    if (!entry) return;
    setAutocompleteOpen(false);
    setQ("");
    // Si el match es una subvariación específica, propagamos el código por
    // query (`?sub=v-NN-XXX`). ArticuloEditPage lo lee y le pide al
    // SubvariacionesEditor que expanda + scrollee a esa sub. Match al
    // padre (por nombre/sigla/id) no agrega el query.
    const sub = entry.subvariacionCodigo
      ? `?sub=${encodeURIComponent(entry.subvariacionCodigo)}`
      : "";
    navigate(`/articulos/${entry.idPadre}${sub}`);
  }

  // Contenedor sticky: el `<main>` de AppShell es el scroll-host. Con
  // `top-0` el buscador queda flush contra la parte superior del área de
  // contenido. En móvil hay un header propio del AppShell (md:hidden)
  // arriba — ese header no es parte del scroll, así que el sticky queda
  // debajo de él automáticamente. Padding + borde inferior dan separación
  // visual cuando se pega.
  const wrapperClass = sticky
    ? "sticky top-0 z-30 -mx-3 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6"
    : "";

  return (
    <div className={wrapperClass}>
      <div ref={wrapRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAutocompleteOpen(true);
          }}
          onFocus={() => setAutocompleteOpen(true)}
          onKeyDown={(e) => {
            if (!sugerencias.length) {
              if (e.key === "Escape") setAutocompleteOpen(false);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(sugerencias.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              elegirSugerencia(highlight);
            } else if (e.key === "Escape") {
              setAutocompleteOpen(false);
            }
          }}
          placeholder={placeholder}
          className="pl-9 pr-10"
          inputMode="search"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setAutocompleteOpen(false);
            }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {autocompleteOpen && q.trim() && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border bg-card shadow-lg">
            {sugerencias.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {loading ? "Cargando…" : "Sin resultados"}
              </p>
            ) : (
              <ul role="listbox">
                {sugerencias.map((entry, idx) => {
                  const padre = byId.get(entry.idPadre);
                  const sv =
                    entry.subvariacionCodigo && padre
                      ? padre.subvariaciones?.find(
                          (s) => s.codigo === entry.subvariacionCodigo,
                        )
                      : undefined;
                  const item = sv ?? padre;
                  const trio = item
                    ? resolverTrios(item, filtroSucursal, defaultSucursalId)
                    : { suc: 0, bod: 0, tot: 0 };
                  const imagen = sv?.imagenUrl ?? padre?.imagenUrl;
                  return (
                    <li
                      key={`${entry.idPadre}__${entry.subvariacionCodigo ?? ""}`}
                      role="option"
                      aria-selected={idx === highlight}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        elegirSugerencia(idx);
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                        idx === highlight ? "bg-accent" : ""
                      }`}
                    >
                      {imagen ? (
                        <img
                          src={imagen}
                          alt=""
                          className="h-9 w-9 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                          {padre?.sigla || "—"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{entry.titulo}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.kind === "variacion"
                            ? entry.subvariacionCodigo
                            : `${padre?.sigla ? padre.sigla + " · " : ""}#${entry.idPadre}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          ${padre?.precioVenta ?? "—"}
                        </p>
                        <StockTrio trio={trio} compact />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

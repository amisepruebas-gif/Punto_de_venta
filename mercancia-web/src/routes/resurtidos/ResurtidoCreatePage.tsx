import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useArticulos } from "@/features/articulos/useArticulos";
import { useSucursales } from "@/features/sucursales/useSucursales";
import { useNegocio } from "@/hooks/useNegocio";
import { useSession } from "@/hooks/useSession";
import { crearResurtido } from "@/features/resurtidos/resurtidoService";
import type { Articulo, ResurtidoLinea } from "@shared";

type Item = Omit<ResurtidoLinea, "disposicion">;

export function ResurtidoCreatePage() {
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { auth } = useSession();
  const { articulos, loading: loadingArt } = useArticulos();
  const { sucursales, loading: loadingSuc } = useSucursales();

  const [destinoId, setDestinoId] = useState("");
  const [responsable, setResponsable] = useState(auth?.nombre ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPiezas = useMemo(
    () => items.reduce((acc, l) => acc + l.cantidadEnviada, 0),
    [items],
  );

  function addLinea(art: Articulo, sub?: { codigo: string; nombre: string }) {
    const nombre = sub
      ? `${art.nombre} — ${sub.nombre}`
      : art.nombre;
    const dupKey = (l: Item) =>
      l.articuloId === art.id && l.subvariacionCodigo === sub?.codigo;
    setItems((prev) => {
      const idx = prev.findIndex(dupKey);
      if (idx >= 0) {
        return prev.map((l, i) =>
          i === idx ? { ...l, cantidadEnviada: l.cantidadEnviada + 1 } : l,
        );
      }
      const nueva: Item = {
        articuloId: art.id,
        ...(sub ? { subvariacionCodigo: sub.codigo } : {}),
        nombreSnapshot: nombre,
        ...(art.sigla ? { siglaSnapshot: art.sigla } : {}),
        cantidadEnviada: 1,
      };
      return [...prev, nueva];
    });
  }

  function setCantidad(idx: number, n: number) {
    setItems((prev) => {
      if (n <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((l, i) =>
        i === idx ? { ...l, cantidadEnviada: n } : l,
      );
    });
  }

  function quitar(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    setError(null);
    if (!destinoId) {
      setError("Selecciona la sucursal destino");
      return;
    }
    const dest = sucursales.find((s) => s.sucursalId === destinoId);
    if (!dest) {
      setError("Sucursal destino inválida");
      return;
    }
    if (!responsable.trim()) {
      setError("Falta el responsable que empacó");
      return;
    }
    if (items.length === 0) {
      setError("Agrega al menos un artículo");
      return;
    }
    setSubmitting(true);
    try {
      const r = await crearResurtido(negocioId, {
        sucursalDestinoId: dest.sucursalId,
        sucursalDestinoNombre: dest.nombre,
        responsableEmpaco: responsable,
        lineas: items,
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });
      navigate(`/resurtidos/${r.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/resurtidos")}
          aria-label="Volver"
          className="-ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-base font-semibold">Nuevo resurtido</h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-1 flex-col gap-4 px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-3"
      >
        <section className="space-y-2 rounded-lg border bg-card p-3">
          <Label htmlFor="destino">Sucursal destino *</Label>
          <select
            id="destino"
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            disabled={loadingSuc}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Selecciona —</option>
            {sucursales.map((s) => (
              <option key={s.sucursalId} value={s.sucursalId}>
                {s.nombre}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-3">
          <Label htmlFor="responsable">Responsable que empacó *</Label>
          <Input
            id="responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            placeholder="Nombre del empacador"
            required
          />
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between">
            <Label>Artículos</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" /> Agregar
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="rounded-md border-dashed bg-muted/30 py-4 text-center text-xs text-muted-foreground">
              Sin artículos. Toca "Agregar".
            </p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((l, idx) => (
                <li
                  key={`${l.articuloId}_${l.subvariacionCodigo ?? ""}`}
                  className="flex items-center gap-2 rounded-md border bg-background p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {l.nombreSnapshot}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {l.subvariacionCodigo ?? l.articuloId}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCantidad(idx, l.cantidadEnviada - 1)}
                      aria-label="Restar"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={l.cantidadEnviada}
                      onChange={(e) =>
                        setCantidad(idx, Number(e.target.value) || 0)
                      }
                      className="h-8 w-12 text-center text-sm"
                      min={1}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCantidad(idx, l.cantidadEnviada + 1)}
                      aria-label="Sumar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => quitar(idx)}
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              {items.length} línea(s) · {totalPiezas} pieza(s)
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-3">
          <Label htmlFor="notas">Notas (opcional)</Label>
          <textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Cualquier observación sobre el resurtido"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card/95 p-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.25rem))] backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/resurtidos")}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting || items.length === 0}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            Crear resurtido
          </Button>
        </div>
      </form>

      {pickerOpen && (
        <ArticuloPicker
          articulos={articulos}
          loading={loadingArt}
          onClose={() => setPickerOpen(false)}
          onPick={(art, sub) => {
            addLinea(art, sub);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ArticuloPicker({
  articulos,
  loading,
  onClose,
  onPick,
}: {
  articulos: Articulo[];
  loading: boolean;
  onClose: () => void;
  onPick: (a: Articulo, sub?: { codigo: string; nombre: string }) => void;
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return articulos.slice(0, 50);
    return articulos
      .filter((a) =>
        [
          a.nombre,
          a.sigla,
          a.id,
          ...(a.subvariaciones ?? []).flatMap((sv) => [
            sv.nombre,
            sv.codigo ?? "",
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(s),
      )
      .slice(0, 50);
  }, [q, articulos]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-background"
      role="dialog"
      aria-modal
      aria-label="Elegir artículo"
    >
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar"
          className="-ml-1"
        >
          <XIcon className="h-5 w-5" />
        </Button>
        <h2 className="flex-1 text-base font-semibold">Elegir artículo</h2>
      </header>
      <div className="border-b bg-card px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, sigla, ID, código…"
            inputMode="search"
            className="rounded-full pl-9"
            autoFocus
          />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {loading && articulos.length === 0 && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        )}
        {filtrados.length === 0 && !loading && (
          <p className="rounded-md border bg-muted py-6 text-center text-sm text-muted-foreground">
            Sin resultados
          </p>
        )}
        <ul className="space-y-1">
          {filtrados.map((a) => {
            const subs = a.subvariaciones ?? [];
            if (subs.length === 0) {
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onPick(a)}
                    className="flex w-full items-center gap-2 rounded-md border bg-card p-2 text-left transition active:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nombre}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {a.sigla ? `${a.sigla} · ` : ""}#{a.id}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      Bod: {a.cantidadBodega ?? "0"}
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key={a.id} className="rounded-md border bg-card">
                <p className="border-b px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {a.nombre}
                </p>
                <ul>
                  {subs.map((sv) => (
                    <li key={sv.codigo ?? sv.nombre}>
                      <button
                        type="button"
                        onClick={() =>
                          sv.codigo
                            ? onPick(a, { codigo: sv.codigo, nombre: sv.nombre })
                            : null
                        }
                        disabled={!sv.codigo}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition active:bg-accent disabled:opacity-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{sv.nombre}</p>
                          {sv.codigo && (
                            <p className="truncate font-mono text-[10px] text-muted-foreground">
                              {sv.codigo}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          Bod: {sv.cantidadBodega ?? "0"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

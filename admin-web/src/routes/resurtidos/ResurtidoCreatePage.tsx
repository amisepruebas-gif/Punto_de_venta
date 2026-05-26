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
import { useAuth } from "@/hooks/useAuth";
import { crearResurtido } from "@/features/resurtidos/resurtidoService";
import type { Articulo, ResurtidoLinea } from "@shared";

type Item = Omit<ResurtidoLinea, "disposicion">;

export function ResurtidoCreatePage() {
  const navigate = useNavigate();
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { articulos, loading: loadingArt } = useArticulos();
  const { sucursales, loading: loadingSuc } = useSucursales();

  const [destinoId, setDestinoId] = useState("");
  const [responsable, setResponsable] = useState(
    user?.user.email ?? user?.user.uid ?? "",
  );
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
    const nombre = sub ? `${art.nombre} — ${sub.nombre}` : art.nombre;
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
      return prev.map((l, i) => (i === idx ? { ...l, cantidadEnviada: n } : l));
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
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate("/resurtidos")}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Resurtidos
        </Button>
        <h1 className="text-xl font-semibold">Nuevo resurtido</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="text-base font-semibold">Destino y responsable</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="destino">Sucursal destino *</Label>
              <select
                id="destino"
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                disabled={loadingSuc}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="">— Selecciona —</option>
                {sucursales.map((s) => (
                  <option key={s.sucursalId} value={s.sucursalId}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="responsable">Responsable que empacó *</Label>
              <Input
                id="responsable"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Artículos</h2>
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
            <p className="rounded-md border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
              Sin artículos. Toca "Agregar".
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Artículo</th>
                    <th className="p-2">Código</th>
                    <th className="p-2 text-center">Cantidad</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l, idx) => (
                    <tr
                      key={`${l.articuloId}_${l.subvariacionCodigo ?? ""}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="p-2 font-medium">{l.nombreSnapshot}</td>
                      <td className="p-2 font-mono text-xs text-muted-foreground">
                        {l.subvariacionCodigo ?? l.articuloId}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setCantidad(idx, l.cantidadEnviada - 1)
                            }
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
                            className="h-8 w-16 text-center text-sm"
                            min={1}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setCantidad(idx, l.cantidadEnviada + 1)
                            }
                            aria-label="Sumar"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {items.length > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              {items.length} línea(s) · {totalPiezas} pieza(s)
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-4 sm:p-5">
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

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/resurtidos")}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || items.length === 0}>
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
    if (!s) return articulos.slice(0, 100);
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
      .slice(0, 100);
  }, [q, articulos]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-lg"
      >
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <h2 className="flex-1 text-base font-semibold">Elegir artículo</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </header>
        <div className="border-b px-4 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, sigla, ID, código…"
              className="rounded-full pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
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
                      className="flex w-full items-center gap-2 rounded-md border bg-background p-2 text-left transition hover:border-primary"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {a.nombre}
                        </p>
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
                <li key={a.id} className="rounded-md border bg-background">
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
                              ? onPick(a, {
                                  codigo: sv.codigo,
                                  nombre: sv.nombre,
                                })
                              : null
                          }
                          disabled={!sv.codigo}
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-accent disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}

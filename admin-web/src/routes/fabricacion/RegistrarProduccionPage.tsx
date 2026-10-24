import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useNegocio } from "@/hooks/useNegocio";
import { useAuth } from "@/hooks/useAuth";
import { useArticulos } from "@/features/articulos/useArticulos";
import { ImageUpload } from "@/features/articulos/ImageUpload";
import { crearArticulo } from "@/features/articulos/articuloService";
import { CategoriaInlineSelect } from "@/features/categorias/CategoriaInlineSelect";
import { ZonaPrecioSelect } from "@/features/zonas-precio/ZonaPrecioSelect";
import { useZonasPrecio } from "@/features/zonas-precio/useZonasPrecio";
import { EtiquetasInput } from "@/features/fabricacion/EtiquetasInput";
import { registrarProduccion } from "@/features/fabricacion/produccionService";
import { TALLER_ID, useUbicaciones } from "@/features/fabricacion/useFabricacion";
import type { PrefillResurtido } from "@/features/resurtidos/prefill";
import { ymdPaddedMX, type LoteProduccion } from "@shared";

type Modo = "nuevo" | "existente";

/**
 * Registrar producción: dar de alta un artículo fabricado (con su primer
 * lote) o agregar producción a uno existente ("resurtir"). Cada registro
 * queda como lote con folio único FAB-NNNNNN.
 */
export function RegistrarProduccionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const articuloInicial = searchParams.get("articuloId") ?? "";
  const { negocioId } = useNegocio();
  const { user } = useAuth();
  const { articulos } = useArticulos();
  const { zonas } = useZonasPrecio();
  const { sucursales, resolver, nombre: nombreUbicacion } = useUbicaciones();
  const usuario = user?.user.email ?? user?.user.uid ?? "?";

  const [modo, setModo] = useState<Modo>(articuloInicial ? "existente" : "nuevo");
  const [articuloId, setArticuloId] = useState(articuloInicial);
  const [busqueda, setBusqueda] = useState("");
  // Artículo nuevo
  const [nombre, setNombre] = useState("");
  const [sigla, setSigla] = useState("");
  const [categoria, setCategoria] = useState({ categoriaId: "", subcategoriaId: "" });
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [zonaPrecioId, setZonaPrecioId] = useState("");
  const [costo, setCosto] = useState("");
  const [soloMayoreo, setSoloMayoreo] = useState(true);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenViaNanobanana, setImagenViaNanobanana] = useState(false);
  // Lote
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(ymdPaddedMX());
  const [destinoId, setDestinoId] = useState(TALLER_ID);
  const [notas, setNotas] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<LoteProduccion | null>(null);

  const fabricados = useMemo(
    () =>
      articulos
        .filter((a) => a.fabricado)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [articulos],
  );
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return fabricados;
    return fabricados.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        a.id.includes(q) ||
        a.sigla?.toLowerCase().includes(q),
    );
  }, [fabricados, busqueda]);
  const existente = fabricados.find((a) => a.id === articuloId) ?? null;
  const zona = zonas.find((z) => z.zonaId === zonaPrecioId) ?? null;

  function validar(): string | null {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n <= 0) return "Indica cuántas piezas se produjeron";
    if (!fecha) return "Indica la fecha de producción";
    if (modo === "existente") return existente ? null : "Elige el artículo";
    if (!nombre.trim()) return "Escribe el nombre del artículo (ej. Llavero Goku M1)";
    if (!categoria.categoriaId) return "Elige o crea la categoría";
    if (!zona) return "Elige o crea la zona de precios";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    const destino = resolver(destinoId);
    if (!destino) {
      setError("Aún se están cargando las sucursales; intenta de nuevo");
      return;
    }
    setGuardando(true);
    setError(null);

    let idArticulo = existente?.id ?? "";
    if (modo === "nuevo" && zona) {
      try {
        const precio = zona.precioVenta;
        const compra = Number(costo) || 0;
        const nuevo = await crearArticulo(negocioId, {
          nombre: nombre.trim(),
          sigla: sigla.trim(),
          referencia: "",
          // El stock entra con el lote (abajo), no con el alta.
          cantidad: "0",
          cantidadBodega: "0",
          preciCompra: String(compra),
          precioVenta: String(precio),
          utilidad: String(precio - compra),
          utilidadTotal: "0",
          categoriaId: categoria.categoriaId,
          ...(categoria.subcategoriaId
            ? { subcategoriaId: categoria.subcategoriaId }
            : {}),
          ...(etiquetas.length > 0 ? { etiquetas } : {}),
          zonaPrecioId: zona.zonaId,
          escalonesMayoreo: zona.escalones,
          soloMayoreo,
          fabricado: true,
          imagenFile,
          imagenViaNanobanana,
          usuario: user
            ? {
                uid: user.user.uid,
                ...(user.user.email ? { email: user.user.email } : {}),
              }
            : null,
        });
        idArticulo = nuevo.id;
      } catch (e) {
        setError((e as Error).message);
        setGuardando(false);
        return;
      }
    }

    try {
      const lote = await registrarProduccion(negocioId, {
        articuloId: idArticulo,
        cantidad: Number(cantidad),
        destino,
        destinoNombre: nombreUbicacion(destinoId),
        fechaProduccion: fecha,
        esAlta: modo === "nuevo",
        usuario,
        notas,
      });
      setResultado(lote);
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        modo === "nuevo"
          ? `El artículo se creó (#${idArticulo}) pero no se registró la producción: ${msg}. Reinténtalo con "Artículo existente".`
          : msg,
      );
      if (modo === "nuevo") {
        setModo("existente");
        setArticuloId(idArticulo);
      }
    } finally {
      setGuardando(false);
    }
  }

  function otro() {
    setResultado(null);
    setNombre("");
    setSigla("");
    setEtiquetas([]);
    setImagenFile(null);
    setCantidad("");
    setNotas("");
  }

  if (resultado) {
    const prefill: PrefillResurtido = {
      lineas: [
        {
          articuloId: resultado.articuloId,
          nombreSnapshot: resultado.nombreSnapshot,
          cantidadEnviada: resultado.cantidad,
        },
      ],
      notas: `Lote ${resultado.folio}`,
    };
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-lg border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <div>
          <p className="text-lg font-semibold">Lote {resultado.folio} registrado</p>
          <p className="text-sm text-muted-foreground">
            {resultado.cantidad} pz de {resultado.nombreSnapshot} →{" "}
            {resultado.destinoNombre} · {resultado.fechaProduccion}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link
              to={`/fabricacion/etiquetas?articuloId=${resultado.articuloId}&cantidad=${resultado.cantidad}`}
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimir etiquetas
            </Link>
          </Button>
          {resultado.destino.tipo === "bodega" && (
            <Button
              variant="outline"
              onClick={() =>
                navigate("/resurtidos/nuevo", { state: { prefillResurtido: prefill } })
              }
            >
              <Send className="mr-2 h-4 w-4" /> Enviar a sucursal
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/fabricacion/articulos/${resultado.articuloId}`}>Ver artículo</Link>
          </Button>
          <Button onClick={otro}>Registrar otro</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-1" role="radiogroup">
        {(
          [
            ["nuevo", "Artículo nuevo"],
            ["existente", "Agregar producción a uno existente"],
          ] as const
        ).map(([m, texto]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            onClick={() => setModo(m)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === "existente" ? (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Artículo</h2>
          {fabricados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay artículos fabricados: da de alta el primero con "Artículo nuevo".
            </p>
          ) : (
            <>
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código"
              />
              <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
                {filtrados.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                      articuloId === a.id ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="articulo"
                      checked={articuloId === a.id}
                      onChange={() => setArticuloId(a.id)}
                    />
                    {a.imagenUrl ? (
                      <img src={a.imagenUrl} alt="" className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.nombre}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        #{a.id} · taller {Number(a.cantidadBodega) || 0} pz
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Artículo nuevo</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fab-nombre">Nombre y modelo *</Label>
              <Input
                id="fab-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Llavero Goku M1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fab-sigla">Sigla (opcional)</Label>
              <Input
                id="fab-sigla"
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
          </div>
          <CategoriaInlineSelect
            categoriaId={categoria.categoriaId}
            subcategoriaId={categoria.subcategoriaId}
            onChange={setCategoria}
            categoriaRequerida
          />
          <ZonaPrecioSelect
            value={zonaPrecioId}
            onChange={(z) => setZonaPrecioId(z?.zonaId ?? "")}
            categoriaId={categoria.categoriaId || undefined}
            requerida
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fab-costo">Costo por pieza (opcional)</Label>
              <Input
                id="fab-costo"
                type="number"
                inputMode="decimal"
                min="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder="Para calcular la utilidad"
              />
            </div>
            <label className="flex items-start gap-2 pt-6">
              <Checkbox
                className="mt-0.5"
                checked={soloMayoreo}
                onChange={(e) => setSoloMayoreo(e.target.checked)}
              />
              <span className="text-sm">
                Solo mayoreo
                <span className="block text-[11px] text-muted-foreground">
                  Solo lo ven y venden las sucursales de mayoreo.
                </span>
              </span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Etiquetas (opcional)</Label>
            <EtiquetasInput etiquetas={etiquetas} onChange={setEtiquetas} />
          </div>
          <ImageUpload
            onFile={(f, meta) => {
              setImagenFile(f);
              setImagenViaNanobanana(!!meta?.viaNanobanana);
            }}
            onRemove={() => {
              setImagenFile(null);
              setImagenViaNanobanana(false);
            }}
            label="Foto"
          />
        </section>
      )}

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">Producción</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fab-cantidad">Piezas *</Label>
            <Input
              id="fab-cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fab-fecha">Fecha de producción</Label>
            <Input
              id="fab-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fab-destino">¿Dónde quedan?</Label>
            <select
              id="fab-destino"
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value={TALLER_ID}>Taller (se envían después)</option>
              {sucursales.map((s) => (
                <option key={s.sucursalId} value={s.sucursalId}>
                  Directo a {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fab-notas">Notas (opcional)</Label>
          <Textarea
            id="fab-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
          />
        </div>
      </section>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate("/fabricacion")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Registrar producción"}
        </Button>
      </div>
    </form>
  );
}

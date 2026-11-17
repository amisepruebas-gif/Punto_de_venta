import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Loader2, ScanLine, Search } from "lucide-react";
import type { Articulo, ArticuloSubvariacion, LoteContenido, Sucursal } from "@shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mensajeDeError, type SesionEnlace } from "@/firebase/enlaceApp";
import { EscanerCodigo, type MensajeEscaner } from "./EscanerCodigo";
import {
  articulosFabricados,
  avisoDestino,
  buscarEnFabricados,
  leerArticuloPorCodigo,
  tieneVariaciones,
} from "./catalogoService";
import { Aviso, AvisoError, BotonGrande, CampoPiezas, Cargando } from "./ui";

export type BotonCaptura = {
  id: string;
  texto: string;
  variante?: "default" | "outline";
};

type Paso =
  | { paso: "articulo" }
  | { paso: "variacion"; articulo: Articulo }
  | { paso: "piezas"; articulo: Articulo; variacion?: ArticuloSubvariacion };

/** Parece un código de artículo (no un nombre): sin espacios y con número. */
function pareceCodigo(t: string): boolean {
  return /^v-\S+$/i.test(t) || /^\d{4,}$/.test(t);
}

/**
 * Elegir un artículo (escaneando su etiqueta o buscándolo entre los de
 * fabricación), su variación si tiene, y las piezas. Al terminar llama
 * `onListo` con el renglón y el botón que se tocó.
 */
export function CapturaRenglon({
  sesion,
  destino,
  botones,
  onListo,
  onCancelar,
  textoCancelar = "Cancelar",
  ocupado = false,
}: {
  sesion: SesionEnlace;
  destino?: Sucursal;
  botones: BotonCaptura[];
  onListo: (r: LoteContenido, boton: string) => void;
  onCancelar: () => void;
  textoCancelar?: string;
  /** Guardando: los botones no responden (evita guardar dos veces). */
  ocupado?: boolean;
}) {
  const [paso, setPaso] = useState<Paso>({ paso: "articulo" });
  const [consulta, setConsulta] = useState("");
  const [fabricados, setFabricados] = useState<Articulo[] | null>(null);
  const [errorLista, setErrorLista] = useState<unknown>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [escaner, setEscaner] = useState(false);
  const [mensajeEscaner, setMensajeEscaner] = useState<MensajeEscaner | null>(null);
  const [piezas, setPiezas] = useState("");

  function cargarLista() {
    setErrorLista(null);
    articulosFabricados(sesion)
      .then(setFabricados)
      .catch((e) => setErrorLista(e));
  }
  useEffect(cargarLista, [sesion]);

  const resultados = useMemo(
    () => (fabricados ? buscarEnFabricados(fabricados, consulta).slice(0, 40) : []),
    [fabricados, consulta],
  );

  function elegir(articulo: Articulo, variacion?: ArticuloSubvariacion) {
    setErrorCodigo(null);
    if (!variacion && tieneVariaciones(articulo)) {
      setPaso({ paso: "variacion", articulo });
      return;
    }
    setPiezas("");
    setPaso({ paso: "piezas", articulo, variacion });
  }

  /** Un código escaneado o tecleado. Devuelve el problema, si hay. */
  async function usarCodigo(codigo: string): Promise<string | null> {
    setBuscando(true);
    try {
      const r = await leerArticuloPorCodigo(sesion, codigo);
      if (!r) return `No hay ningún artículo con el código "${codigo}".`;
      elegir(r.articulo, r.variacion);
      return null;
    } catch (e) {
      return mensajeDeError(e);
    } finally {
      setBuscando(false);
    }
  }

  async function enviarBusqueda(e: FormEvent) {
    e.preventDefault();
    const t = consulta.trim();
    if (!t) return;
    // Lo tecleado como código se busca directo (puede no ser de fabricación).
    if (pareceCodigo(t) && !resultados.some((a) => a.id === t)) {
      setErrorCodigo(await usarCodigo(t));
      return;
    }
    if (resultados.length === 1) elegir(resultados[0]!);
  }

  async function codigoEscaneado(codigo: string) {
    setMensajeEscaner(null);
    const problema = await usarCodigo(codigo);
    if (problema) setMensajeEscaner({ tono: "mal", texto: problema });
    else setEscaner(false);
  }

  // ---------- Paso: piezas ----------
  if (paso.paso === "piezas") {
    const nombre = paso.variacion
      ? `${paso.articulo.nombre} — ${paso.variacion.nombre}`
      : paso.articulo.nombre;
    const aviso = avisoDestino(paso.articulo, destino);
    const n = Number(piezas);
    const valido = Number.isInteger(n) && n >= 1;
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-card p-3">
          <p className="text-sm text-muted-foreground">Artículo</p>
          <p className="text-lg font-semibold leading-tight">{nombre}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {paso.variacion?.codigo ?? paso.articulo.id}
            {paso.articulo.sigla ? ` · ${paso.articulo.sigla}` : ""}
          </p>
        </div>
        {aviso && <Aviso tono="ojo">{aviso}</Aviso>}
        <div className="space-y-2">
          <p className="text-base font-medium">¿Cuántas piezas?</p>
          <CampoPiezas valor={piezas} onCambio={setPiezas} autoFocus />
        </div>
        <div className="space-y-2">
          {botones.map((b, i) => (
            <BotonGrande
              key={b.id}
              variant={b.variante ?? (i === 0 ? "default" : "outline")}
              disabled={!valido || ocupado}
              onClick={() =>
                onListo(
                  {
                    articuloId: paso.articulo.id,
                    ...(paso.variacion?.codigo ? { subvariacionCodigo: paso.variacion.codigo } : {}),
                    piezas: n,
                  },
                  b.id,
                )
              }
            >
              {b.texto}
            </BotonGrande>
          ))}
          <Button
            variant="ghost"
            className="h-12 w-full text-base"
            onClick={() => setPaso({ paso: "articulo" })}
          >
            Elegir otro artículo
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Paso: variación ----------
  if (paso.paso === "variacion") {
    const variaciones = (paso.articulo.subvariaciones ?? []).filter((v) => !!v.codigo);
    return (
      <div className="space-y-3">
        <div>
          <p className="text-lg font-semibold leading-tight">{paso.articulo.nombre}</p>
          <p className="text-base text-muted-foreground">¿Cuál variación?</p>
        </div>
        <ul className="space-y-2">
          {variaciones.map((v) => (
            <li key={v.codigo}>
              <button
                type="button"
                onClick={() => elegir(paso.articulo, v)}
                className="flex min-h-14 w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-lg active:bg-accent"
              >
                <span className="flex-1">{v.nombre}</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          className="h-12 w-full text-base"
          onClick={() => setPaso({ paso: "articulo" })}
        >
          Elegir otro artículo
        </Button>
      </div>
    );
  }

  // ---------- Paso: artículo ----------
  return (
    <div className="space-y-3">
      <p className="text-base font-medium">¿Qué artículo?</p>
      <BotonGrande
        onClick={() => {
          setMensajeEscaner(null);
          setEscaner(true);
        }}
      >
        <ScanLine className="mr-2 h-6 w-6" /> Escanear artículo
      </BotonGrande>

      <form onSubmit={enviarBusqueda} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setErrorCodigo(null);
            }}
            aria-label="Buscar artículo por nombre, sigla o código"
            placeholder="Nombre, sigla o código"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-12 pl-10 text-base"
          />
        </div>
        <Button type="submit" variant="outline" className="h-12 px-4 text-base" disabled={buscando || !consulta.trim()}>
          {buscando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Buscar"}
        </Button>
      </form>
      {errorCodigo && <Aviso tono="mal">{errorCodigo}</Aviso>}

      {errorLista ? (
        <AvisoError error={errorLista} onReintentar={cargarLista} />
      ) : !fabricados ? (
        <Cargando texto="Cargando artículos…" />
      ) : resultados.length === 0 ? (
        <p className="py-4 text-center text-base text-muted-foreground">
          {consulta.trim()
            ? "No se encontró entre los de fabricación. Si tienes su código, escríbelo y toca Buscar."
            : "No hay artículos de fabricación. Escanea la etiqueta del artículo."}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Artículos">
          {resultados.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => elegir(a)}
                className="flex min-h-14 w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left active:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium leading-tight">{a.nombre}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {a.sigla ? `${a.sigla} · ` : ""}
                    {a.id}
                    {tieneVariaciones(a) ? " · con variaciones" : ""}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" className="h-12 w-full text-base" onClick={onCancelar}>
        {textoCancelar}
      </Button>

      <EscanerCodigo
        open={escaner}
        titulo="Escanear artículo"
        ayuda="Apunta a la etiqueta del artículo"
        etiquetaCampo="Código del artículo"
        teclado="text"
        mensaje={mensajeEscaner}
        ocupado={buscando}
        onCodigo={codigoEscaneado}
        onClose={() => setEscaner(false)}
      />
    </div>
  );
}

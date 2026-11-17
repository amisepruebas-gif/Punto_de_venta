// Formularios de "Armar lote": lo que trae un paquete y las piezas sueltas.
// Lo capturado vive aquí hasta que se guarda: si no hay internet, el error
// se muestra y nada se pierde (se puede reintentar).

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { LoteContenido, Sucursal } from "@shared";
import { Button } from "@/components/ui/button";
import type { SesionEnlace } from "@/firebase/enlaceApp";
import { CapturaRenglon } from "@/features/enlace/CapturaRenglon";
import { articuloEnMemoria, avisoDestino } from "@/features/enlace/catalogoService";
import {
  Aviso,
  AvisoError,
  BotonGrande,
  CampoPiezas,
  Cargando,
  ConfirmarEnLinea,
  Pantalla,
} from "@/features/enlace/ui";
import { legible } from "@/features/enlace/lotesService";

type Nombre = (articuloId: string, subvariacionCodigo?: string) => string;

/** "12 × Llavero Goku, 4 × Playera — CH" */
export function describirContenido(contenido: readonly LoteContenido[], nombre: Nombre): string {
  return contenido
    .map((r) => `${r.piezas} × ${nombre(r.articuloId, r.subvariacionCodigo)}`)
    .join(", ");
}

/**
 * Lo que trae un paquete (uno o varios artículos). Nuevo: se llega aquí ya
 * con la etiqueta escaneada y se empieza eligiendo el artículo. Editar:
 * se ven los renglones y se pueden cambiar piezas, agregar o quitar.
 */
export function PaqueteForm({
  sesion,
  destino,
  codigo,
  cajaTitulo,
  inicial,
  editando,
  nombre,
  onGuardar,
  onQuitar,
  onCancelar,
}: {
  sesion: SesionEnlace;
  destino?: Sucursal;
  codigo: string;
  cajaTitulo: string;
  inicial: LoteContenido[];
  /** Es un paquete ya guardado (se puede quitar). */
  editando: boolean;
  nombre: Nombre;
  onGuardar: (contenido: LoteContenido[]) => Promise<void>;
  onQuitar?: () => Promise<void>;
  onCancelar: () => void;
}) {
  // Piezas como texto mientras se teclean (puede quedar vacío un momento).
  const [renglones, setRenglones] = useState<Array<LoteContenido & { texto: string }>>(() =>
    inicial.map((r) => ({ ...r, texto: String(r.piezas) })),
  );
  const [capturando, setCapturando] = useState(inicial.length === 0);
  const [vuelta, setVuelta] = useState(0); // para reiniciar la captura
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const contenidoActual = (lista = renglones): LoteContenido[] =>
    lista.map(({ texto, ...r }) => ({ ...r, piezas: Number(texto) }));

  async function guardar(lista = renglones) {
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(contenidoActual(lista));
    } catch (e) {
      setError(e);
      // Lo capturado se queda a la vista para reintentar.
      setCapturando(false);
      setGuardando(false);
    }
  }

  async function quitar() {
    if (!onQuitar) return;
    setGuardando(true);
    setError(null);
    try {
      await onQuitar();
    } catch (e) {
      setError(e);
      setGuardando(false);
      setConfirmarQuitar(false);
    }
  }

  function agregar(r: LoteContenido, boton: string) {
    const nueva = [...renglones, { ...r, texto: String(r.piezas) }];
    setRenglones(nueva);
    if (boton === "guardar") {
      // La captura se queda a la vista (con los botones apagados) mientras
      // se guarda; si falla, se pasa a la lista con el error.
      void guardar(nueva);
    } else if (boton === "otro") {
      setVuelta((v) => v + 1); // captura nueva para el siguiente artículo
      setCapturando(true);
    } else {
      setCapturando(false);
    }
  }

  const titulo = `Paquete ${legible(codigo)}`;

  if (capturando) {
    const primero = renglones.length === 0;
    return (
      <Pantalla titulo={titulo} subtitulo={cajaTitulo} onVolver={onCancelar}>
        {renglones.length > 0 && (
          <Aviso>
            Ya trae: {describirContenido(contenidoActual(), nombre)}
          </Aviso>
        )}
        {!!error && <AvisoError error={error} />}
        <CapturaRenglon
          key={vuelta}
          sesion={sesion}
          destino={destino}
          ocupado={guardando}
          botones={
            primero && !editando
              ? [
                  { id: "guardar", texto: "Guardar paquete" },
                  { id: "otro", texto: "Agregar otro artículo (surtido)", variante: "outline" },
                ]
              : [{ id: "agregar", texto: "Agregar al paquete" }]
          }
          onListo={agregar}
          onCancelar={primero ? onCancelar : () => setCapturando(false)}
          textoCancelar={primero ? "Cancelar" : "Volver al paquete"}
        />
        {guardando && <Cargando texto="Guardando…" />}
      </Pantalla>
    );
  }

  const piezasValidas = renglones.every((r) => {
    const n = Number(r.texto);
    return Number.isInteger(n) && n >= 1;
  });

  return (
    <Pantalla
      titulo={titulo}
      subtitulo={cajaTitulo}
      onVolver={onCancelar}
      pie={
        <>
          <BotonGrande
            onClick={() => guardar()}
            disabled={guardando || renglones.length === 0 || !piezasValidas}
          >
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar paquete"}
          </BotonGrande>
        </>
      }
    >
      <p className="text-base font-medium">Lo que trae:</p>
      {renglones.length === 0 ? (
        <p className="text-base text-muted-foreground">Nada todavía.</p>
      ) : (
        <ul className="space-y-3">
          {renglones.map((r, i) => {
            const n = nombre(r.articuloId, r.subvariacionCodigo);
            const aviso = avisoDestino(articuloEnMemoria(sesion, r.articuloId), destino);
            return (
              <li key={`${r.articuloId}|${r.subvariacionCodigo ?? ""}|${i}`} className="space-y-2 rounded-md border bg-card p-3">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-base font-medium leading-tight">{n}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Quitar ${n}`}
                    onClick={() => setRenglones((prev) => prev.filter((_, j) => j !== i))}
                    disabled={guardando}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <CampoPiezas
                  valor={r.texto}
                  etiqueta={`Piezas de ${n}`}
                  onCambio={(texto) =>
                    setRenglones((prev) => prev.map((x, j) => (j === i ? { ...x, texto } : x)))
                  }
                />
                {aviso && <p className="text-sm text-amber-800">{aviso}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="outline"
        className="h-12 w-full text-base"
        onClick={() => setCapturando(true)}
        disabled={guardando}
      >
        <Plus className="mr-2 h-5 w-5" /> Agregar otro artículo
      </Button>
      {!!error && <AvisoError error={error} onReintentar={() => guardar()} />}
      {editando && onQuitar && (
        <div className="pt-4">
          {confirmarQuitar ? (
            <ConfirmarEnLinea
              pregunta="¿Quitar este paquete del lote? Su etiqueta solo se podrá volver a usar en este lote."
              textoSi="Sí, quitar"
              ocupado={guardando}
              onSi={quitar}
              onNo={() => setConfirmarQuitar(false)}
            />
          ) : (
            <Button
              variant="ghost"
              className="h-12 w-full text-base text-destructive"
              onClick={() => setConfirmarQuitar(true)}
              disabled={guardando}
            >
              <Trash2 className="mr-2 h-5 w-5" /> Quitar paquete
            </Button>
          )}
        </div>
      )}
    </Pantalla>
  );
}

/** Piezas sueltas nuevas: artículo y piezas. */
export function SueltaNuevaForm({
  sesion,
  destino,
  cajaTitulo,
  onGuardar,
  onCancelar,
}: {
  sesion: SesionEnlace;
  destino?: Sucursal;
  cajaTitulo: string;
  onGuardar: (r: LoteContenido) => Promise<void>;
  onCancelar: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [ultimo, setUltimo] = useState<LoteContenido | null>(null);

  async function guardar(r: LoteContenido) {
    setGuardando(true);
    setError(null);
    setUltimo(r);
    try {
      await onGuardar(r);
    } catch (e) {
      setError(e);
      setGuardando(false);
    }
  }

  return (
    <Pantalla titulo="Piezas sueltas" subtitulo={`${cajaTitulo} · sin etiqueta`} onVolver={onCancelar}>
      {!!error && (
        <AvisoError error={error} onReintentar={ultimo ? () => guardar(ultimo) : undefined} />
      )}
      <CapturaRenglon
        sesion={sesion}
        destino={destino}
        ocupado={guardando}
        botones={[{ id: "guardar", texto: "Guardar sueltas" }]}
        onListo={(r) => guardar(r)}
        onCancelar={onCancelar}
      />
      {guardando && <Cargando texto="Guardando…" />}
    </Pantalla>
  );
}

/** Corregir o quitar piezas sueltas ya guardadas. */
export function SueltaEditarForm({
  nombreArticulo,
  cajaTitulo,
  piezas,
  aviso,
  onGuardar,
  onQuitar,
  onCancelar,
}: {
  nombreArticulo: string;
  cajaTitulo: string;
  piezas: number;
  aviso?: string | null;
  onGuardar: (piezas: number) => Promise<void>;
  onQuitar: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(String(piezas));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const n = Number(texto);
  const valido = Number.isInteger(n) && n >= 1;

  async function correr(fn: () => Promise<void>) {
    setGuardando(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
      setGuardando(false);
      setConfirmarQuitar(false);
    }
  }

  return (
    <Pantalla
      titulo="Piezas sueltas"
      subtitulo={cajaTitulo}
      onVolver={onCancelar}
      pie={
        <BotonGrande onClick={() => correr(() => onGuardar(n))} disabled={!valido || guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </BotonGrande>
      }
    >
      <div className="rounded-md border bg-card p-3">
        <p className="text-sm text-muted-foreground">Artículo</p>
        <p className="text-lg font-semibold leading-tight">{nombreArticulo}</p>
      </div>
      {aviso && <Aviso tono="ojo">{aviso}</Aviso>}
      <div className="space-y-2">
        <p className="text-base font-medium">¿Cuántas piezas?</p>
        <CampoPiezas valor={texto} onCambio={setTexto} />
      </div>
      {!!error && <AvisoError error={error} />}
      <div className="pt-4">
        {confirmarQuitar ? (
          <ConfirmarEnLinea
            pregunta="¿Quitar estas piezas sueltas del lote?"
            textoSi="Sí, quitar"
            ocupado={guardando}
            onSi={() => correr(onQuitar)}
            onNo={() => setConfirmarQuitar(false)}
          />
        ) : (
          <Button
            variant="ghost"
            className="h-12 w-full text-base text-destructive"
            onClick={() => setConfirmarQuitar(true)}
            disabled={guardando}
          >
            <Trash2 className="mr-2 h-5 w-5" /> Quitar sueltas
          </Button>
        )}
      </div>
    </Pantalla>
  );
}

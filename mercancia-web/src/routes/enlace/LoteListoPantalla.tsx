import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  cajasOrdenadas,
  declaradoPorArticulo,
  partirClaveArticulo,
  validarLote,
  type Sucursal,
} from "@shared";
import { Input } from "@/components/ui/input";
import type { SesionEnlace } from "@/firebase/enlaceApp";
import { articuloEnMemoria, avisoDestino } from "@/features/enlace/catalogoService";
import { legible, totalesCaja, type Lote } from "@/features/enlace/lotesService";
import { Aviso, AvisoError, BotonGrande, Pantalla, plural } from "@/features/enlace/ui";
import { resumenTotales } from "./MisLotesPage";

const CLAVE_NOMBRE = "enlace.armo.v1";

function nombreGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? "";
  } catch {
    return "";
  }
}

/**
 * Terminar de armar: resumen, lo que falta arreglar (si algo), quién armó
 * (obligatorio) y, si ya se sabe, paquetería y guía de cada caja.
 */
export function LoteListoPantalla({
  sesion,
  lote,
  destino,
  onListo,
  onCancelar,
}: {
  sesion: SesionEnlace;
  lote: Lote;
  destino?: Sucursal;
  onListo: (datos: {
    responsableEmpaco: string;
    paqueteria: string;
    guias: Record<string, string>;
  }) => Promise<void>;
  onCancelar: () => void;
}) {
  const cajas = cajasOrdenadas(lote);
  const problemas = useMemo(() => validarLote(lote), [lote]);
  const avisos = useMemo(() => {
    const ids = new Set(
      [...declaradoPorArticulo(lote).keys()].map((k) => partirClaveArticulo(k).articuloId),
    );
    return [...ids]
      .map((id) => avisoDestino(articuloEnMemoria(sesion, id), destino))
      .filter((a): a is string => !!a);
  }, [lote, destino, sesion]);

  const [responsable, setResponsable] = useState(() => {
    const previo = lote.responsableEmpaco;
    // El de creación es el nombre del acceso ("Taller…"), no una persona.
    if (previo && previo !== sesion.nombre && previo !== "Enlace") return previo;
    return nombreGuardado();
  });
  const [paqueteria, setPaqueteria] = useState(lote.paqueteria ?? "");
  const [guias, setGuias] = useState<Record<string, string>>(() => ({ ...(lote.guias ?? {}) }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function marcar() {
    setGuardando(true);
    setError(null);
    try {
      try {
        localStorage.setItem(CLAVE_NOMBRE, responsable.trim());
      } catch {
        /* sin almacenamiento */
      }
      await onListo({ responsableEmpaco: responsable, paqueteria, guias });
    } catch (e) {
      setError(e);
      setGuardando(false);
    }
  }

  return (
    <Pantalla
      titulo="Lote listo"
      subtitulo={`${lote.folio ?? lote.id} → ${lote.sucursalDestinoNombre}`}
      onVolver={onCancelar}
      pie={
        <BotonGrande
          onClick={marcar}
          disabled={guardando || problemas.length > 0 || !responsable.trim()}
        >
          <CheckCircle2 className="mr-2 h-6 w-6" />
          {guardando ? "Guardando…" : "Marcar lote listo"}
        </BotonGrande>
      }
    >
      <section className="space-y-1 rounded-md border bg-card p-3">
        <p className="text-lg font-semibold">{resumenTotales(lote)}</p>
        <ul className="text-base text-muted-foreground">
          {cajas.map(({ llave, caja }) => {
            const t = totalesCaja(lote, llave);
            return (
              <li key={llave}>
                Caja {caja.orden}: {plural(t.paquetes, "paquete", "paquetes")}
                {t.sueltas > 0 ? ` + sueltas` : ""} · {plural(t.piezas, "pza", "pzas")}
              </li>
            );
          })}
        </ul>
      </section>

      {problemas.length > 0 && (
        <Aviso tono="mal">
          <p className="font-semibold">Antes hay que arreglar esto:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Aviso>
      )}
      {avisos.length > 0 && (
        <Aviso tono="ojo">
          <ul className="list-disc space-y-0.5 pl-5">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}

      <label className="block space-y-1">
        <span className="text-base font-medium">¿Quién armó el lote? *</span>
        <Input
          value={responsable}
          onChange={(e) => setResponsable(e.target.value)}
          aria-label="Nombre de quien armó el lote"
          placeholder="Tu nombre"
          autoComplete="name"
          maxLength={80}
          className="h-12 text-base"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-base font-medium">Paquetería (si ya se sabe)</span>
        <Input
          value={paqueteria}
          onChange={(e) => setPaqueteria(e.target.value)}
          aria-label="Paquetería"
          placeholder="Estafeta, DHL, propio…"
          maxLength={80}
          className="h-12 text-base"
        />
      </label>

      {cajas.length > 0 && (
        <div className="space-y-2">
          <p className="text-base font-medium">Guía de cada caja (si ya se tiene)</p>
          {cajas.map(({ llave, caja }) => (
            <label key={llave} className="block space-y-1">
              <span className="text-sm text-muted-foreground">
                Caja {caja.orden} · {legible(caja.codigo)}
              </span>
              <Input
                value={guias[llave] ?? ""}
                onChange={(e) => setGuias((g) => ({ ...g, [llave]: e.target.value }))}
                aria-label={`Guía de la caja ${caja.orden}`}
                placeholder="Número de guía"
                maxLength={80}
                autoCapitalize="characters"
                className="h-12 text-base"
              />
            </label>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Al marcarlo listo ya no se puede cambiar desde aquí. El administrador confirma el envío.
      </p>
      {!!error && <AvisoError error={error} onReintentar={marcar} />}
    </Pantalla>
  );
}

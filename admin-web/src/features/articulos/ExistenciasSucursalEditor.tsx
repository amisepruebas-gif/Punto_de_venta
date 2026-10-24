import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Layers, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { leerStockTienda, type Articulo, type UbicacionStock } from "@shared";
import { guardarExistenciasSucursal } from "./existenciasSucursalService";
import type { CambioExistencia } from "./planearExistencias";

type Fila = {
  clave: string;
  articuloId: string;
  subvariacionCodigo?: string;
  nombre: string;
  detalle: string;
  /** Stock de tienda en la sucursal según el snapshot en vivo. */
  actual: number;
  /** Subvariaciones legacy sin `codigo` no se pueden direccionar. */
  editable: boolean;
};

type Bloque = {
  articulo: Articulo;
  conVariaciones: boolean;
  filas: Fila[];
};

type Borrador = {
  articuloId: string;
  subvariacionCodigo?: string;
  /** Stock que había cuando se empezó a editar la fila. */
  base: number;
  texto: string;
};

function claveDe(articuloId: string, subvariacionCodigo?: string): string {
  return `${articuloId}|${subvariacionCodigo ?? ""}`;
}

/** Entero >= 0, o `null` si el texto no lo es. */
function parsearCantidad(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function sinClave<T>(obj: Record<string, T>, clave: string): Record<string, T> {
  const next = { ...obj };
  delete next[clave];
  return next;
}

type Props = {
  negocioId: string;
  /** Artículos visibles con los filtros actuales de la página. */
  articulos: Articulo[];
  ubicacion: UbicacionStock;
  sucursalNombre: string;
  onCerrar: () => void;
};

/**
 * Edición masiva del stock de tienda de UNA sucursal (p. ej. para cargar
 * el inventario inicial de una sucursal nueva). Artículos sin variaciones
 * se editan en el padre; con variaciones, por variación. Dónde se escribe
 * cada valor lo decide `planearExistencias` con la `ubicacion`.
 *
 * Los borradores se guardan por artículo/variación, así que sobreviven a
 * cambios de búsqueda o filtros de la página hasta que se guarda.
 */
export function ExistenciasSucursalEditor({
  negocioId,
  articulos,
  ubicacion,
  sucursalNombre,
  onCerrar,
}: Props) {
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  // Mensaje por fila tras guardar (conflicto o error).
  const [avisos, setAvisos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const bloques = useMemo<Bloque[]>(() => {
    const { sucursalId, esDefault } = ubicacion;
    return articulos.map((a) => {
      const subs = a.subvariaciones ?? [];
      if (subs.length === 0) {
        return {
          articulo: a,
          conVariaciones: false,
          filas: [
            {
              clave: claveDe(a.id),
              articuloId: a.id,
              nombre: a.nombre,
              detalle: a.fabricado
                ? `#${a.id} · fabricado: se mueve en Fabricación`
                : `#${a.id}${a.sigla ? ` · ${a.sigla}` : ""}`,
              actual: leerStockTienda(a, sucursalId, esDefault),
              // Lo fabricado solo se mueve con lotes, embarques y
              // reducciones con motivo (Fabricación).
              editable: !a.fabricado,
            },
          ],
        };
      }
      return {
        articulo: a,
        conVariaciones: true,
        filas: subs.map((sv, idx) => ({
          clave: sv.codigo ? claveDe(a.id, sv.codigo) : `${a.id}|#${idx}`,
          articuloId: a.id,
          subvariacionCodigo: sv.codigo,
          nombre: sv.nombre,
          detalle: sv.codigo ?? "Sin código: guarda el artículo para asignarlo",
          actual: leerStockTienda(sv, sucursalId, esDefault),
          editable: !!sv.codigo && !a.fabricado,
        })),
      };
    });
  }, [articulos, ubicacion]);

  const pendientes = Object.values(borradores).filter(
    (b) => parsearCantidad(b.texto) !== b.base,
  );
  const invalidos = pendientes.filter(
    (b) => parsearCantidad(b.texto) === null,
  ).length;

  function editar(fila: Fila, texto: string) {
    setBorradores((prev) => ({
      ...prev,
      [fila.clave]: {
        articuloId: fila.articuloId,
        subvariacionCodigo: fila.subvariacionCodigo,
        base: prev[fila.clave]?.base ?? fila.actual,
        texto,
      },
    }));
    setAvisos((prev) => (prev[fila.clave] ? sinClave(prev, fila.clave) : prev));
  }

  // Un input vacío al salir vuelve al stock actual en vez de contar como
  // cambio inválido.
  function alSalir(fila: Fila) {
    setBorradores((prev) =>
      prev[fila.clave]?.texto.trim() === "" ? sinClave(prev, fila.clave) : prev,
    );
  }

  function enfocarSiguiente(actual: HTMLInputElement) {
    const inputs = Array.from(
      listaRef.current?.querySelectorAll<HTMLInputElement>(
        "input[data-existencia]:not(:disabled)",
      ) ?? [],
    );
    const siguiente = inputs[inputs.indexOf(actual) + 1];
    siguiente?.focus();
  }

  async function guardar() {
    if (pendientes.length === 0 || invalidos > 0) return;
    const cambios: CambioExistencia[] = pendientes.map((b) => ({
      articuloId: b.articuloId,
      ...(b.subvariacionCodigo
        ? { subvariacionCodigo: b.subvariacionCodigo }
        : {}),
      base: b.base,
      valor: parsearCantidad(b.texto)!,
    }));
    setGuardando(true);
    setMensaje(null);
    try {
      const r = await guardarExistenciasSucursal(negocioId, ubicacion, cambios);
      setBorradores((prev) => {
        const next = { ...prev };
        for (const c of r.aplicados) {
          delete next[claveDe(c.articuloId, c.subvariacionCodigo)];
        }
        // En conflicto se conserva lo tecleado y la base pasa al stock
        // actual: guardar otra vez fija el valor a propósito.
        for (const { cambio, actual } of r.conflictos) {
          const k = claveDe(cambio.articuloId, cambio.subvariacionCodigo);
          if (next[k]) next[k] = { ...next[k]!, base: actual };
        }
        return next;
      });
      const nuevosAvisos: Record<string, string> = {};
      for (const { cambio, actual } of r.conflictos) {
        nuevosAvisos[claveDe(cambio.articuloId, cambio.subvariacionCodigo)] =
          `Cambió mientras editabas: ahora hay ${actual}. Guarda otra vez para fijar tu valor.`;
      }
      for (const { cambio, mensaje: m } of r.errores) {
        nuevosAvisos[claveDe(cambio.articuloId, cambio.subvariacionCodigo)] = m;
      }
      setAvisos(nuevosAvisos);
      const problemas = r.conflictos.length + r.errores.length;
      setMensaje({
        tipo: problemas > 0 ? "error" : "ok",
        texto:
          problemas > 0
            ? `${r.aplicados.length} guardados. ${r.conflictos.length} con conflicto y ${r.errores.length} con error: revisa las filas marcadas.`
            : `${r.aplicados.length} ${r.aplicados.length === 1 ? "existencia guardada" : "existencias guardadas"} en ${sucursalNombre}.`,
      });
    } catch (e) {
      setMensaje({ tipo: "error", texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  function cerrar() {
    if (
      pendientes.length > 0 &&
      !confirm(
        `Hay ${pendientes.length} ${pendientes.length === 1 ? "cambio" : "cambios"} sin guardar. ¿Descartarlos?`,
      )
    ) {
      return;
    }
    onCerrar();
  }

  function renderFila(fila: Fila, indentada: boolean) {
    const borrador = borradores[fila.clave];
    const texto = borrador ? borrador.texto : String(fila.actual);
    const valor = parsearCantidad(texto);
    const modificada = !!borrador && valor !== borrador.base;
    const invalida = !!borrador && valor === null;
    const aviso =
      avisos[fila.clave] ??
      (borrador && fila.actual !== borrador.base
        ? `Cambió mientras editabas: ahora hay ${fila.actual}.`
        : undefined);
    return (
      <div
        key={fila.clave}
        className={cn("flex items-center gap-3 px-3 py-2", indentada && "pl-9")}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fila.nombre}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {fila.detalle}
          </p>
          {aviso && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {aviso}
            </p>
          )}
        </div>
        <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
          {fila.actual}
        </span>
        <Input
          data-existencia=""
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={texto}
          disabled={!fila.editable || guardando}
          aria-label={`Existencia de ${fila.nombre} en ${sucursalNombre}`}
          aria-invalid={invalida || undefined}
          onChange={(e) => editar(fila, e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => alSalir(fila)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              enfocarSiguiente(e.currentTarget);
            }
          }}
          className={cn(
            "h-8 w-24 text-right tabular-nums",
            modificada && "border-primary bg-primary/5",
            invalida && "border-destructive",
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-sm font-medium">
          Existencias de tienda en {sucursalNombre}
        </p>
        <p className="text-xs text-muted-foreground">
          {ubicacion.esDefault
            ? "Es la sucursal default: se guarda en el stock principal del artículo, y el de un artículo con variaciones queda como la suma de sus variaciones."
            : "Se guarda solo para esta sucursal: no cambia el stock de la sucursal default ni la bodega."}{" "}
          Enter pasa a la siguiente fila. Los cambios en artículos que ocultes
          con la búsqueda o los filtros se conservan hasta que guardes.
        </p>
      </div>

      {bloques.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin artículos con esos filtros
        </p>
      ) : (
        <div ref={listaRef} className="divide-y rounded-lg border bg-card">
          <div className="flex items-center gap-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex-1">Artículo</span>
            <span className="w-14 text-right">Actual</span>
            <span className="w-24 text-right">Nueva</span>
          </div>
          {bloques.map((b) =>
            b.conVariaciones ? (
              <div key={b.articulo.id} className="divide-y">
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
                  <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {b.articulo.nombre}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      #{b.articulo.id}
                    </span>
                  </p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Σ {b.filas.reduce((acc, f) => acc + f.actual, 0)}
                  </span>
                </div>
                {b.filas.map((f) => renderFila(f, true))}
              </div>
            ) : (
              renderFila(b.filas[0]!, false)
            ),
          )}
        </div>
      )}

      <div className="sticky bottom-0 z-20 space-y-2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        {mensaje && (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={cn(
              "text-sm",
              mensaje.tipo === "error" ? "text-destructive" : "text-emerald-600",
            )}
          >
            {mensaje.texto}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-sm">
            {pendientes.length === 0
              ? "Sin cambios pendientes"
              : `${pendientes.length} ${pendientes.length === 1 ? "cambio pendiente" : "cambios pendientes"}`}
            {invalidos > 0 && (
              <span className="text-destructive">
                {" "}
                · {invalidos} con cantidad inválida (entero ≥ 0)
              </span>
            )}
          </p>
          <Button variant="outline" onClick={cerrar} disabled={guardando}>
            Cerrar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando || pendientes.length === 0 || invalidos > 0}
          >
            <Save className="mr-2 h-4 w-4" />
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

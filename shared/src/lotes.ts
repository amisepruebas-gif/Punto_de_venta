// ============================================================
// Lotes de envío — helpers puros
// ============================================================
//
// Un lote es un Resurtido "crecido": además de la lista plana (`lineas`)
// lleva cajas → paquetes / piezas sueltas, cada caja y cada paquete con el
// código de una etiqueta numerada (ver `Resurtido` en `schema.ts`).
//
//   armar (teléfono con enlace)  → `creando`, al final `listo: true`
//   confirmar envío (admin)      → `enviado`   (baja el taller)
//   recibir (caja, por sesiones) → `parcial` / `cerrado` (sube la sucursal)
//   "no llegó" (admin)           → `cerrado`
//
// La recepción se concilia POR ARTÍCULO: lo declarado (paquetes + sueltas)
// contra lo contado (contenido de los paquetes escaneados cerrados + piezas
// contadas una por una). No es una lista para palomear.
//
// Todo aquí es puro: cada app lee y escribe con su SDK y usa estos planes
// dentro de su transacción (leer → planear → `tx.update`).

import type {
  Articulo,
  LoteCaja,
  LotePaquete,
  LoteSesion,
  LoteSuelta,
  Resurtido,
  ResurtidoLinea,
} from "./schema";
import { planearMovimientoStock, type UbicacionResuelta } from "./inventario";

// ---------- Códigos ----------

/** Las etiquetas numeradas son 12 dígitos: `88` + consecutivo de 10. Solo
 *  dígitos para que el Code128 quepa en el rollo de 50 mm. */
export const PREFIJO_ETIQUETA_LOTE = "88";
const RE_ETIQUETA_LOTE = /^88\d{10}$/;

/** Código de la etiqueta número `n` (1…). */
export function codigoEtiquetaLote(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 9_999_999_999) {
    throw new Error("Número de etiqueta inválido");
  }
  return PREFIJO_ETIQUETA_LOTE + String(n).padStart(10, "0");
}

export function esCodigoEtiquetaLote(codigo: string): boolean {
  return RE_ETIQUETA_LOTE.test(codigo.trim());
}

/** `880000000123` → `8800 0000 0123` (para leerlo o dictarlo). */
export function etiquetaLoteLegible(codigo: string): string {
  return codigo.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export const llaveCajaLote = (codigo: string) => `c${codigo}`;
export const llavePaqueteLote = (codigo: string) => `p${codigo}`;

/** Letra del acceso número `indice` (0 → A … 25 → Z, 26 → AA…). */
export function letraEnlace(indice: number): string {
  let n = Math.max(0, Math.floor(indice));
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

/** Primera letra libre para un acceso nuevo. */
export function siguienteLetraEnlace(usadas: readonly string[]): string {
  const ocupadas = new Set(usadas);
  for (let i = 0; ; i++) {
    const letra = letraEnlace(i);
    if (!ocupadas.has(letra)) return letra;
  }
}

export const RE_FOLIO_LOTE = /^L\d{6}-[A-Z]{1,2}\d{1,3}$/;

/**
 * Código del lote número `n` del día para el acceso `letra`:
 * `folioLote("2026-11-16", "A", 1)` → `L261116-A1`. Es también el id del
 * documento, así que crear uno repetido falla y se toma el siguiente.
 */
export function folioLote(ymd: string, letra: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Fecha inválida para el lote: ${ymd}`);
  return `L${m[1]!.slice(2)}${m[2]}${m[3]}-${letra}${n}`;
}

// ---------- Forma del lote ----------

type LoteForma = Pick<Resurtido, "cajas" | "paquetes" | "sueltas">;
type LoteConSesiones = LoteForma & Pick<Resurtido, "recepcion">;

/** Un resurtido es lote si tiene `cajas` (aunque esté vacío). */
export function esLote<T extends Pick<Resurtido, "cajas">>(
  r: T | null | undefined,
): r is T & { cajas: Record<string, LoteCaja> } {
  return !!r && r.cajas !== undefined && r.cajas !== null;
}

/** Lote enviado que todavía tiene piezas por llegar. */
export function loteAbierto(r: Pick<Resurtido, "estado">): boolean {
  return r.estado === "enviado" || r.estado === "parcial";
}

/** Llave de un artículo en las cuentas del lote: `id` o `id|v-NN-XXX`. */
export function claveArticulo(
  articuloId: string,
  subvariacionCodigo?: string,
): string {
  return subvariacionCodigo ? `${articuloId}|${subvariacionCodigo}` : articuloId;
}

export function partirClaveArticulo(clave: string): {
  articuloId: string;
  subvariacionCodigo?: string;
} {
  const i = clave.indexOf("|");
  return i === -1
    ? { articuloId: clave }
    : { articuloId: clave.slice(0, i), subvariacionCodigo: clave.slice(i + 1) };
}

export const LOTE_MAX_CAJAS = 50;
export const LOTE_MAX_PAQUETES = 999;
/** Artículos distintos: cada uno es una lectura y una escritura en la
 *  transacción de enviar. */
export const LOTE_MAX_ARTICULOS = 300;
const LOTE_MAX_PIEZAS_RENGLON = 100_000;

function sumar(mapa: Map<string, number>, clave: string, n: number) {
  if (!n) return;
  mapa.set(clave, (mapa.get(clave) ?? 0) + n);
}

function enteroPositivo(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1;
}

function renglonValido(c: unknown): c is { articuloId: string; subvariacionCodigo?: string; piezas: number } {
  if (!c || typeof c !== "object") return false;
  const r = c as { articuloId?: unknown; subvariacionCodigo?: unknown; piezas?: unknown };
  return (
    typeof r.articuloId === "string" &&
    r.articuloId.length > 0 &&
    (r.subvariacionCodigo === undefined || typeof r.subvariacionCodigo === "string") &&
    enteroPositivo(r.piezas) &&
    r.piezas <= LOTE_MAX_PIEZAS_RENGLON
  );
}

/**
 * Piezas por artículo de un paquete (suma renglones repetidos). Un lote
 * armado desde un enlace no es de confianza: los renglones mal formados se
 * ignoran aquí (y `validarLote` los reporta) en vez de tronar la pantalla.
 */
export function contenidoDePaquete(p: LotePaquete): Map<string, number> {
  const m = new Map<string, number>();
  const contenido: unknown = p?.contenido;
  if (!Array.isArray(contenido)) return m;
  for (const c of contenido) {
    if (!renglonValido(c)) continue;
    sumar(m, claveArticulo(c.articuloId, c.subvariacionCodigo), c.piezas);
  }
  return m;
}

/** Total declarado por artículo: paquetes + sueltas. */
export function declaradoPorArticulo(lote: LoteForma): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of Object.values(lote.paquetes ?? {})) {
    for (const [clave, n] of contenidoDePaquete(p)) sumar(m, clave, n);
  }
  for (const s of Object.values(lote.sueltas ?? {})) {
    if (!renglonValido(s)) continue;
    sumar(m, claveArticulo(s.articuloId, s.subvariacionCodigo), s.piezas);
  }
  return m;
}

export function cajasOrdenadas(
  lote: LoteForma,
): Array<{ llave: string; caja: LoteCaja }> {
  return Object.entries(lote.cajas ?? {})
    .map(([llave, caja]) => ({ llave, caja }))
    .sort((a, b) => a.caja.orden - b.caja.orden || a.llave.localeCompare(b.llave));
}

export function paquetesDeCaja(
  lote: LoteForma,
  llaveCaja: string,
): Array<{ llave: string; paquete: LotePaquete }> {
  return Object.entries(lote.paquetes ?? {})
    .filter(([, p]) => p.caja === llaveCaja)
    .map(([llave, paquete]) => ({ llave, paquete }))
    .sort((a, b) => a.paquete.orden - b.paquete.orden || a.llave.localeCompare(b.llave));
}

export function sueltasDeCaja(
  lote: LoteForma,
  llaveCaja: string,
): Array<{ llave: string; suelta: LoteSuelta }> {
  return Object.entries(lote.sueltas ?? {})
    .filter(([, s]) => s.caja === llaveCaja)
    .map(([llave, suelta]) => ({ llave, suelta }))
    .sort((a, b) => a.suelta.orden - b.suelta.orden || a.llave.localeCompare(b.llave));
}

/** Siguiente `orden` libre dentro de un mapa del lote. */
export function siguienteOrden(
  mapa: Record<string, { orden: number }> | undefined,
): number {
  let max = 0;
  for (const x of Object.values(mapa ?? {})) max = Math.max(max, x.orden || 0);
  return max + 1;
}

export type TotalesLote = {
  cajas: number;
  paquetes: number;
  /** Piezas en total (paquetes + sueltas). */
  piezas: number;
  /** Artículos (o variaciones) distintos. */
  articulos: number;
};

export function totalesLote(lote: LoteForma): TotalesLote {
  const declarado = declaradoPorArticulo(lote);
  let piezas = 0;
  for (const n of declarado.values()) piezas += n;
  return {
    cajas: Object.keys(lote.cajas ?? {}).length,
    paquetes: Object.keys(lote.paquetes ?? {}).length,
    piezas,
    articulos: declarado.size,
  };
}

// ---------- Validación ----------


/**
 * Problemas que impiden enviar el lote (vacío = se puede). Las reglas de
 * Firestore no pueden revisar cantidades dentro de mapas, así que esto se
 * vuelve a correr al confirmar el envío: un lote armado desde un enlace no
 * es de confianza.
 */
export function validarLote(lote: LoteForma): string[] {
  const problemas: string[] = [];
  const cajas = lote.cajas ?? {};
  const paquetes = lote.paquetes ?? {};
  const sueltas = lote.sueltas ?? {};
  const nCajas = Object.keys(cajas).length;
  if (nCajas === 0) problemas.push("El lote no tiene cajas");
  if (nCajas > LOTE_MAX_CAJAS) {
    problemas.push(`Máximo ${LOTE_MAX_CAJAS} cajas por lote`);
  }
  if (Object.keys(paquetes).length > LOTE_MAX_PAQUETES) {
    problemas.push(`Máximo ${LOTE_MAX_PAQUETES} paquetes por lote: divídelo en dos`);
  }

  const codigos = new Set<string>();
  const conContenido = new Set<string>();
  for (const [llave, caja] of Object.entries(cajas)) {
    if (!esCodigoEtiquetaLote(String(caja?.codigo ?? "")) || llave !== llaveCajaLote(caja.codigo)) {
      problemas.push(`La caja ${caja.orden} tiene una etiqueta inválida`);
    } else if (codigos.has(caja.codigo)) {
      problemas.push(`La etiqueta ${caja.codigo} está repetida`);
    }
    codigos.add(caja.codigo);
  }
  for (const [llave, p] of Object.entries(paquetes)) {
    if (!esCodigoEtiquetaLote(String(p?.codigo ?? "")) || llave !== llavePaqueteLote(p.codigo)) {
      problemas.push(`Un paquete tiene una etiqueta inválida (${p.codigo})`);
    } else if (codigos.has(p.codigo)) {
      problemas.push(`La etiqueta ${p.codigo} está repetida`);
    }
    codigos.add(p.codigo);
    if (!cajas[p.caja]) {
      problemas.push(`El paquete ${p.codigo} no está en ninguna caja`);
    } else {
      conContenido.add(p.caja);
    }
    if (!Array.isArray(p.contenido) || p.contenido.length === 0) {
      problemas.push(`El paquete ${p.codigo} está vacío`);
    } else if (!p.contenido.every(renglonValido)) {
      problemas.push(`El paquete ${p.codigo} tiene una cantidad inválida`);
    }
  }
  for (const s of Object.values(sueltas)) {
    if (!cajas[s.caja]) {
      problemas.push("Hay piezas sueltas que no están en ninguna caja");
    } else {
      conContenido.add(s.caja);
    }
    if (!renglonValido(s)) problemas.push("Hay piezas sueltas con una cantidad inválida");
  }
  for (const { llave, caja } of cajasOrdenadas(lote)) {
    if (!conContenido.has(llave)) problemas.push(`La caja ${caja.orden} está vacía`);
  }
  if (problemas.length === 0 && declaradoPorArticulo(lote).size > LOTE_MAX_ARTICULOS) {
    problemas.push(
      `Máximo ${LOTE_MAX_ARTICULOS} artículos distintos por lote: divídelo en dos`,
    );
  }
  return [...new Set(problemas)];
}

// ---------- Confirmar el envío (admin) ----------

export type InfoArticuloLote = { nombre: string; sigla?: string };

/** Nombre y sigla de un artículo o de su variación (`Padre — Variación`). */
export function infoArticuloLote(
  art: Pick<Articulo, "nombre" | "sigla" | "subvariaciones"> | undefined,
  subvariacionCodigo?: string,
): InfoArticuloLote | null {
  if (!art) return null;
  if (!subvariacionCodigo) {
    return { nombre: art.nombre, ...(art.sigla ? { sigla: art.sigla } : {}) };
  }
  const sub = art.subvariaciones?.find((s) => s.codigo === subvariacionCodigo);
  if (!sub) return null;
  return {
    nombre: `${art.nombre} — ${sub.nombre}`,
    ...(art.sigla ? { sigla: art.sigla } : {}),
  };
}

/** La lista plana (`lineas`) de un lote: una línea por artículo, con el
 *  total declarado. La usan las listas, Fabricación y el aviso. */
export function lineasDeLote(
  lote: LoteForma,
  info: (articuloId: string, subvariacionCodigo?: string) => InfoArticuloLote | null,
): ResurtidoLinea[] {
  const lineas: ResurtidoLinea[] = [];
  for (const [clave, piezas] of declaradoPorArticulo(lote)) {
    const { articuloId, subvariacionCodigo } = partirClaveArticulo(clave);
    const i = info(articuloId, subvariacionCodigo);
    lineas.push({
      articuloId,
      ...(subvariacionCodigo ? { subvariacionCodigo } : {}),
      nombreSnapshot: i?.nombre ?? articuloId,
      ...(i?.sigla ? { siglaSnapshot: i.sigla } : {}),
      cantidadEnviada: piezas,
    });
  }
  return lineas.sort((a, b) => a.nombreSnapshot.localeCompare(b.nombreSnapshot, "es"));
}

/** No se puede enviar: trae TODOS los problemas, no solo el primero. */
export class LoteConProblemas extends Error {
  problemas: string[];
  constructor(problemas: string[]) {
    super(problemas.join("\n"));
    this.name = "LoteConProblemas";
    this.problemas = problemas;
  }
}

export type PlanEnvioLote = {
  lineas: ResurtidoLinea[];
  /** Campos a escribir por artículo (`tx.update(ref, parche)`). */
  parches: Map<string, Partial<Articulo>>;
};

/**
 * Planea confirmar el envío: valida el lote completo, calcula `lineas` y
 * baja del taller (`cantidadBodega`) lo declarado. `articulos` son los
 * documentos leídos dentro de la transacción. Lanza `LoteConProblemas` con
 * todo lo que falta (artículos borrados, piezas que no hay en el taller…).
 */
export function planearEnvioLote(
  lote: LoteForma,
  articulos: ReadonlyMap<string, Articulo>,
): PlanEnvioLote {
  const invalido = validarLote(lote);
  if (invalido.length > 0) throw new LoteConProblemas(invalido);

  const problemas: string[] = [];
  const trabajo = new Map<string, Articulo>();
  const parches = new Map<string, Partial<Articulo>>();
  for (const [clave, piezas] of declaradoPorArticulo(lote)) {
    const { articuloId, subvariacionCodigo } = partirClaveArticulo(clave);
    const art = trabajo.get(articuloId) ?? articulos.get(articuloId);
    if (!art) {
      problemas.push(`El artículo ${articuloId} ya no existe`);
      continue;
    }
    try {
      const plan = planearMovimientoStock(art, { tipo: "bodega" }, -piezas, {
        subvariacionCodigo,
      });
      trabajo.set(articuloId, { ...art, ...plan.patch });
      parches.set(articuloId, { ...(parches.get(articuloId) ?? {}), ...plan.patch });
    } catch (e) {
      problemas.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (problemas.length > 0) throw new LoteConProblemas(problemas);

  const lineas = lineasDeLote(lote, (id, sub) => infoArticuloLote(articulos.get(id), sub));
  return { lineas, parches };
}

// ---------- Resumen (declarado contra contado) ----------

export type CuentaArticuloLote = {
  declarado: number;
  /** Contado en buen estado. */
  bien: number;
  danado: number;
  noLlego: number;
  /** Lo que falta por contar. */
  pendiente: number;
  /** Contado de más, o de un artículo que no venía. */
  sobrante: number;
  /** Lo que sí entró al inventario de la sucursal. */
  entro: number;
};

export type EstadoPaqueteLote = "pendiente" | "recibido" | "danado";

export type ResumenLote = {
  porArticulo: Map<string, CuentaArticuloLote>;
  totales: CuentaArticuloLote;
  /** Estado de cada paquete declarado, por llave. */
  paquetes: Map<string, { estado: EstadoPaqueteLote; sesion?: string; hora?: string }>;
  /** Cajas cuya llegada ya se anotó, por llave. */
  cajasLlegadas: Map<string, { sesion: string; hora?: string }>;
  paquetesTotal: number;
  paquetesRecibidos: number;
  paquetesDanados: number;
  cajasTotal: number;
  sinStock: Array<{ clave: string; piezas: number; motivo: string; sesion: string }>;
  desconocidos: string[];
};

/** Sesiones en orden: por fecha y, si empatan, por id. */
export function sesionesOrdenadas(
  lote: Pick<Resurtido, "recepcion">,
): Array<{ id: string; sesion: LoteSesion }> {
  return Object.entries(lote.recepcion?.sesiones ?? {})
    .map(([id, sesion]) => ({ id, sesion }))
    .sort((a, b) => a.sesion.fecha.localeCompare(b.sesion.fecha) || a.id.localeCompare(b.id));
}

function cuentaVacia(): CuentaArticuloLote {
  return { declarado: 0, bien: 0, danado: 0, noLlego: 0, pendiente: 0, sobrante: 0, entro: 0 };
}

function sumarMapa(
  cuentas: Map<string, CuentaArticuloLote>,
  campo: "bien" | "danado" | "noLlego" | "entro",
  mapa: Record<string, number> | undefined,
) {
  for (const [clave, n] of Object.entries(mapa ?? {})) {
    if (!enteroPositivo(n)) continue;
    const c = cuentas.get(clave) ?? cuentaVacia();
    c[campo] += n;
    cuentas.set(clave, c);
  }
}

/**
 * Lo declarado contra todo lo registrado en las sesiones. Un paquete cuenta
 * una sola vez (la primera sesión que lo trae).
 */
export function resumenLote(lote: LoteConSesiones): ResumenLote {
  const porArticulo = new Map<string, CuentaArticuloLote>();
  for (const [clave, n] of declaradoPorArticulo(lote)) {
    porArticulo.set(clave, { ...cuentaVacia(), declarado: n });
  }
  const paquetes: ResumenLote["paquetes"] = new Map();
  for (const llave of Object.keys(lote.paquetes ?? {})) {
    paquetes.set(llave, { estado: "pendiente" });
  }
  const cajasLlegadas: ResumenLote["cajasLlegadas"] = new Map();
  const sinStock: ResumenLote["sinStock"] = [];
  const desconocidos = new Set<string>();

  const marcarPaquetes = (
    llaves: string[] | undefined,
    estado: "recibido" | "danado",
    id: string,
    sesion: LoteSesion,
  ) => {
    for (const llave of llaves ?? []) {
      const p = lote.paquetes?.[llave];
      const actual = paquetes.get(llave);
      if (!p || !actual || actual.estado !== "pendiente") continue;
      const hora = sesion.horas?.[llave];
      paquetes.set(llave, { estado, sesion: id, ...(hora ? { hora } : {}) });
      const campo = estado === "recibido" ? "bien" : "danado";
      for (const [clave, n] of contenidoDePaquete(p)) {
        const c = porArticulo.get(clave) ?? cuentaVacia();
        c[campo] += n;
        porArticulo.set(clave, c);
      }
    }
  };

  for (const { id, sesion } of sesionesOrdenadas(lote)) {
    if (sesion.tipo === "no_llego") {
      sumarMapa(porArticulo, "noLlego", sesion.noLlego);
      continue;
    }
    for (const llave of sesion.cajas ?? []) {
      if (!lote.cajas?.[llave] || cajasLlegadas.has(llave)) continue;
      const hora = sesion.horas?.[llave];
      cajasLlegadas.set(llave, { sesion: id, ...(hora ? { hora } : {}) });
    }
    marcarPaquetes(sesion.paquetes, "recibido", id, sesion);
    marcarPaquetes(sesion.paquetesDanados, "danado", id, sesion);
    sumarMapa(porArticulo, "bien", sesion.piezas);
    sumarMapa(porArticulo, "danado", sesion.danadas);
    sumarMapa(porArticulo, "entro", sesion.entro);
    for (const s of sesion.sinStock ?? []) sinStock.push({ ...s, sesion: id });
    for (const d of sesion.desconocidos ?? []) desconocidos.add(d);
  }

  const totales = cuentaVacia();
  for (const c of porArticulo.values()) {
    const contado = c.bien + c.danado + c.noLlego;
    c.pendiente = Math.max(0, c.declarado - contado);
    c.sobrante = Math.max(0, contado - c.declarado);
    totales.declarado += c.declarado;
    totales.bien += c.bien;
    totales.danado += c.danado;
    totales.noLlego += c.noLlego;
    totales.pendiente += c.pendiente;
    totales.sobrante += c.sobrante;
    totales.entro += c.entro;
  }
  let paquetesRecibidos = 0;
  let paquetesDanados = 0;
  for (const p of paquetes.values()) {
    if (p.estado === "recibido") paquetesRecibidos++;
    else if (p.estado === "danado") paquetesDanados++;
  }
  return {
    porArticulo,
    totales,
    paquetes,
    cajasLlegadas,
    paquetesTotal: paquetes.size,
    paquetesRecibidos,
    paquetesDanados,
    cajasTotal: Object.keys(lote.cajas ?? {}).length,
    sinStock,
    desconocidos: [...desconocidos],
  };
}

/** Piezas que faltan por llegar, por artículo padre (para "en tránsito"). */
export function pendientePorArticuloId(lote: LoteConSesiones): Map<string, number> {
  const m = new Map<string, number>();
  for (const [clave, c] of resumenLote(lote).porArticulo) {
    sumar(m, partirClaveArticulo(clave).articuloId, c.pendiente);
  }
  return m;
}

// ---------- Conteo en la caja (lo escaneado, antes de "Terminar") ----------

/** Lo que la caja lleva escaneado de un lote. Vive en la tablet hasta que
 *  se guarda como sesión. Las horas son `HH:mm:ss`. */
export type ConteoLote = {
  cajas: Record<string, string>;
  paquetes: Record<string, string>;
  paquetesDanados: Record<string, string>;
  piezas: Record<string, number>;
  danadas: Record<string, number>;
  desconocidos: string[];
};

export function conteoLoteVacio(): ConteoLote {
  return { cajas: {}, paquetes: {}, paquetesDanados: {}, piezas: {}, danadas: {}, desconocidos: [] };
}

export function conteoLoteEstaVacio(c: ConteoLote): boolean {
  return (
    Object.keys(c.cajas).length === 0 &&
    Object.keys(c.paquetes).length === 0 &&
    Object.keys(c.paquetesDanados).length === 0 &&
    Object.keys(c.piezas).length === 0 &&
    Object.keys(c.danadas).length === 0 &&
    c.desconocidos.length === 0
  );
}

/** El conteo como si fuera una sesión ya guardada (para ver el avance). */
export function sesionDeConteo(
  conteo: ConteoLote,
  meta: { fecha: string; quien: string },
): LoteSesion {
  return {
    tipo: "recepcion",
    fecha: meta.fecha,
    quien: meta.quien,
    cajas: Object.keys(conteo.cajas),
    paquetes: Object.keys(conteo.paquetes),
    paquetesDanados: Object.keys(conteo.paquetesDanados),
    piezas: conteo.piezas,
    danadas: conteo.danadas,
    desconocidos: conteo.desconocidos,
    horas: { ...conteo.cajas, ...conteo.paquetes, ...conteo.paquetesDanados },
  };
}

/** Resumen del lote contando también lo escaneado y aún sin guardar. */
export function resumenLoteConConteo(lote: LoteConSesiones, conteo: ConteoLote): ResumenLote {
  return resumenLote({
    ...lote,
    recepcion: {
      sesiones: {
        ...(lote.recepcion?.sesiones ?? {}),
        // "~" ordena al final: el conteo local siempre es la última sesión.
        "~local": sesionDeConteo(conteo, { fecha: "9999-12-31 23:59:59", quien: "" }),
      },
    },
  });
}

/** Lo que devuelve la app al interpretar un código que no es etiqueta. */
export type ArticuloEscaneado =
  | { articuloId: string; subvariacionCodigo?: string; nombre: string }
  /** Es el id de un artículo con variaciones: hay que elegir cuál. */
  | { variacionesDe: string; nombre: string };

export type TonoEscaneo = "bien" | "repetido" | "sobrante" | "desconocido" | "pregunta";

export type ResultadoEscaneoLote = {
  conteo: ConteoLote;
  tono: TonoEscaneo;
  texto: string;
  /** Con tono "pregunta": id del artículo del que hay que elegir variación. */
  elegirVariacionDe?: string;
};

function describirContenido(
  p: LotePaquete,
  nombre: (clave: string) => string,
): string {
  const partes: string[] = [];
  for (const [clave, n] of contenidoDePaquete(p)) partes.push(`${n} × ${nombre(clave)}`);
  return partes.join(", ");
}

/**
 * Interpreta un código escaneado (o tecleado) al recibir: etiqueta de caja,
 * etiqueta de paquete o artículo. Devuelve el conteo nuevo y qué decirle a
 * quien escanea. `cantidad` solo aplica a artículos.
 */
export function aplicarEscaneoLote(args: {
  lote: LoteConSesiones;
  conteo: ConteoLote;
  codigo: string;
  cantidad?: number;
  /** Lo escaneado se anota como dañado. */
  danado?: boolean;
  /** `HH:mm:ss` del escaneo. */
  hora: string;
  resolverArticulo: (codigo: string) => ArticuloEscaneado | null;
  nombreArticulo?: (clave: string) => string;
}): ResultadoEscaneoLote {
  const { lote, conteo, hora } = args;
  const codigo = args.codigo.trim();
  const danado = !!args.danado;
  const nombre = args.nombreArticulo ?? ((clave: string) => clave);
  if (!codigo) return { conteo, tono: "desconocido", texto: "Escanea o escribe un código" };
  const previo = resumenLote(lote);

  // 1. Etiqueta de caja.
  const llaveC = llaveCajaLote(codigo);
  const caja = lote.cajas?.[llaveC];
  if (caja) {
    const total = previo.cajasTotal;
    if (previo.cajasLlegadas.has(llaveC) || conteo.cajas[llaveC]) {
      return { conteo, tono: "repetido", texto: `La caja ${caja.orden} ya estaba anotada` };
    }
    return {
      conteo: { ...conteo, cajas: { ...conteo.cajas, [llaveC]: hora } },
      tono: "bien",
      texto: `Caja ${caja.orden} de ${total}`,
    };
  }

  // 2. Etiqueta de paquete.
  const llaveP = llavePaqueteLote(codigo);
  const paquete = lote.paquetes?.[llaveP];
  if (paquete) {
    if (previo.paquetes.get(llaveP)?.estado !== "pendiente") {
      return { conteo, tono: "repetido", texto: "Ese paquete ya se había recibido" };
    }
    if (conteo.paquetes[llaveP] || conteo.paquetesDanados[llaveP]) {
      return { conteo, tono: "repetido", texto: "Ese paquete ya lo escaneaste" };
    }
    const campo = danado ? "paquetesDanados" : "paquetes";
    const cajaLlego = previo.cajasLlegadas.has(paquete.caja) || !!conteo.cajas[paquete.caja];
    return {
      conteo: {
        ...conteo,
        [campo]: { ...conteo[campo], [llaveP]: hora },
        // Un paquete anota la llegada de su caja.
        ...(cajaLlego || !lote.cajas?.[paquete.caja]
          ? {}
          : { cajas: { ...conteo.cajas, [paquete.caja]: hora } }),
      },
      tono: "bien",
      texto: `${danado ? "Paquete dañado" : "Paquete"}: ${describirContenido(paquete, nombre)}`,
    };
  }

  // 3. Una etiqueta numerada que no es de este lote.
  if (esCodigoEtiquetaLote(codigo)) {
    return {
      conteo: anotarDesconocido(conteo, codigo),
      tono: "desconocido",
      texto: "Esa etiqueta no es de este lote",
    };
  }

  // 4. Artículo.
  const art = args.resolverArticulo(codigo);
  if (!art) {
    return {
      conteo: anotarDesconocido(conteo, codigo),
      tono: "desconocido",
      texto: `No se reconoce "${codigo}"`,
    };
  }
  if ("variacionesDe" in art) {
    return {
      conteo,
      tono: "pregunta",
      texto: `${art.nombre}: elige la variación`,
      elegirVariacionDe: art.variacionesDe,
    };
  }
  const cantidad = enteroPositivo(args.cantidad) ? args.cantidad : 1;
  const clave = claveArticulo(art.articuloId, art.subvariacionCodigo);
  const campo = danado ? "danadas" : "piezas";
  const nuevo: ConteoLote = {
    ...conteo,
    [campo]: { ...conteo[campo], [clave]: (conteo[campo][clave] ?? 0) + cantidad },
  };
  const cuenta = resumenLoteConConteo(lote, nuevo).porArticulo.get(clave);
  const declarado = cuenta?.declarado ?? 0;
  if (declarado === 0) {
    return { conteo: nuevo, tono: "sobrante", texto: `${art.nombre} no viene en este lote` };
  }
  if ((cuenta?.sobrante ?? 0) > 0) {
    return {
      conteo: nuevo,
      tono: "sobrante",
      texto: `${art.nombre}: ${cuenta!.sobrante} de más`,
    };
  }
  const contado = (cuenta?.bien ?? 0) + (cuenta?.danado ?? 0) + (cuenta?.noLlego ?? 0);
  return {
    conteo: nuevo,
    tono: "bien",
    texto: `${danado ? "Dañado · " : ""}${art.nombre}: ${contado} de ${declarado}`,
  };
}

function anotarDesconocido(conteo: ConteoLote, codigo: string): ConteoLote {
  if (conteo.desconocidos.includes(codigo) || conteo.desconocidos.length >= 50) return conteo;
  return { ...conteo, desconocidos: [...conteo.desconocidos, codigo] };
}

/** Fija (no suma) las piezas contadas de un artículo; 0 lo quita. */
export function fijarPiezasConteo(
  conteo: ConteoLote,
  clave: string,
  piezas: number,
  danado = false,
): ConteoLote {
  const campo = danado ? "danadas" : "piezas";
  const mapa = { ...conteo[campo] };
  if (enteroPositivo(piezas)) mapa[clave] = piezas;
  else delete mapa[clave];
  return { ...conteo, [campo]: mapa };
}

/** Quita un paquete escaneado por error (bien o dañado). */
export function quitarPaqueteConteo(conteo: ConteoLote, llave: string): ConteoLote {
  const paquetes = { ...conteo.paquetes };
  const paquetesDanados = { ...conteo.paquetesDanados };
  delete paquetes[llave];
  delete paquetesDanados[llave];
  return { ...conteo, paquetes, paquetesDanados };
}

// ---------- Guardar la recepción (caja) ----------

export type PlanRecepcionLote = {
  sesion: LoteSesion;
  /** Campos a escribir por artículo (`tx.update(ref, parche)`). */
  parches: Map<string, Partial<Articulo>>;
  estado: "parcial" | "cerrado";
  /** El conteo no trae nada nuevo contra lo que ya está guardado. */
  vacia: boolean;
};

function soloPositivos(mapa: Map<string, number>): Record<string, number> | undefined {
  const o: Record<string, number> = {};
  for (const [k, n] of mapa) if (n > 0) o[k] = n;
  return Object.keys(o).length > 0 ? o : undefined;
}

/**
 * Planea guardar un conteo como sesión de recepción. Se calcula contra el
 * lote LEÍDO EN LA TRANSACCIÓN, así que dos tablets o un reintento no suman
 * dos veces: cada artículo entra al inventario hasta lo que tenga pendiente
 * y lo demás queda como sobrante. Un artículo borrado no bloquea: lo suyo
 * queda en `sinStock`.
 *
 * `ubicacion` es la sucursal destino con su default ya resuelto.
 */
export function planearRecepcionLote(args: {
  lote: LoteConSesiones & Pick<Resurtido, "estado">;
  conteo: ConteoLote;
  articulos: ReadonlyMap<string, Articulo>;
  ubicacion: UbicacionResuelta;
  meta: { fecha: string; quien: string; nodoId?: string; vendedor?: string; nota?: string };
}): PlanRecepcionLote {
  const { lote, conteo, articulos, ubicacion, meta } = args;
  if (lote.estado === "cerrado") throw new Error("Este lote ya está cerrado");
  if (!loteAbierto(lote)) throw new Error("Este lote todavía no se ha enviado");
  if (!meta.quien.trim()) throw new Error("Falta el nombre de quien recibe");

  const previo = resumenLote(lote);
  const horas: Record<string, string> = {};
  const nuevos = (mapa: Record<string, string>, otros?: Record<string, string>) =>
    Object.keys(mapa).filter(
      (llave) =>
        !!lote.paquetes?.[llave] &&
        previo.paquetes.get(llave)?.estado === "pendiente" &&
        !otros?.[llave],
    );
  const paquetes = nuevos(conteo.paquetes);
  const paquetesDanados = nuevos(conteo.paquetesDanados, conteo.paquetes);
  const cajas = Object.keys(conteo.cajas).filter(
    (llave) => !!lote.cajas?.[llave] && !previo.cajasLlegadas.has(llave),
  );
  for (const llave of paquetes) horas[llave] = conteo.paquetes[llave]!;
  for (const llave of paquetesDanados) horas[llave] = conteo.paquetesDanados[llave]!;
  for (const llave of cajas) horas[llave] = conteo.cajas[llave]!;

  // Lo contado en esta sesión, por artículo.
  const bien = new Map<string, number>();
  const dan = new Map<string, number>();
  for (const llave of paquetes) {
    for (const [clave, n] of contenidoDePaquete(lote.paquetes![llave]!)) sumar(bien, clave, n);
  }
  for (const llave of paquetesDanados) {
    for (const [clave, n] of contenidoDePaquete(lote.paquetes![llave]!)) sumar(dan, clave, n);
  }
  const piezas = new Map<string, number>();
  const danadas = new Map<string, number>();
  for (const [clave, n] of Object.entries(conteo.piezas)) {
    if (enteroPositivo(n)) {
      piezas.set(clave, n);
      sumar(bien, clave, n);
    }
  }
  for (const [clave, n] of Object.entries(conteo.danadas)) {
    if (enteroPositivo(n)) {
      danadas.set(clave, n);
      sumar(dan, clave, n);
    }
  }

  // Cuánto entra al inventario: lo bueno, hasta lo pendiente.
  const entro = new Map<string, number>();
  const sobrantes = new Map<string, number>();
  const sinStock: NonNullable<LoteSesion["sinStock"]> = [];
  const trabajo = new Map<string, Articulo>();
  const parches = new Map<string, Partial<Articulo>>();
  for (const clave of new Set([...bien.keys(), ...dan.keys()])) {
    const pendiente = previo.porArticulo.get(clave)?.pendiente ?? 0;
    const b = bien.get(clave) ?? 0;
    const d = dan.get(clave) ?? 0;
    const entra = Math.min(b, pendiente);
    const danAplicado = Math.min(d, pendiente - entra);
    sumar(sobrantes, clave, b - entra + (d - danAplicado));
    if (entra === 0) continue;
    const { articuloId, subvariacionCodigo } = partirClaveArticulo(clave);
    const art = trabajo.get(articuloId) ?? articulos.get(articuloId);
    if (!art) {
      sinStock.push({ clave, piezas: entra, motivo: "El artículo ya no existe" });
      continue;
    }
    try {
      const plan = planearMovimientoStock(art, ubicacion, entra, { subvariacionCodigo });
      trabajo.set(articuloId, { ...art, ...plan.patch });
      parches.set(articuloId, { ...(parches.get(articuloId) ?? {}), ...plan.patch });
      entro.set(clave, entra);
    } catch (e) {
      sinStock.push({
        clave,
        piezas: entra,
        motivo: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const piezasO = soloPositivos(piezas);
  const danadasO = soloPositivos(danadas);
  const entroO = soloPositivos(entro);
  const sobrantesO = soloPositivos(sobrantes);
  const desconocidos = conteo.desconocidos.slice(0, 50);
  const nota = meta.nota?.trim();
  const sesion: LoteSesion = {
    tipo: "recepcion",
    fecha: meta.fecha,
    quien: meta.quien.trim(),
    ...(meta.nodoId ? { nodoId: meta.nodoId } : {}),
    ...(meta.vendedor ? { vendedor: meta.vendedor } : {}),
    ...(cajas.length > 0 ? { cajas } : {}),
    ...(paquetes.length > 0 ? { paquetes } : {}),
    ...(paquetesDanados.length > 0 ? { paquetesDanados } : {}),
    ...(piezasO ? { piezas: piezasO } : {}),
    ...(danadasO ? { danadas: danadasO } : {}),
    ...(entroO ? { entro: entroO } : {}),
    ...(sobrantesO ? { sobrantes: sobrantesO } : {}),
    ...(desconocidos.length > 0 ? { desconocidos } : {}),
    ...(sinStock.length > 0 ? { sinStock } : {}),
    ...(Object.keys(horas).length > 0 ? { horas } : {}),
    ...(nota ? { nota } : {}),
  };
  const vacia =
    cajas.length === 0 &&
    paquetes.length === 0 &&
    paquetesDanados.length === 0 &&
    !piezasO &&
    !danadasO &&
    desconocidos.length === 0;
  const despues = resumenLote({
    ...lote,
    recepcion: { sesiones: { ...(lote.recepcion?.sesiones ?? {}), "~nueva": sesion } },
  });
  return {
    sesion,
    parches,
    estado: despues.totales.pendiente === 0 ? "cerrado" : "parcial",
    vacia,
  };
}

// ---------- "No llegó" (admin) ----------

/** Declara como no llegado TODO lo que sigue pendiente y cierra el lote. */
export function planearNoLlegoLote(
  lote: LoteConSesiones & Pick<Resurtido, "estado">,
  meta: { fecha: string; quien: string; nota?: string },
): { sesion: LoteSesion; estado: "cerrado" } {
  if (!loteAbierto(lote)) throw new Error("Solo se puede en un lote enviado y sin cerrar");
  if (!meta.quien.trim()) throw new Error("Falta quién lo declara");
  const noLlego: Record<string, number> = {};
  for (const [clave, c] of resumenLote(lote).porArticulo) {
    if (c.pendiente > 0) noLlego[clave] = c.pendiente;
  }
  if (Object.keys(noLlego).length === 0) throw new Error("No hay nada pendiente en este lote");
  const nota = meta.nota?.trim();
  return {
    sesion: {
      tipo: "no_llego",
      fecha: meta.fecha,
      quien: meta.quien.trim(),
      noLlego,
      ...(nota ? { nota } : {}),
    },
    estado: "cerrado",
  };
}

// ---------- Aviso ----------

function sumaDe(mapa: Record<string, number> | undefined): number {
  let t = 0;
  for (const n of Object.values(mapa ?? {})) t += n;
  return t;
}

/** Mensaje para el chat de admin al guardar una recepción. `despues` es el
 *  resumen del lote ya con esa sesión. */
export function textoAvisoRecepcion(
  lote: LoteForma & Pick<Resurtido, "folio" | "sucursalDestinoNombre">,
  sesion: LoteSesion,
  despues: ResumenLote,
): string {
  const partes = [
    `📦 Lote ${lote.folio ?? ""} en ${lote.sucursalDestinoNombre}. Recibió: ${sesion.quien}.`,
    `Paquetes: ${despues.paquetesRecibidos + despues.paquetesDanados} de ${despues.paquetesTotal}.`,
    `Entraron ${sumaDe(sesion.entro)} pzas.`,
  ];
  let danadas = sumaDe(sesion.danadas);
  for (const llave of sesion.paquetesDanados ?? []) {
    const p = lote.paquetes?.[llave];
    if (p) for (const n of contenidoDePaquete(p).values()) danadas += n;
  }
  if (danadas > 0) partes.push(`Dañadas: ${danadas}.`);
  if (sumaDe(sesion.sobrantes) > 0) partes.push(`Sobrantes: ${sumaDe(sesion.sobrantes)}.`);
  if (sesion.sinStock?.length) partes.push("Hay piezas que no entraron al inventario.");
  partes.push(
    despues.totales.pendiente > 0
      ? `Faltan ${despues.totales.pendiente} pzas.`
      : "Lote completo.",
  );
  return partes.join(" ");
}

// ============================================================
// Artículos y sucursales para el teléfono (enlace de armar)
// ============================================================
//
// La regla del enlace SOLO deja listar los artículos con el filtro exacto
// `fabricado == true` y leer otro por su código (`get`) si tiene piezas en
// el taller (lo único que se puede enviar). Nunca el catálogo entero. Todo se
// guarda en memoria mientras dure la sesión para no repetir lecturas.

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import {
  COL_ARTICULOS,
  COL_SUCURSALES,
  articuloVisibleEnSucursal,
  coincidePalabras,
  esCodigoEtiquetaLote,
  normalizarTexto,
  palabrasDeConsulta,
  parseVariacionCodigo,
  paths,
  type Articulo,
  type ArticuloSubvariacion,
  type Sucursal,
} from "@shared";
import { ErrorEnlace, esPermisoDenegado, type SesionEnlace } from "@/firebase/enlaceApp";

type Cache = {
  fabricados: Promise<Articulo[]> | null;
  /** Todos los artículos vistos (fabricados y leídos por código), por id. */
  porId: Map<string, Articulo>;
  /** Ids que se buscaron y no existen. */
  noExisten: Set<string>;
  /** Ids que existen pero no se pueden enviar desde el taller. */
  noPermitidos: Set<string>;
  sucursales: Promise<Sucursal[]> | null;
};

const caches = new Map<string, Cache>();

function cache(s: SesionEnlace): Cache {
  let c = caches.get(s.enlaceId);
  if (!c) {
    c = {
      fabricados: null,
      porId: new Map(),
      noExisten: new Set(),
      noPermitidos: new Set(),
      sucursales: null,
    };
    caches.set(s.enlaceId, c);
  }
  return c;
}

const NO_SE_ENVIA =
  "Ese artículo no se puede mandar en un lote: no es de fabricación y no tiene piezas en el taller.";

/**
 * Tras un "sin permiso" al leer un artículo: ¿el acceso sigue sirviendo? Se
 * pregunta por un código de lote que no puede existir (la regla lo deja si
 * el acceso está prendido). Si sirve, el problema es ESE artículo. La página
 * de etiquetas de precio no lee lotes: pregunta por una impresora que no
 * puede existir.
 */
export async function accesoSigueVivo(s: SesionEnlace): Promise<boolean> {
  try {
    await getDocFromServer(
      s.tipo === "precio"
        ? doc(s.db, paths.impresora(s.negocioId, "_no_existe_"))
        : doc(s.db, paths.resurtido(s.negocioId, `L000000-${s.letra ?? "A"}0`)),
    );
    return true;
  } catch {
    return false;
  }
}

const colArticulos = (s: SesionEnlace) =>
  collection(s.db, `${paths.negocio(s.negocioId)}/${COL_ARTICULOS}`);

/** Los artículos de fabricación (lo que normalmente se arma en el taller),
 *  por nombre. Se leen una vez por sesión. */
export function articulosFabricados(s: SesionEnlace): Promise<Articulo[]> {
  const c = cache(s);
  if (!c.fabricados) {
    c.fabricados = getDocsFromServer(query(colArticulos(s), where("fabricado", "==", true)))
      .then((snap) => {
        const arts = snap.docs.map((d) => ({ ...(d.data() as Articulo), id: d.id }));
        for (const a of arts) c.porId.set(a.id, a);
        arts.sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
        return arts;
      })
      .catch((e) => {
        // Que el siguiente intento vuelva a leer (sin red, acceso apagado…).
        c.fabricados = null;
        throw e;
      });
  }
  return c.fabricados;
}

/** Un artículo ya visto en esta sesión (para poner nombres). */
export function articuloEnMemoria(s: SesionEnlace, id: string): Articulo | undefined {
  return cache(s).porId.get(id);
}

/** Un artículo por su id (de memoria o del servidor). `null` si no existe. */
export async function leerArticulo(s: SesionEnlace, id: string): Promise<Articulo | null> {
  const c = cache(s);
  const ya = c.porId.get(id);
  if (ya) return ya;
  if (c.noExisten.has(id)) return null;
  if (c.noPermitidos.has(id)) throw new ErrorEnlace(NO_SE_ENVIA);
  // Un id de documento no puede traer "/" ni ser cualquier cosa: lo que no
  // parece código ni se pregunta.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  let snap;
  try {
    snap = await getDocFromServer(doc(s.db, paths.articulo(s.negocioId, id)));
  } catch (e) {
    if (esPermisoDenegado(e) && (await accesoSigueVivo(s))) {
      c.noPermitidos.add(id);
      throw new ErrorEnlace(NO_SE_ENVIA);
    }
    throw e;
  }
  if (!snap.exists()) {
    c.noExisten.add(id);
    return null;
  }
  const a = { ...(snap.data() as Articulo), id: snap.id };
  c.porId.set(a.id, a);
  return a;
}

export type ArticuloElegido = {
  articulo: Articulo;
  /** La variación, si el código era de una. */
  variacion?: ArticuloSubvariacion;
};

export function tieneVariaciones(a: Pick<Articulo, "subvariaciones">): boolean {
  return (a.subvariaciones ?? []).some((v) => !!v.codigo);
}

/**
 * Lo que dice la etiqueta de un artículo: su id (`12300101`) o el código de
 * una variación (`v-102-AAA`). `null` si no es de ningún artículo. Un
 * artículo con variaciones se devuelve sin `variacion`: hay que elegirla.
 */
export async function leerArticuloPorCodigo(
  s: SesionEnlace,
  codigoCrudo: string,
): Promise<ArticuloElegido | null> {
  const codigo = codigoCrudo.trim();
  if (!codigo) return null;
  if (esCodigoEtiquetaLote(codigo)) {
    throw new ErrorEnlace("Esa es una etiqueta de caja o paquete. Escanea la etiqueta del artículo.");
  }
  if (codigo.startsWith("v-")) {
    const partes = parseVariacionCodigo(codigo);
    if (!partes) return null;
    const padre = await leerArticulo(s, partes.idPadre);
    const variacion = padre?.subvariaciones?.find((v) => v.codigo === codigo);
    return padre && variacion ? { articulo: padre, variacion } : null;
  }
  const art = await leerArticulo(s, codigo);
  return art ? { articulo: art } : null;
}

/** Busca entre los fabricados por nombre, sigla o código. */
export function buscarEnFabricados(arts: readonly Articulo[], consulta: string): Articulo[] {
  const palabras = palabrasDeConsulta(consulta);
  if (palabras.length === 0) return [...arts];
  return arts.filter((a) =>
    coincidePalabras(normalizarTexto(`${a.nombre ?? ""} ${a.sigla ?? ""} ${a.id}`), palabras),
  );
}

/** Nombre para la pantalla: `Playera Luffy — CH` o el id si no se conoce. */
export function nombreArticulo(
  s: SesionEnlace,
  articuloId: string,
  subvariacionCodigo?: string,
): string {
  const a = cache(s).porId.get(articuloId);
  if (!a) return subvariacionCodigo ?? articuloId;
  if (!subvariacionCodigo) return a.nombre || articuloId;
  const v = a.subvariaciones?.find((x) => x.codigo === subvariacionCodigo);
  return v ? `${a.nombre} — ${v.nombre}` : `${a.nombre} — ${subvariacionCodigo}`;
}

/** Trae a memoria los artículos de estos ids (para poner sus nombres). Los
 *  que fallen se quedan con su código. */
export async function cargarNombres(s: SesionEnlace, ids: Iterable<string>): Promise<void> {
  await articulosFabricados(s).catch(() => undefined);
  const faltan = [...new Set(ids)].filter((id) => !cache(s).porId.has(id));
  await Promise.all(faltan.map((id) => leerArticulo(s, id).catch(() => null)));
}

// ---------- Sucursales ----------

/** Sucursales destino (lectura pública), activas y por nombre. */
export function sucursalesDestino(s: SesionEnlace): Promise<Sucursal[]> {
  const c = cache(s);
  if (!c.sucursales) {
    c.sucursales = getDocsFromServer(
      collection(s.db, `${paths.negocio(s.negocioId)}/${COL_SUCURSALES}`),
    )
      .then((snap) =>
        snap.docs
          .map((d) => {
            const x = d.data() as Sucursal;
            return { ...x, sucursalId: x.sucursalId || d.id, nombre: x.nombre || d.id };
          })
          .filter((x) => x.activa !== false)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      )
      .catch((e) => {
        c.sucursales = null;
        throw e;
      });
  }
  return c.sucursales;
}

/** Aviso (no bloquea) si el artículo no se vende en la sucursal destino. */
export function avisoDestino(
  art: Pick<Articulo, "soloMayoreo" | "nombre"> | undefined,
  destino: Pick<Sucursal, "nombre" | "modoMayoreo"> | undefined,
): string | null {
  if (!art || !destino) return null;
  if (articuloVisibleEnSucursal(art, destino.modoMayoreo)) return null;
  return art.soloMayoreo
    ? `Ojo: ${art.nombre} es solo de mayoreo y ${destino.nombre} no es de mayoreo: ahí no se vende.`
    : `Ojo: ${destino.nombre} es de mayoreo y ${art.nombre} no es de mayoreo: ahí no se vende.`;
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { resolverPrecioEfectivo, type Articulo, type VentaArticulo } from "@shared";

/**
 * Item del carrito. Replica el shape del Android nodo_1, soportando:
 * - id "00000000" + flag no_registrado para items manuales.
 * - aply_3x2 para promo (cuando el artículo tiene flag "3x2").
 * - talla, seña.
 */
type CarritoItem = VentaArticulo & {
  /** identificador único en el carrito (permite duplicados con talla, subvariación distinta) */
  key: string;
  /** Si el artículo tiene flag "3x2" en catálogo, este permite activar la promo. */
  flag3x2?: boolean;
  /** Cuando 3x2 activo, almacena cuántas veces aplica (cantidad/3 entera). */
  aply_3x2?: string;
  /** true si el item es manual (no del catálogo). id="00000000". */
  no_registrado?: boolean;
  /** URL de imagen mostrada en el carrito. NO se persiste en la Venta — es
   *  cosmética del POS. PagoFooter la strip-ea antes de enviar a crearVenta. */
  imagenUrl?: string;
  /** Si está en `true`, el item se mantiene visible pero NO suma al total
   *  ni se incluye al cobrar. Sirve como "pausa" mientras el cajero
   *  confirma con el cliente. Mientras haya algún desmarcado, COBRAR
   *  queda bloqueado. */
  desmarcado?: boolean;
};

/** Opciones al agregar un artículo al carrito (Fase 5: incluye subvariación). */
type AgregarOpts = {
  talla?: string;
  cantidad?: number;
  subvariacionCodigo?: string;
  subvariacionNombre?: string;
  /** Override de imagenUrl (cuando hay subvariación con imagen propia, ésta
   *  gana sobre la del padre). Si se omite, se usa `articulo.imagenUrl`. */
  imagenUrl?: string;
  /** Descripción libre capturada por el modal cuando el artículo tiene
   *  flag `seña` (replica del popVariacion_venta del nodo_1 Android).
   *  Cada reservación con seña genera su propia línea — nunca se fusiona
   *  con un item existente. */
  seña?: string;
  /** True cuando el item entró por "Otro" en VariacionPickerModal — sale
   *  como variación libre (no documentada en catálogo). El texto que
   *  escribió el cajero va en `subvariacionNombre` (puede ser vacío); no
   *  hay `subvariacionCodigo`. Cada item Otro es único — no se fusiona
   *  con otro item del mismo padre aunque coincidan el nombre. */
  variacionLibre?: boolean;
};

type CarritoState = {
  items: CarritoItem[];
  enTurno: string | null;
  vendedorIdUsuario: string | null;

  setVendedor: (nombre: string, idUsuario?: string) => void;
  agregar: (articulo: Articulo, opts?: AgregarOpts) => void;
  agregarManual: (input: { nombre: string; precio: string; cantidad?: number }) => void;
  incrementar: (key: string) => void;
  decrementar: (key: string) => void;
  quitar: (key: string) => void;
  limpiar: () => void;
  setDescuento: (key: string, descuento: string) => void;
  toggleAply3x2: (key: string) => void;
  toggleDesmarcado: (key: string) => void;
};

function itemKey(artId: string, talla?: string, subvariacionCodigo?: string) {
  // El codigo de subvariación es lo más específico — si está, va al final
  // del key para que dos variaciones del mismo padre no se fusionen.
  let k = artId;
  if (talla) k += `__${talla}`;
  if (subvariacionCodigo) k += `__${subvariacionCodigo}`;
  return k;
}

/** Calcula aply_3x2 según cantidad — replica adapRegVenta de Android. */
function compute3x2(cantidad: number): string {
  return String(Math.floor(cantidad / 3));
}

export const useCarrito = create<CarritoState>()(
  persist(
    (set) => ({
      items: [],
      enTurno: null,
      vendedorIdUsuario: null,

      setVendedor: (nombre, idUsuario) =>
        set({
          enTurno: nombre || null,
          vendedorIdUsuario: idUsuario ?? null,
        }),

  agregar: (art, opts) =>
    set((st) => {
      const talla = opts?.talla;
      const subvariacionCodigo = opts?.subvariacionCodigo;
      const subvariacionNombre = opts?.subvariacionNombre;
      const seña = opts?.seña;
      const variacionLibre = opts?.variacionLibre;
      // Cuando hay seña o variación libre ("Otro"), cada item es único —
      // generamos un sufijo aleatorio en el key para que NUNCA se fusione
      // con otra, aunque el cajero capture el mismo texto dos veces.
      const unico = !!seña || !!variacionLibre;
      const key = unico
        ? `${itemKey(art.id, talla, subvariacionCodigo)}__u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        : itemKey(art.id, talla, subvariacionCodigo);
      const cantidadAdd = opts?.cantidad ?? 1;
      const existente = unico
        ? undefined
        : st.items.find((i) => i.key === key);
      const tiene3x2 = art["3x2"] !== undefined;
      if (existente) {
        const nuevaCant = Number(existente.cantidad) + cantidadAdd;
        const update: Partial<CarritoItem> = { cantidad: String(nuevaCant) };
        // Si la promo ya estaba activa, recalcular
        if (existente.aply_3x2) update.aply_3x2 = compute3x2(nuevaCant);
        return {
          items: st.items.map((i) =>
            i.key === key ? { ...i, ...update } : i,
          ),
        };
      }
      // El nombre público mostrado en carrito incluye la subvariación cuando
      // aplica, p.ej. "Camisa — Rojo".
      const nombrePublico = subvariacionNombre
        ? `${art.nombre} — ${subvariacionNombre}`
        : art.nombre;
      // imagenUrl: override de opts (variación con imagen propia) > padre.
      const imagenUrl = opts?.imagenUrl ?? art.imagenUrl;
      // Snapshot del precio con descuento al momento de agregar. El cajero
      // puede sobrescribirlo después con setDescuento; cambios posteriores
      // del descuento en el catálogo NO retrocompactan este item.
      const subDoc = subvariacionCodigo
        ? art.subvariaciones?.find((s) => s.codigo === subvariacionCodigo)
        : null;
      const { descuento: descuentoSnapshot } = resolverPrecioEfectivo(
        art,
        subDoc,
      );
      const nuevo: CarritoItem = {
        key,
        id: art.id,
        cantidad: String(cantidadAdd),
        precio: art.precioVenta, // siempre del padre (decisión #1 del spec)
        nombrePublico,
        descripcion: art.sigla || "",
        flag3x2: tiene3x2,
        ...(talla ? { talla } : {}),
        ...(subvariacionCodigo ? { subvariacionCodigo } : {}),
        ...(subvariacionNombre ? { subvariacionNombre } : {}),
        ...(imagenUrl ? { imagenUrl } : {}),
        ...(seña ? { seña } : {}),
        ...(variacionLibre ? { variacionLibre: true } : {}),
        ...(descuentoSnapshot ? { descuento: descuentoSnapshot } : {}),
      };
      return { items: [...st.items, nuevo] };
    }),

  agregarManual: ({ nombre, precio, cantidad = 1 }) =>
    set((st) => {
      // Items no registrados llevan id "00000000" — replica Android.
      // Cada manual es único (key con timestamp para no fusionarlos).
      const key = `noreg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nuevo: CarritoItem = {
        key,
        id: "00000000",
        cantidad: String(cantidad),
        precio,
        nombrePublico: nombre,
        descripcion: "",
        no_registrado: true,
      };
      return { items: [...st.items, nuevo] };
    }),

  incrementar: (key) =>
    set((st) => ({
      items: st.items.map((i) => {
        if (i.key !== key) return i;
        const nuevaCant = Number(i.cantidad) + 1;
        const update: Partial<CarritoItem> = { cantidad: String(nuevaCant) };
        if (i.aply_3x2) update.aply_3x2 = compute3x2(nuevaCant);
        return { ...i, ...update };
      }),
    })),

  decrementar: (key) =>
    set((st) => {
      const items = st.items
        .map((i) => {
          if (i.key !== key) return i;
          const nuevaCant = Math.max(0, Number(i.cantidad) - 1);
          const update: Partial<CarritoItem> = { cantidad: String(nuevaCant) };
          if (i.aply_3x2) {
            // Si baja de 3, quitar promo
            if (nuevaCant < 3) {
              return { ...i, cantidad: String(nuevaCant), aply_3x2: undefined };
            }
            update.aply_3x2 = compute3x2(nuevaCant);
          }
          return { ...i, ...update };
        })
        .filter((i) => Number(i.cantidad) > 0);
      return { items };
    }),

  quitar: (key) =>
    set((st) => ({ items: st.items.filter((i) => i.key !== key) })),

  limpiar: () => set({ items: [] }),

  setDescuento: (key, descuento) =>
    set((st) => ({
      items: st.items.map((i) => (i.key === key ? { ...i, descuento } : i)),
    })),

  toggleAply3x2: (key) =>
    set((st) => ({
      items: st.items.map((i) => {
        if (i.key !== key || !i.flag3x2) return i;
        if (i.aply_3x2) {
          // Desactivar
          const { aply_3x2: _ignored, ...rest } = i;
          return rest;
        }
        // Activar — primero asegurar al menos 3
        const cant = Number(i.cantidad);
        const nuevaCant = cant < 3 ? 3 : cant;
        return {
          ...i,
          cantidad: String(nuevaCant),
          aply_3x2: compute3x2(nuevaCant),
        };
      }),
    })),

      toggleDesmarcado: (key) =>
        set((st) => ({
          items: st.items.map((i) =>
            i.key === key ? { ...i, desmarcado: !i.desmarcado } : i,
          ),
        })),
    }),
    {
      // Persiste sólo el vendedor en turno (sin items ni demás estado del
      // carrito) en localStorage. Sobrevive recargas hasta que el cajero
      // elija otro vendedor desde SelectorVendedor.
      name: "amise_nodo_carrito_session",
      version: 1,
      partialize: (s) => ({
        enTurno: s.enTurno,
        vendedorIdUsuario: s.vendedorIdUsuario,
      }),
    },
  ),
);

/** Calcula el subtotal de un item respetando 3x2 y descuento. */
export function subtotalItem(it: CarritoItem | VentaArticulo): number {
  const cant = Number((it as CarritoItem).cantidad) || 0;
  const aply3x2 = Number((it as CarritoItem).aply_3x2) || 0;
  // Precio efectivo: descuento > precio
  const precio = Number((it as CarritoItem).descuento) ||
    Number((it as CarritoItem).precio) || 0;
  // 3x2: por cada 3, se cobran 2 → restar aply3x2 unidades.
  return (cant - aply3x2) * precio;
}

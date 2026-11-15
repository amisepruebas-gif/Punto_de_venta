import { create } from "zustand";
import type { FiltrosClasificacion, GrupoFiltro } from "@shared";

/**
 * Filtros del panel "Filtros" de la caja. En memoria (sin guardar): se
 * quedan puestos mientras la caja está abierta, para ir agregando artículos
 * del mismo segmento, y se pierden al recargar. Solo los usa el panel; el
 * buscador normal nunca filtra con ellos.
 */
type FiltrosCaja = {
  filtros: FiltrosClasificacion;
  texto: string;
  /** Pone (o quita con `undefined`) un filtro. Cambiar la categoría quita
   *  la subcategoría, que depende de ella. */
  poner: (grupo: GrupoFiltro, valor: string | undefined) => void;
  setTexto: (texto: string) => void;
  limpiar: () => void;
};

export const useFiltrosCaja = create<FiltrosCaja>((set) => ({
  filtros: {},
  texto: "",
  poner: (grupo, valor) =>
    set((s) => {
      const filtros: FiltrosClasificacion = { ...s.filtros };
      if (valor) filtros[grupo] = valor;
      else delete filtros[grupo];
      if (grupo === "categoriaId") delete filtros.subcategoriaId;
      return { filtros };
    }),
  setTexto: (texto) => set({ texto }),
  limpiar: () => set({ filtros: {}, texto: "" }),
}));

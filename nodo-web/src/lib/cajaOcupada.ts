/**
 * Momentos en que la caja no debe recargarse: un cobro en curso (entre el
 * débito del cashback y crear la venta) o la pregunta de "¿sumar cashback?"
 * tras cobrar. La recarga forzada remota (useRefrescoRender) espera a que se
 * libere: recargar a media venta podía dejar un débito sin venta.
 */
const motivos = new Set<string>();

export function marcarCajaOcupada(motivo: string, ocupada: boolean): void {
  if (ocupada) motivos.add(motivo);
  else motivos.delete(motivo);
}

export function cajaOcupada(): boolean {
  return motivos.size > 0;
}

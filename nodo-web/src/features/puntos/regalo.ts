/**
 * Tarjetas de regalo en la caja: APAGADAS desde el 2-nov-2026.
 *
 * amise.mx todavía no publica `/api/loyalty/gift/*`: vender o recargar una
 * tarjeta cobraría sin dejarle saldo. Además el dueño eligió otro modelo
 * (tarjeta al portador, aparte del cashback, solo en tienda), que se está
 * construyendo. Mientras esté en `false`, la caja oculta "Vender tarjeta de
 * regalo", "Recargar tarjeta de regalo" y el botón "Crédito de regalo" al
 * cobrar. Se vuelve a `true` cuando el modelo nuevo esté publicado.
 */
export const REGALO_HABILITADO = false;

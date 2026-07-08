# Fase 5 — activación del candado de canje en el POS

> ⚠️ **CÓDIGO DE DINERO SIN PROBAR EN CAJA.** Escrito con typecheck + auditoría, pero **NO se ha ejercitado en una caja real ni con cortes de red**. **NO desplegar a las cajas hasta probarlo** (idealmente después de confirmar que los fixes 1-3 ya desplegados funcionan). El candado del servidor (amise) ya está desplegado pero **inerte** hasta que el POS mande `pendingLock`.

## Qué activa
El servidor ya tiene el candado (índice `canjesPendientes`, escrito atómico con el débito). Esta parte hace que el POS lo **encienda** y lo use bien:

1. **Write-ahead del `cobroId`** — antes de debitar, el POS persiste el id del cobro en `clientePuntosStore` (localStorage). En un **reload/reintento** reusa **ese mismo** id → el servidor lo reconoce (idempotente) y **no vuelve a debitar** = no doble cobro.
2. **`pendingLock: true`** — se manda en el canje para activar el candado del servidor.
3. **Conflicto (409 `canje-en-curso`)** — si el servidor rechaza (ya hay OTRO cobro en curso que este POS no inició), el POS **aborta con mensaje claro** (no adopta a ciegas, no crea venta con descuento sin débito).
4. **`/cerrar` tras la venta** — libera el pendiente en el servidor (evita bloquear el próximo cobro del cliente). Best-effort + **encolado** para reintento durable.

## Reglas de seguridad
- El write-ahead solo se reusa si el **teléfono coincide** y es **reciente (< 15 min, = TTL del servidor)**; si es viejo se ignora (el pendiente del servidor también expiró).
- Al reusar, el **monto debe coincidir** con el del cobro en curso; si no, aborta (evita debitar un monto distinto bajo la misma clave).
- La **venta** usa el **mismo `cobroId`** que el débito (linkeados).
- El canje web (amise) no manda `pendingLock` → sin cambios.

## Archivos
| Archivo | Cambio |
|---|---|
| `functions/index.js` | `canjearPuntos` pasa `pendingLock`; nueva CF `cerrarCanje` (proxy a `/api/loyalty/canje/cerrar`) |
| `nodo-web/src/firebase/callable.ts` | `CanjearPuntosInput += pendingLock`; `fnCerrarCanje` |
| `nodo-web/src/features/puntos/clientePuntosStore.ts` | `canjeEnCurso` (write-ahead persistido) + tipo de cola `"cerrar"` |
| `nodo-web/src/features/puntos/usePuntosColaFlush.ts` | procesar `"cerrar"` en el flush |
| `nodo-web/src/routes/Ventas.tsx` | write-ahead + `pendingLock` + abortar en conflicto + venta con el mismo `cobroId` + `cerrar` |

## Auditoría adversarial (4 revisores + verificación)
- **Contrato/despliegue: LIMPIO** — `pendingLock`, el candado del servidor y el canje web están seguros; el orden de despliegue no rompe nada.
- **5 hallazgos confirmados**, todos de una misma raíz: el **débito huérfano** (débito confirmado pero la venta nunca se crea → el cliente puede perder su cashback, o post-TTL re-debitarse).

### Fixes aplicados (4)
1. **Mensaje** — el catch ya NO sugiere "quítalo" (perdía el cashback ya debitado); ahora dice *"posible débito ya aplicado, NO lo quites, reintenta el MISMO cobro"*.
2. **Handoff de TTL** — la ventana de reuso del write-ahead pasa a **24 h** (>> 15 min del servidor); antes ambos se rendían a la vez y el huérfano se re-debitaba.
3. **Índice por teléfono** — `canjesEnCurso` es un mapa `{telefono → cobro}`; atender a otro cliente ya NO pisa el write-ahead del primero.
4. **Drenar `cerrar`** — antes de un canje nuevo, se cierra cualquier candado encolado de ese cliente (evita el 409 que bloqueaba su siguiente cobro).

## Hueco que QUEDA (deferido, decisión de diseño)
Si la **respuesta del canje se pierde justo tras confirmarse el débito** y el cliente **no vuelve con el mismo monto**, el débito queda **huérfano** (cliente pierde cashback) sin reconciliación automática. Cerrarlo del todo es difícil: **amise no sabe si el POS creó la venta**, así que ni un barrido automático ni readoptar el pendiente son 100% seguros. Opciones para v2 (a decidir): (a) el POS consulta `/api/loyalty/canje/pendiente` al reconectar y readopta/reporta; (b) una herramienta de reconciliación manual en admin; (c) un protocolo donde el POS confirme la venta a amise. **Mitigación actual:** el reuso por teléfono+monto (24 h) auto-sana el caso "el cliente vuelve con el mismo monto".

## Cómo probar en la caja (antes de desplegar)
1. Cobro normal con cashback → debita 1 vez, crea venta, saldo baja bien.
2. Cortar red justo después de "cobrar" y recargar la app → re-cobrar al mismo cliente NO debe volver a debitar (mismo saldo).
3. Segundo cobro legítimo del mismo cliente tras completar el primero → debita normal.

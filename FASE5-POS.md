# Fase 5 — activación del candado de canje en el POS (versión mínima-segura)

> ⚠️ **CÓDIGO DE DINERO SIN PROBAR EN CAJA.** Escrito + typecheck + auditado 2×, pero **NO ejercitado en una caja real ni con cortes de red**. **NO desplegar hasta probarlo.** El candado del servidor (amise) está desplegado pero **inerte** hasta que el POS mande `pendingLock`.

## Qué hace (mínima-segura)
El servidor ya tiene el candado (índice `canjesPendientes/{wallet}`, escrito atómico con el débito). Esta parte lo **enciende** de forma simple y segura:

1. **`pendingLock: true`** en el canje → activa el candado del servidor.
2. **Conflicto (409 `canje-en-curso`)** → si el servidor detecta otro canje en curso del mismo cliente (evita el **doble débito**), el POS **aborta con mensaje claro** — NO crea venta con descuento sin débito.
3. **`/cerrar`** tras crear la venta → libera el pendiente (best-effort + **encolado** durable).
4. **Drenar `cerrar`** encolado de ese cliente antes de un canje nuevo → evita que un cierre fallido bloquee su siguiente cobro.

**La venta usa la misma `idempotencyKey` que el débito.** El canje web no manda `pendingLock` → sin cambios.

## Qué NO hace (y por qué)
- **No reusa el cobro entre recargas** (no hay "write-ahead"). Se probó y la auditoría demostró que reusar sin verificar si la venta ya existe **abre un hueco de dinero** (doble-descuento) y **bloqueos de 24 h**. Por eso se quitó.
- **Residual conocido:** si el débito se confirma pero la respuesta se pierde y la venta no se crea (crash/timeout en una ventana estrecha), queda un **débito huérfano** (el cliente pierde ese cashback), **detectable** (el pendiente queda en el servidor) pero sin reconciliación automática. Es el mismo límite raíz de siempre.

## Auditorías (2 rondas adversariales)
1. **Fase 5 POS inicial:** contrato/despliegue LIMPIO; 5 hallazgos, todos del huérfano. Se intentaron 4 fixes (write-ahead reuse + TTL 24h + mapa + drenar-cerrar).
2. **De los 4 fixes:** el reuso con TTL de 24h **introdujo huecos NUEVOS** (doble-descuento si la venta ya se creó; bloqueo de 24h al cliente). Conclusión: el parcheo del reuso **no converge** → se **revirtió a mínima-segura** (sin reuso). Drenar-cerrar salió limpio y se conserva.

## Archivos
| Archivo | Cambio |
|---|---|
| `functions/index.js` | `canjearPuntos` pasa `pendingLock`; nueva CF `cerrarCanje` (proxy a `/api/loyalty/canje/cerrar`) |
| `nodo-web/src/firebase/callable.ts` | `CanjearPuntosInput += pendingLock`; `fnCerrarCanje` |
| `nodo-web/src/features/puntos/clientePuntosStore.ts` | tipo de cola `"cerrar"` (el write-ahead se quitó) |
| `nodo-web/src/features/puntos/usePuntosColaFlush.ts` | procesar `"cerrar"` en el flush |
| `nodo-web/src/routes/Ventas.tsx` | `pendingLock` + drenar-cerrar + abortar-en-conflicto + `cerrar` |

## Deferido a v2 (decisión de diseño, no urgente)
Cerrar el huérfano requiere **reconciliación**: (a) el POS consulta `/api/loyalty/canje/pendiente` al reconectar y verifica si la venta con ese `cobroId` ya existe (readopta o reporta), o (b) un job en amise que revierta pendientes vencidos sin venta. Ninguno es trivial (amise no sabe si el POS creó la venta) y no se puede probar sin una caja. Ver `docs/fix-vinculacion/FASE5-canje-huerfano-DISENO.md` en amise.

## Cómo probar en la caja (antes de desplegar)
1. Cobro normal con cashback → debita 1 vez, crea la venta, saldo baja bien.
2. Segundo cobro del mismo cliente tras completar el primero → debita normal (el `cerrar` liberó el candado).
3. Cortar red tras "cobrar" y reintentar rápido → debe salir *"Ya hay un canje en curso… espera y reintenta"* (NO doble débito).

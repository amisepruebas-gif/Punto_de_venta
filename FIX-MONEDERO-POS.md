# Plan de fixeo — Money-safety del monedero en el POS (`nodo-web`)

Origen: revisión adversarial del flujo "activar tarjeta + usar cashback en sucursal" (2026-07-06). Todos los huecos son **pre-existentes del POS** (no vienen de los cambios recientes de la API amise). El servidor ya blinda lo crítico (no hay corrupción de monedero); estos fixes cierran ventanas de money-safety en el cliente.

**Principio:** cambios mínimos, seguros, **por fases independientes**, anclados en código real (líneas verificadas 2026-07-06). Ningún fix mueve dinero automáticamente sin certeza. Repo: `C:\Users\jesus\Documents\dispositivo_1\nodo-web`. Verificación: `npm run typecheck` (`tsc --noEmit`).

Orden por valor/seguridad:

| Fase | Hueco | Severidad | ¿Se implementa ahora? |
|---|---|---|---|
| 1 | **A** · Cashback regalado sin teléfono | MEDIUM | ✅ Sí (POS-only, contenido) |
| 2 | **C** · Tarjeta cobrada-sin-vincular (sin reintento) | MEDIUM | ✅ Sí (reusa cola offline) |
| 3 | **E** · Pendiente rancio se vincula a otra venta | LOW | ✅ Sí (useEffect seguro, [items.length]) |
| 4 | **D** · Pre-chequeo "tarjeta en uso" solo ve activas | LOW | ⏸️ Diferido (necesita API/CF amise) |
| 5 | **B** · Débito de canje huérfano (crash entre débito y venta) | MEDIUM | ⏸️ Diferido (necesita decisión de reconciliación) |

---

## Fase 1 — A · Bloquear uso/acumulación de cashback SIN teléfono

**Bug:** al consultar por **barcode** un monedero con tarjeta activa pero **sin `telefono`**, `aplicarSaldoResp` (`UsarPuntosModal.tsx:90-99`) muestra un error PERO igual setea `saldo`, dejando activos "Usar cashback"/"Acumular". `aplicarUsar` emite `onAplicar({ telefono: '' , descuento })`. En `PagoFooter` el **descuento se aplica al total** (`total = subtotalBruto − descuentoPuntos`), pero en `Ventas.tsx:302` el **débito** está condicionado a `if (puntosTel && …)`; con `puntosTel=''` **no se debita** → descuento gratis y **repetible** (el saldo nunca baja).

**Fix (defensa en 2 capas):**

### A.1 — `UsarPuntosModal.tsx` · `aplicarUsar` (líneas 152-160)
ANTES:
```ts
  function aplicarUsar() {
    if (!saldo) return;
    if (pedido <= 0) {
      setError("Indica cuánto usar (mayor a 0).");
      return;
    }
    onAplicar({ telefono: telefono.trim(), descuento: pedido });
    reset();
  }
```
DESPUÉS (agregar guarda de teléfono):
```ts
  function aplicarUsar() {
    if (!saldo) return;
    if (!telefono.trim()) {
      setError("Sin teléfono no se puede debitar el cashback. Consulta por teléfono o correo.");
      return;
    }
    if (pedido <= 0) {
      setError("Indica cuánto usar (mayor a 0).");
      return;
    }
    onAplicar({ telefono: telefono.trim(), descuento: pedido });
    reset();
  }
```

### A.2 — `UsarPuntosModal.tsx` · `soloAcumular` (líneas 162-165)
ANTES:
```ts
  function soloAcumular() {
    onAplicar({ telefono: telefono.trim(), descuento: 0 });
    reset();
  }
```
DESPUÉS:
```ts
  function soloAcumular() {
    if (!telefono.trim()) {
      setError("Sin teléfono no se puede acumular cashback. Consulta por teléfono o correo.");
      return;
    }
    onAplicar({ telefono: telefono.trim(), descuento: 0 });
    reset();
  }
```
(Sin teléfono NO se puede operar el monedero desde el POS — earn y redeem trabajan por teléfono — así que bloquear ambos es correcto.)

### A.3 — `Ventas.tsx` · red de seguridad en `ejecutarVenta` (antes del canje, ~línea 302)
ANTES:
```ts
    if (puntosTel && cashbackUsar > 0) {
      try {
        await fnCanjearPuntos({
```
DESPUÉS (insertar guarda antes del `if`):
```ts
    // Blindaje money-safety: un descuento de cashback SIN teléfono no puede
    // debitarse → se estaría regalando saldo. Aborta el cobro (no crea la venta).
    if (cashbackUsar > 0 && !puntosTel) {
      throw new Error("No se puede aplicar cashback sin teléfono del cliente. Quítalo y reintenta.");
    }
    if (puntosTel && cashbackUsar > 0) {
      try {
        await fnCanjearPuntos({
```
(Lanzar aquí sigue el patrón existente del canje: aborta el cobro y el cajero ve el error. Es redundante con A.1 a propósito — defensa en profundidad.)

**Flujos que NO cambian:** consulta por teléfono (siempre hay teléfono); consulta por barcode con monedero que sí tiene teléfono (aplicarSaldoResp lo setea) → operan igual.

---

## Fase 2 — C · Encolar la vinculación de tarjeta (reintento robusto, sin re-cobro)

**Bug:** en `Ventas.tsx:345-372`, tras cobrar el artículo tarjeta, si la vinculación falla por **red** (o es offline), solo se muestra un toast y **no se reintenta** (la cola offline no cubre tarjetas). La única vía UI de recuperación ("Activar tarjeta") **re-agrega el SKU y vuelve a cobrar**. La operación de vínculo (`activarTarjeta`/`reponerTarjeta`) ya es **idempotente por `ventaId`**, así que reintentarla es seguro.

**Fix:** añadir el tipo `"card"` a la cola offline (patrón idéntico a `earn`), y encolar el vínculo en fallo **transitorio**/offline. Los **rechazos definitivos** (409 `already-exists`: tarjeta ya vinculada/bloqueada) NO se encolan — solo se avisan.

### C.1 — `clientePuntosStore.ts` · tipo de la cola (línea 18)
ANTES:
```ts
  tipo: "register" | "earn" | "canje";
```
DESPUÉS:
```ts
  tipo: "register" | "earn" | "canje" | "card";
```

### C.2 — `usePuntosColaFlush.ts` · procesar `"card"` en el flush
Agregar imports (`fnActivarTarjeta`, `fnReponerTarjeta`) y una rama en el `for` (junto a register/earn/canje):
```ts
} else if (item.tipo === "card") {
  const p = item.payload as {
    modo: "activar" | "reponer"; phone: string; codigo: string;
    codigoAnterior?: string; ventaId: string;
  };
  if (p.modo === "reponer") {
    await fnReponerTarjeta({
      phone: p.phone, codigoAnterior: p.codigoAnterior,
      codigoNuevo: p.codigo, ventaId: p.ventaId,
    });
  } else {
    await fnActivarTarjeta({ phone: p.phone, codigo: p.codigo, ventaId: p.ventaId });
  }
}
```

### C.3 — `Ventas.tsx` · encolar en offline y en fallo transitorio (líneas 347-370)
- **Offline:** en vez de solo avisar "vuelve a activar", encolar el vínculo → se reintenta solo al reconectar.
- **Catch:** distinguir rechazo definitivo (`err.code` incluye `already-exists`/`invalid-argument` → solo avisar, no reintentar) de fallo transitorio (red → encolar). El vínculo es idempotente por `ventaId`, así que reintentar nunca re-cobra ni duplica.

```ts
      const cardPayload = {
        modo: (tarjPend.codigoAnterior ? "reponer" : "activar") as "activar" | "reponer",
        phone: tarjPend.telefono,
        codigo: tarjPend.codigo,
        ...(tarjPend.codigoAnterior ? { codigoAnterior: tarjPend.codigoAnterior } : {}),
        ventaId: result.venta.ventaId,
      };
      if (result.offline) {
        useClientePuntos.getState().encolar("card", cardPayload);
        setToast("Sin conexión: la tarjeta se vinculará automáticamente al reconectar.");
        window.setTimeout(() => setToast(null), 6000);
      } else {
        try {
          if (tarjPend.codigoAnterior) {
            await fnReponerTarjeta({ /* … igual … */ });
          } else {
            await fnActivarTarjeta({ /* … igual … */ });
          }
        } catch (e) {
          const err = e as { code?: string; message?: string };
          const definitivo = String(err?.code || "").includes("already-exists")
            || String(err?.code || "").includes("invalid-argument");
          if (definitivo) {
            setToast(`Tarjeta NO vinculada (${err?.message || "revisa el código"}). La venta sí se cobró.`);
          } else {
            useClientePuntos.getState().encolar("card", cardPayload);
            setToast("La tarjeta se vinculará automáticamente (reintento). La venta sí se cobró.");
          }
          window.setTimeout(() => setToast(null), 6000);
        }
      }
```

**Seguridad:** reintentar `activarTarjeta`/`reponerTarjeta` es idempotente por `ventaId` (la venta ya existe; el vínculo es aparte) → nunca re-cobra ni doble-vincula. Rechazos definitivos no se reintentan.

---

## Fase 3 — E · Limpiar `tarjetaPendiente` al vaciar el carrito

**Bug (nicho):** `tarjetaPendiente` se persiste en localStorage pero el carrito no; un pendiente rancio + un SKU `12301248` escaneado directo para OTRO cliente → el guard `tarjetaCobrada` (`Ventas.tsx:339`) vincula la tarjeta del cliente A pagada por la venta de B (mala atribución; sin cobro de más).

**Fix:** limpiar `tarjetaPendiente` cuando el carrito se vacía (igual que `PagoFooter` limpia el descuento). Requiere ubicar el punto de vaciado del carrito (`carritoStore.limpiar`/`limpiar()` en `Ventas.tsx`). Se detalla al implementar (anclaje exacto en la fase). Contenido y de bajo riesgo.

---

## Fase 4 — D · Pre-chequeo "tarjeta en uso" solo resuelve ACTIVAS ⏸️ DIFERIDO

`UsarPuntosModal.tsx:191` pre-chequea con `fnConsultarSaldoPuntos({codigo})` → `balance` → `resolveWalletIdByCard(includeInactive=false)`, que devuelve null para tarjetas `bloqueada`/`repuesta`. Un barcode reusado de OTRA cuenta bloqueada/repuesta pasa el pre-chequeo, se agrega y se **cobra**; recién al vincular el server responde `card-claimed` (409) → cliente cobrado-sin-tarjeta.

**Por qué se difiere:** el server YA protege el binding (no hay corrupción). Cerrar el pre-chequeo requiere un endpoint/CF que resuelva el barcode en **cualquier** estado (toca la API amise + la Cloud Function), no es POS-only. Se documenta para un lote separado con el dueño.

---

## Fase 5 — B · Débito de canje huérfano ⏸️ DIFERIDO (necesita decisión)

`fnCanjearPuntos` debita ANTES de crear la venta (`Ventas.tsx:302-321`). Si hay crash/reload entre el débito y la persistencia, el débito queda huérfano: el `preview`/`idempotencyKey` viven **solo en memoria** (se pierden), y el reconciliador (`functions/index.js:480`) **solo renumera, no reintenta canjes**. La rama web (`checkout/session`) sí **loguea** el huérfano para conciliar; la del POS no.

**Por qué se difiere:** un fix a prueba de balas necesita reconciliación server-side o re-crédito, y auto-revertir es **riesgoso** (doble-crédito si la venta sí entró). Opciones seguras a decidir:
- (a) Persistir el `preview`/`idempotencyKey` en localStorage antes de debitar y limpiarlo al crear la venta; al arrancar, si queda uno huérfano → **avisar/loguear** (no auto-revertir) para conciliación manual.
- (b) Replicar el log de huérfanos de la rama web para que un job de reconciliación lo resuelva.
Ninguna se implementa sin tu visto bueno (mueve/observa dinero).

---

## §Auditoría (2026-07-06) — CHANGES_REQUIRED → incorporado

- **Fase 1 (A): APROBADA tal cual** (código correcto). Solo prosa: A.3 vive en `ejecutarVenta` (287-429), no en `confirmarVenta` (wrapper) — corregido arriba.
- **Fase 2 (C): 3 ajustes incorporados:**
  - **C.0 (nuevo):** validar el **checksum EAN-13** en `agregarTarjeta` antes de vender/encolar. El POS hoy solo valida longitud 13; amise **sí** valida el dígito verificador → una tarjeta con checksum malo se cobraría y luego fallaría al vincular (400 → `internal`).
  - **C.2:** la rama `card` va **entre** `canje` y el `else` terminal (que es `earn`), no después.
  - **C.3:** encolar **solo** en `unavailable` (fallo de red que lanza el proxy). El proxy colapsa 400/404/500 en `internal`, así que reintentar `internal` sería 60 reintentos vacíos + descarte silencioso (regresión). Para todo lo no-`unavailable` se conserva el mensaje accionable actual, sin encolar.
- **Fase 3 (E): IMPLEMENTADA (enfoque seguro).** NO se enganchó a `carritoStore.limpiar()` (compartida, se llama en el post-venta antes de vincular). Se usó un `useEffect(…, [items.length])` a nivel de `Ventas` que limpia `tarjetaPendiente` SOLO cuando el carrito queda vacío. Verificado que corre **async tras el render**: entre el `limpiar()` post-venta y la lectura de `tarjetaPendiente` (para vincular) NO hay `await`, así que la vinculación consume el pendiente síncronamente ANTES de que el effect pueda correr → no rompe el flujo legítimo.
- Precisión: la vinculación es **idempotente por (código, monedero)** en `linkCard`/`replaceCard`; `ventaId` es metadato. El no-re-cobro viene de que vincular es una operación **separada** de la venta (ya persistida).

**Implementadas: Fases 1, 2 (corregidas) y 3. Fases 4 y 5 diferidas (cross-repo / decisión).**

## §Verificación (2026-07-06)
- `npm run typecheck` (nodo-web): **limpio** tras aplicar Fases 1 y 2.
- `ean13Ok` (checksum nuevo de C.0): verificado contra vectores — acepta 6 válidos (incl. códigos generados por amise) y rechaza 5 inválidos (checksum/longitud/no-dígitos).
- **Aplicado:** `UsarPuntosModal.tsx` (A.1/A.2/C.0), `Ventas.tsx` (A.3/C.3 + Fase 3 useEffect), `clientePuntosStore.ts` (C.1), `usePuntosColaFlush.ts` (C.2). Typecheck limpio tras Fase 3 también. Fases 4/5 diferidas.
- **Sin `git commit`** — espera tu OK (repo del POS, aparte de amise).

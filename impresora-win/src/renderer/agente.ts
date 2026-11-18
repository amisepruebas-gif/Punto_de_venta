// ============================================================
// El agente: recibe las órdenes de la cola y las imprime
// ============================================================
//
//   1. Entra con el código de vinculación (acceso `imprimir`): la function
//      `canjearEnlaceLote` le da una sesión. Con el mismo número de PC
//      (`dispositivo`) vuelve a entrar sin gastar otra entrada.
//   2. Escucha las órdenes "pendiente" de SU impresora.
//   3. Toma cada una en una transacción: si es de etiquetas de lote, aparta
//      los números subiendo el contador en la misma escritura (las reglas lo
//      revisan con getAfter).
//   4. Arma los comandos TSPL (shared/src/tspl.ts), los manda a la impresora
//      de Windows y deja la orden "impreso" o "error".
//   5. Cada minuto avisa que sigue vivo (así se ve "conectada").
//
// Una orden que se quedó "imprimiendo" (se apagó la PC a media impresión)
// NO se reimprime sola: queda con error para que la persona revise si salió
// y, si no, pida "Reimprimir". Así no salen números repetidos sin querer.

import { FirebaseError } from "firebase/app";
import { signInWithCustomToken, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  DOC_CONTADOR_ETIQUETAS_LOTE,
  IMPRESION_MAX_ERROR,
  IMPRESORA_LATIDO_MS,
  codigosDeTrabajo,
  etiquetasDeTrabajo,
  leerCodigoVinculacion,
  msDeMarca,
  paths,
  planearTomaEtiquetasLote,
  rangoLegible,
  tsplEtiquetasLote,
  tsplEtiquetasPrecio,
  tsplPrueba,
  validarRenglonesPrecio,
  type Impresora,
  type RenglonEtiquetaPrecio,
  type TrabajoImpresion,
} from "@shared";
import type { ConfigLocal, ResultadoImpresion } from "../compartido/api";
import type { ServiciosFirebase } from "./firebase";

export type Fase = "cargando" | "sin_vincular" | "conectando" | "listo" | "apagada" | "sin_red";

/** Una orden atendida, para la lista "Últimas órdenes" (solo en esta PC). */
export type OrdenVista = {
  id: string;
  tipo: TrabajoImpresion["tipo"];
  cuandoMs: number;
  quien?: string;
  etiquetas: number;
  detalle: string;
  estado: "impreso" | "error";
  error?: string;
  desde?: number;
  hasta?: number;
  renglones?: RenglonEtiquetaPrecio[];
};

export type EstadoAgente = {
  fase: Fase;
  mensaje: string;
  /** Nombre de la impresora en admin. */
  nombre: string;
  impresoraId: string | null;
  pausada: boolean;
  impresoraWindows: string | null;
  enCola: number;
  imprimiendo: string | null;
  ultimas: OrdenVista[];
};

type Vinculo = { negocioId: string; enlaceId: string; secreto: string };

type RespuestaCanje = { token: string; uid: string; tipo: string; nombre?: string };

const CLAVE_HISTORIAL = "amise.impresora.historial.v1";
const MAX_HISTORIAL = 50;
const REINTENTO_RED_MS = 30_000;
const REINTENTO_APAGADA_MS = 60_000;
/** Si la impresora no respondió, las demás órdenes esperan y se reintenta. */
const REINTENTO_IMPRESORA_MS = 60_000;

function codigoDe(e: unknown): string {
  return e instanceof FirebaseError ? e.code : typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
}
function esPermiso(e: unknown): boolean {
  return /permission-denied|unauthenticated/.test(codigoDe(e));
}
function esRed(e: unknown): boolean {
  const c = codigoDe(e);
  return (
    /unavailable|deadline-exceeded|network-request-failed|functions\/internal|cancelled/.test(c) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  );
}
function mensajeDe(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

function leerHistorial(): OrdenVista[] {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL) ?? "[]");
    return Array.isArray(x) ? (x as OrdenVista[]).slice(0, MAX_HISTORIAL) : [];
  } catch {
    return [];
  }
}
function guardarHistorial(lista: OrdenVista[]): void {
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(lista.slice(0, MAX_HISTORIAL)));
  } catch {
    /* sin espacio: solo no se recuerda */
  }
}

/** Con límite de tiempo: una escritura sin red queda en la fila del SDK. */
function conLimite<T>(p: Promise<T>, ms: number): Promise<T | "tarde"> {
  return Promise.race([p, new Promise<"tarde">((r) => setTimeout(() => r("tarde"), ms))]);
}

export class Agente {
  private estado: EstadoAgente = {
    fase: "cargando",
    mensaje: "Iniciando…",
    nombre: "",
    impresoraId: null,
    pausada: false,
    impresoraWindows: null,
    enCola: 0,
    imprimiendo: null,
    ultimas: [],
  };
  private readonly oyentes = new Set<(e: EstadoAgente) => void>();
  private vinculo: Vinculo | null = null;
  private uid: string | null = null;
  private cancelar: Unsubscribe[] = [];
  private latido: ReturnType<typeof setInterval> | null = null;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private reintentoCola: ReturnType<typeof setTimeout> | null = null;
  private readonly pendientes = new Map<string, number>();
  private procesando = false;
  /** Ya se revisaron las órdenes que dejó a medias una corrida anterior. */
  private yaLimpio = false;
  private version = "";

  constructor(
    private readonly fb: ServiciosFirebase,
    private readonly dispositivo: string,
  ) {}

  // ---------- Estado para la pantalla y la bandeja ----------

  suscribir(cb: (e: EstadoAgente) => void): () => void {
    this.oyentes.add(cb);
    cb(this.estado);
    return () => {
      this.oyentes.delete(cb);
    };
  }

  private poner(cambios: Partial<EstadoAgente>): void {
    this.estado = { ...this.estado, ...cambios };
    for (const cb of this.oyentes) cb(this.estado);
    window.amise.estadoBandeja({
      texto: this.textoCorto(),
      pausada: this.estado.pausada,
      conectada: this.estado.fase === "listo",
    });
  }

  private textoCorto(): string {
    const e = this.estado;
    switch (e.fase) {
      case "listo":
        if (!e.impresoraWindows) return "Falta elegir la impresora";
        if (e.pausada) return `En pausa (${e.enCola} en cola)`;
        return e.imprimiendo ? "Imprimiendo…" : "Lista: imprime al llegar";
      case "sin_red":
        return "Sin internet: las órdenes esperan";
      case "apagada":
        return "Apagada en admin";
      case "sin_vincular":
        return "Falta vincular esta PC";
      default:
        return e.mensaje;
    }
  }

  private log(nivel: "info" | "error", m: string): void {
    window.amise.registro(nivel, m);
  }

  // ---------- Arranque, vinculación y reconexión ----------

  async iniciar(config: ConfigLocal, version: string): Promise<void> {
    this.version = version;
    this.poner({
      pausada: config.pausada,
      impresoraWindows: config.impresoraWindows ?? null,
      ultimas: leerHistorial(),
    });
    const guardado = await window.amise.vinculacion.leer();
    const v = guardado ? leerCodigoVinculacion(guardado) : null;
    if (!v) {
      this.poner({
        fase: "sin_vincular",
        mensaje: guardado ? "El código guardado ya no sirve. Vuelve a vincular." : "Pega el código de vinculación.",
      });
      return;
    }
    await this.conectar(v, false);
  }

  /** Vincula esta PC con el código que dio admin. Lanza con un mensaje claro. */
  async vincular(texto: string): Promise<void> {
    const v = leerCodigoVinculacion(texto);
    if (!v) {
      // Lo que más se confunde: el enlace de un teléfono (armar lotes).
      if (/\/enlace\//.test(texto)) {
        throw new Error(
          'Ese es el enlace de un teléfono, no el código de la impresora. En admin → Accesos baja hasta "Impresoras de etiquetas", crea la impresora y copia su código (empieza con AMISE1.).',
        );
      }
      throw new Error(
        'Ese no es un código de vinculación. Cópialo completo de admin → Accesos → "Impresoras de etiquetas" (empieza con AMISE1.).',
      );
    }
    this.detener();
    this.poner({ fase: "conectando", mensaje: "Vinculando…", impresoraId: v.enlaceId });
    try {
      await this.canjear(v);
    } catch (e) {
      this.poner({ fase: "sin_vincular", mensaje: "No se vinculó." });
      throw new Error(this.textoError(e));
    }
    await window.amise.vinculacion.guardar(texto.replace(/\s+/g, ""));
    this.vinculo = v;
    this.uid = this.fb.auth.currentUser?.uid ?? null;
    this.yaLimpio = false;
    this.log("info", `Vinculada con la impresora ${v.enlaceId}`);
    this.arrancar();
  }

  async desvincular(): Promise<void> {
    this.detener();
    this.vinculo = null;
    this.uid = null;
    await signOut(this.fb.auth).catch(() => undefined);
    await window.amise.vinculacion.borrar();
    this.pendientes.clear();
    this.poner({ fase: "sin_vincular", mensaje: "PC desvinculada.", nombre: "", impresoraId: null, enCola: 0 });
    this.log("info", "PC desvinculada");
  }

  private textoError(e: unknown): string {
    if (esRed(e)) return "Sin internet. Revisa la conexión de esta PC y vuelve a intentar.";
    // Los mensajes de la function ya vienen en español sencillo.
    return mensajeDe(e);
  }

  private async canjear(v: Vinculo): Promise<void> {
    const f = httpsCallable<
      { negocioId: string; enlaceId: string; secreto: string; dispositivo: string },
      RespuestaCanje
    >(this.fb.functions, "canjearEnlaceLote");
    const r = await f({ negocioId: v.negocioId, enlaceId: v.enlaceId, secreto: v.secreto, dispositivo: this.dispositivo });
    if (r.data.tipo !== "imprimir") throw new Error("Ese código no es de una impresora.");
    await signInWithCustomToken(this.fb.auth, r.data.token);
    if (r.data.nombre) this.poner({ nombre: r.data.nombre });
  }

  private async conectar(v: Vinculo, forzarCanje: boolean): Promise<void> {
    this.detener();
    this.vinculo = v;
    this.poner({ fase: "conectando", mensaje: "Conectando…", impresoraId: v.enlaceId });
    await this.fb.auth.authStateReady();
    const actual = this.fb.auth.currentUser;
    let sirve = false;
    if (actual && !forzarCanje) {
      const c = (await actual.getIdTokenResult().catch(() => null))?.claims;
      sirve = !!c && c.role === "enlace" && c.tipo === "imprimir" && c.enlaceId === v.enlaceId && c.negocioId === v.negocioId;
    }
    // Con la sesión guardada se entra sin canje (aunque no haya red ni
    // functions). Sin canje en segundo plano: cambiar de sesión a media
    // escritura hace que el SDK repita escrituras que ya quedaron. Si la
    // apagaron o la renovaron, las reglas cortan y se reintenta CON canje,
    // que dice cuál de las dos.
    if (!sirve) {
      try {
        await this.canjear(v);
      } catch (e) {
        this.manejarError(e, "al entrar");
        return;
      }
    }
    this.uid = this.fb.auth.currentUser?.uid ?? null;
    this.arrancar();
  }

  /** Vuelve a entrar en un rato. `conCanje`: preguntarle a la function
   *  (apagada, renovada o ya prendida otra vez); sin canje se entra con la
   *  sesión guardada (sin red o falla del servidor). */
  private programarReintento(ms: number, conCanje: boolean): void {
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = setTimeout(() => {
      this.reintento = null;
      if (this.vinculo) void this.conectar(this.vinculo, conCanje);
    }, ms);
  }

  private manejarError(e: unknown, donde: string): void {
    this.log("error", `${donde}: ${codigoDe(e)} ${mensajeDe(e)}`);
    // Ya sin vincular (código renovado o desvinculada): nada que reintentar.
    if (!this.vinculo) return;
    if (esRed(e)) {
      this.poner({ fase: "sin_red", mensaje: "Sin internet: las órdenes esperan en la cola." });
      this.detener();
      this.programarReintento(REINTENTO_RED_MS, false);
      return;
    }
    const c = codigoDe(e);
    if (c === "functions/permission-denied") {
      const m = mensajeDe(e);
      // "ya no sirve" / "ya se usó": hay que pegar un código nuevo.
      if (/no sirve|otra computadora/.test(m)) {
        this.detener();
        this.vinculo = null;
        this.poner({ fase: "sin_vincular", mensaje: m });
        return;
      }
      this.detener();
      this.poner({ fase: "apagada", mensaje: m });
      this.programarReintento(REINTENTO_APAGADA_MS, true);
      return;
    }
    if (esPermiso(e)) {
      // Firestore dejó de dejar: apagada o renovada en admin. Se vuelve a
      // entrar con canje (dice cuál de las dos, o que ya la prendieron).
      this.detener();
      this.poner({ fase: "apagada", mensaje: "Esta impresora está apagada en admin o se renovó su código." });
      this.programarReintento(REINTENTO_APAGADA_MS, true);
      return;
    }
    // Otro error (del servidor, demasiados intentos, una consulta…). Un
    // oyente de Firestore que falló ya no avisa más, y un canje fallido deja
    // la PC sin entrar: se vuelve a entrar en un rato, sin quedarse muda.
    this.detener();
    this.poner({
      fase: "conectando",
      mensaje: `Algo falló ${donde}: ${mensajeDe(e)}. Se vuelve a intentar en ${REINTENTO_RED_MS / 1000} s.`,
    });
    // Sin canje: con la sesión guardada se entra aunque functions falle (si
    // no hay sesión que sirva, `conectar` hace el canje de todos modos).
    this.programarReintento(REINTENTO_RED_MS, false);
  }

  private detener(): void {
    for (const u of this.cancelar.splice(0)) u();
    if (this.latido) clearInterval(this.latido);
    this.latido = null;
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = null;
    if (this.reintentoCola) clearTimeout(this.reintentoCola);
    this.reintentoCola = null;
  }

  /** Vuelve a revisar la cola en un rato (las órdenes que siguen pendientes). */
  private programarCola(ms: number): void {
    if (this.reintentoCola) clearTimeout(this.reintentoCola);
    this.reintentoCola = setTimeout(() => {
      this.reintentoCola = null;
      void this.procesarCola();
    }, ms);
  }

  private arrancar(): void {
    const v = this.vinculo;
    if (!v) return;
    const { db } = this.fb;
    this.poner({ fase: "listo", mensaje: "Lista para imprimir." });
    // Su impresora: el nombre que le puso admin.
    this.cancelar.push(
      onSnapshot(
        doc(db, paths.impresora(v.negocioId, v.enlaceId)),
        (s) => {
          if (!s.exists()) {
            this.poner({ fase: "apagada", mensaje: "Esta impresora ya no existe en admin." });
            return;
          }
          const d = s.data() as Impresora;
          this.poner({ nombre: d.nombre ?? "" });
        },
        (e) => this.manejarError(e, "al leer la impresora"),
      ),
    );
    // La cola: las órdenes pendientes de esta impresora.
    this.cancelar.push(
      onSnapshot(
        query(
          collection(db, paths.impresionesCol(v.negocioId)),
          where("impresoraId", "==", v.enlaceId),
          where("estado", "==", "pendiente"),
        ),
        (snap) => {
          this.pendientes.clear();
          for (const d of snap.docs) this.pendientes.set(d.id, msDeMarca(d.data().creadoEn) ?? Date.now());
          this.poner({ enCola: this.pendientes.size });
          void this.procesarCola();
        },
        (e) => this.manejarError(e, "al leer la cola"),
      ),
    );
    void this.limpiarInterrumpidas();
    void this.avisarVida();
    this.latido = setInterval(() => void this.avisarVida(), IMPRESORA_LATIDO_MS);
  }

  /** Cada minuto: "sigo vivo", con la impresora de Windows y la pausa. */
  private async avisarVida(): Promise<void> {
    const v = this.vinculo;
    if (!v || this.estado.fase !== "listo") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
      await updateDoc(doc(this.fb.db, paths.impresora(v.negocioId, v.enlaceId)), {
        latidoEn: serverTimestamp(),
        pausada: this.estado.pausada,
        version: this.version.slice(0, 20),
        // "" = no hay impresora de Windows elegida (admin y el teléfono
        // dicen "falta elegir impresora" en vez de "Conectada").
        windows: (this.estado.impresoraWindows ?? "").slice(0, 120),
      });
    } catch (e) {
      this.manejarError(e, "al avisar que sigue viva");
    }
  }

  /** Las que esta PC dejó "imprimiendo" en una corrida ANTERIOR (se apagó a
   *  media impresión). Una sola vez por corrida: al reconectar en la misma
   *  corrida puede haber una imprimiéndose de verdad. */
  private async limpiarInterrumpidas(): Promise<void> {
    const v = this.vinculo;
    if (!v || !this.uid || this.yaLimpio) return;
    try {
      const snap = await getDocs(
        query(
          collection(this.fb.db, paths.impresionesCol(v.negocioId)),
          where("impresoraId", "==", v.enlaceId),
          where("estado", "==", "imprimiendo"),
        ),
      );
      const uid = this.uid;
      for (const d of snap.docs) {
        if ((d.data() as TrabajoImpresion).tomadoPor !== uid) continue;
        if (d.id === this.estado.imprimiendo) continue;
        // En transacción: si el SDK la repite (respuesta perdida), ve que ya
        // quedó con error y no la vuelve a tocar.
        const marcada = await runTransaction(this.fb.db, async (tx) => {
          const s = await tx.get(d.ref);
          const t = s.exists() ? (s.data() as TrabajoImpresion) : null;
          if (!t || t.estado !== "imprimiendo" || t.tomadoPor !== uid) return false;
          tx.update(d.ref, {
            estado: "error",
            error: 'Se interrumpió (se apagó la PC o el programa). Revisa si salieron; si no, toca "Reimprimir".',
            terminadoEn: serverTimestamp(),
          });
          return true;
        });
        if (marcada) this.log("info", `Orden ${d.id} interrumpida: marcada con error`);
      }
      this.yaLimpio = true;
    } catch (e) {
      this.log("error", `al revisar órdenes interrumpidas: ${mensajeDe(e)}`);
    }
  }

  // ---------- La cola ----------

  private async procesarCola(): Promise<void> {
    if (this.procesando) return;
    this.procesando = true;
    try {
      for (;;) {
        const e = this.estado;
        if (e.fase !== "listo" || e.pausada || !e.impresoraWindows) break;
        const siguiente = [...this.pendientes.entries()].sort((a, b) => a[1] - b[1])[0];
        if (!siguiente) break;
        this.pendientes.delete(siguiente[0]);
        const sigue = await this.procesar(siguiente[0]);
        if (!sigue) break;
      }
    } finally {
      this.procesando = false;
      this.poner({ imprimiendo: null, enCola: this.pendientes.size });
    }
  }

  /** Toma, imprime y termina una orden. `false` = parar la cola por ahora. */
  private async procesar(id: string): Promise<boolean> {
    const v = this.vinculo;
    const uid = this.fb.auth.currentUser?.uid;
    if (!v || !uid) return false;
    const { db } = this.fb;
    const ref = doc(db, paths.impresion(v.negocioId, id));
    let t: TrabajoImpresion | null;
    let intento = 0;
    try {
      t = await runTransaction(db, async (tx) => {
        intento++;
        const snap = await tx.get(ref);
        if (!snap.exists()) return null;
        const actual = snap.data() as TrabajoImpresion;
        if (actual.impresoraId !== v.enlaceId) return null;
        // Reintento del SDK porque se perdió la respuesta del intento
        // anterior, que SÍ quedó: la orden ya es nuestra y se imprime con los
        // números que apartó (si no, se quedaría "imprimiendo" para siempre).
        if (intento > 1 && actual.estado === "imprimiendo" && actual.tomadoPor === uid) return actual;
        if (actual.estado !== "pendiente") return null;
        const cambios: Record<string, unknown> = {
          estado: "imprimiendo",
          tomadoPor: uid,
          tomadoEn: serverTimestamp(),
        };
        let rango: { desde: number; hasta: number } | null = null;
        if (actual.tipo === "etiquetas_lote") {
          const refContador = doc(db, paths.dato(v.negocioId, DOC_CONTADOR_ETIQUETAS_LOTE));
          const c = await tx.get(refContador);
          const ultimo = c.exists() ? Number((c.data() as { ultimo?: unknown }).ultimo) : null;
          const plan = planearTomaEtiquetasLote(actual, ultimo);
          if (plan.nuevoUltimo !== null) {
            // Con el id de esta orden: las reglas solo dejan mover el contador
            // junto con la orden que se toma en esta misma escritura.
            const contador = { ultimo: plan.nuevoUltimo, trabajoId: id };
            if (c.exists()) tx.update(refContador, contador);
            else tx.set(refContador, contador);
            cambios.desde = plan.desde;
            cambios.hasta = plan.hasta;
          }
          rango = { desde: plan.desde, hasta: plan.hasta };
        }
        tx.update(ref, cambios);
        return { ...actual, ...(rango ?? {}), estado: "imprimiendo", tomadoPor: uid };
      });
    } catch (e) {
      if (esRed(e)) {
        // Sigue "pendiente" en el servidor: se vuelve a intentar con la red.
        this.pendientes.set(id, Date.now());
        this.manejarError(e, `al tomar la orden ${id}`);
        return false;
      }
      if (esPermiso(e)) {
        this.manejarError(e, `al tomar la orden ${id}`);
        return false;
      }
      // La orden misma está mal (cantidad inválida…): queda con error.
      await this.terminar(ref, { estado: "error", error: mensajeDe(e) });
      return true;
    }
    if (!t) return true;

    let datos: string;
    try {
      if (t.tipo === "etiquetas_lote") {
        datos = tsplEtiquetasLote(codigosDeTrabajo(t));
      } else {
        const problemas = validarRenglonesPrecio(t.renglones);
        if (problemas.length > 0) throw new Error(problemas.join("; "));
        datos = tsplEtiquetasPrecio(t.renglones ?? []);
      }
    } catch (e) {
      await this.terminar(ref, { estado: "error", error: mensajeDe(e) });
      this.agregarHistorial(id, t, "error", mensajeDe(e));
      return true;
    }

    const n = etiquetasDeTrabajo(t);
    this.poner({ imprimiendo: id, mensaje: `Imprimiendo ${n} etiqueta${n === 1 ? "" : "s"}…` });
    let r: ResultadoImpresion;
    try {
      r = await window.amise.impresoras.imprimir({
        impresora: this.estado.impresoraWindows ?? "",
        datos,
        nombre: `AMISE ${t.tipo === "etiquetas_lote" ? "lote" : "precio"} ${id}`,
      });
    } catch (e) {
      // Que nunca se quede "imprimiendo" (disco lleno, antivirus…).
      r = { ok: false, error: `No se pudo mandar a Windows: ${mensajeDe(e)}` };
    }
    if (r.ok) {
      await this.terminar(ref, { estado: "impreso", impresiones: (t.impresiones ?? 0) + 1 });
      this.agregarHistorial(id, t, "impreso");
      this.log("info", `Orden ${id} impresa (${n} etiquetas${t.desde ? `, ${rangoLegible(t)}` : ""})`);
      this.poner({ mensaje: "Lista para imprimir." });
    } else {
      await this.terminar(ref, { estado: "error", error: r.error });
      this.agregarHistorial(id, t, "error", r.error);
      this.poner({ mensaje: r.error });
      if (r.noResponde) {
        // Apagada, desconectada o sin papel: no se gastan las demás órdenes;
        // esperan en la cola y se reintenta en un rato (o al llegar otra).
        this.programarCola(REINTENTO_IMPRESORA_MS);
        return false;
      }
    }
    return true;
  }

  private async terminar(
    ref: ReturnType<typeof doc>,
    campos: { estado: "impreso"; impresiones: number } | { estado: "error"; error: string },
  ): Promise<void> {
    const datos =
      campos.estado === "error"
        ? { estado: "error", error: campos.error.slice(0, IMPRESION_MAX_ERROR), terminadoEn: serverTimestamp() }
        : { ...campos, terminadoEn: serverTimestamp() };
    try {
      // Sin red la escritura queda en la fila del SDK y sube sola: no se
      // detiene la cola esperándola.
      const r = await conLimite(updateDoc(ref, datos), 15_000);
      if (r === "tarde") this.log("info", `La orden ${ref.id} se marcará "${campos.estado}" al volver la red`);
    } catch (e) {
      this.log("error", `al terminar la orden ${ref.id}: ${mensajeDe(e)}`);
    }
  }

  private agregarHistorial(id: string, t: TrabajoImpresion, estado: "impreso" | "error", error?: string): void {
    const detalle =
      t.tipo === "etiquetas_lote"
        ? rangoLegible(t) || `${t.cantidad ?? 0} etiquetas`
        : (t.renglones ?? [])
            .map((r) => `${r.piezas} × ${r.codigo ? `${r.codigo} $${r.precio}` : `no registrado $${r.precio}`}`)
            .join(", ");
    const vista: OrdenVista = {
      id,
      tipo: t.tipo,
      cuandoMs: Date.now(),
      ...(t.quien ? { quien: t.quien } : {}),
      etiquetas: etiquetasDeTrabajo(t),
      detalle,
      estado,
      ...(error ? { error } : {}),
      ...(t.desde !== undefined && t.hasta !== undefined ? { desde: t.desde, hasta: t.hasta } : {}),
      ...(t.renglones ? { renglones: t.renglones } : {}),
    };
    const ultimas = [vista, ...this.estado.ultimas.filter((o) => o.id !== id)].slice(0, MAX_HISTORIAL);
    guardarHistorial(ultimas);
    this.poner({ ultimas });
  }

  // ---------- Lo que hace la persona en la PC ----------

  async pausar(pausada: boolean): Promise<void> {
    await window.amise.config.guardar({ pausada });
    this.poner({ pausada });
    void this.avisarVida();
    if (!pausada) void this.procesarCola();
  }

  async elegirImpresora(nombre: string | null): Promise<void> {
    await window.amise.config.guardar({ impresoraWindows: nombre ?? "" });
    this.poner({ impresoraWindows: nombre });
    void this.avisarVida();
    void this.procesarCola();
  }

  async imprimirPrueba(): Promise<string | null> {
    const impresora = this.estado.impresoraWindows;
    if (!impresora) return "Primero elige la impresora de Windows.";
    const r = await window.amise.impresoras
      .imprimir({ impresora, datos: tsplPrueba(this.estado.nombre || "AMISE"), nombre: "AMISE prueba" })
      .catch((e: unknown): ResultadoImpresion => ({ ok: false, error: `No se pudo mandar a Windows: ${mensajeDe(e)}` }));
    return r.ok ? null : r.error;
  }

  /** Vuelve a imprimir aquí una orden ya atendida, con los mismos números
   *  (no cambia nada en la cola: es para un atasco de papel). */
  async reimprimirLocal(o: OrdenVista): Promise<string | null> {
    const impresora = this.estado.impresoraWindows;
    if (!impresora) return "Primero elige la impresora de Windows.";
    let datos: string;
    try {
      datos =
        o.tipo === "etiquetas_lote"
          ? tsplEtiquetasLote(codigosDeTrabajo({ desde: o.desde, hasta: o.hasta }))
          : tsplEtiquetasPrecio(o.renglones ?? []);
    } catch (e) {
      return mensajeDe(e);
    }
    const r = await window.amise.impresoras
      .imprimir({ impresora, datos, nombre: `AMISE reimpresión ${o.id}` })
      .catch((e: unknown): ResultadoImpresion => ({ ok: false, error: `No se pudo mandar a Windows: ${mensajeDe(e)}` }));
    return r.ok ? null : r.error;
  }
}

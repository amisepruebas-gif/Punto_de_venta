import { useCallback, useEffect, useState } from "react";
import type { ImpresoraWindows, OpcionesPrograma, PuertoUsb } from "../compartido/api";
import { Agente, type EstadoAgente, type OrdenVista } from "./agente";
import { crearFirebase } from "./firebase";

type Listo = { agente: Agente; opciones: OpcionesPrograma };

const TEXTO_FASE: Record<EstadoAgente["fase"], string> = {
  cargando: "Iniciando",
  sin_vincular: "Sin vincular",
  conectando: "Conectando",
  listo: "Conectada",
  apagada: "Apagada en admin",
  sin_red: "Sin internet",
};

function claseFase(e: EstadoAgente): string {
  if (e.fase === "listo") return e.pausada || !e.impresoraWindows ? "chip aviso" : "chip bien";
  if (e.fase === "apagada" || e.fase === "sin_vincular") return "chip mal";
  return "chip neutro";
}

export function App() {
  const [listo, setListo] = useState<Listo | null>(null);
  const [estado, setEstado] = useState<EstadoAgente | null>(null);
  const [errorInicio, setErrorInicio] = useState<string | null>(null);
  // Sin window.alert/confirm: congelan esta ventana, que es la que oye la cola.
  const [avisoBandeja, setAvisoBandeja] = useState<string | null>(null);

  useEffect(() => {
    let quitar: () => void = () => undefined;
    (async () => {
      const opciones = await window.amise.opciones();
      const config = await window.amise.config.leer();
      const agente = new Agente(crearFirebase(opciones.emuladores), config.dispositivo);
      quitar = agente.suscribir(setEstado);
      setListo({ agente, opciones });
      await agente.iniciar(config, opciones.version);
    })().catch((e: unknown) => setErrorInicio(e instanceof Error ? e.message : String(e)));
    return () => quitar();
  }, []);

  // Lo que se pide desde el icono junto al reloj.
  useEffect(() => {
    if (!listo) return;
    return window.amise.alPedirBandeja((accion) => {
      void (async () => {
        if (accion === "pausar") await listo.agente.pausar(true);
        else if (accion === "reanudar") await listo.agente.pausar(false);
        else {
          const error = await listo.agente.imprimirPrueba();
          setAvisoBandeja(error ? `La prueba no salió: ${error}` : null);
          if (error) window.amise.ventana.mostrar();
        }
      })();
    });
  }, [listo]);

  if (errorInicio) {
    return (
      <main className="pagina">
        <h1>AMISE Impresora</h1>
        <p className="error">No arrancó: {errorInicio}</p>
      </main>
    );
  }
  if (!listo || !estado) {
    return (
      <main className="pagina">
        <h1>AMISE Impresora</h1>
        <p>Iniciando…</p>
      </main>
    );
  }
  const { agente, opciones } = listo;
  return (
    <main className="pagina">
      <header className="cabecera">
        <div>
          <h1>AMISE Impresora</h1>
          <p className="sutil">
            Versión {opciones.version}
            {opciones.emuladores ? " · EMULADORES (pruebas)" : ""}
            {opciones.aArchivo ? ` · imprime a archivo: ${opciones.aArchivo}` : ""}
          </p>
        </div>
        <span className={claseFase(estado)} data-fase={estado.fase}>
          {TEXTO_FASE[estado.fase]}
        </span>
      </header>

      {avisoBandeja && (
        <div className="fila aviso-texto" role="alert">
          <span>{avisoBandeja}</span>
          <button type="button" className="secundario" onClick={() => setAvisoBandeja(null)}>
            Cerrar
          </button>
        </div>
      )}

      {estado.fase === "sin_vincular" || estado.fase === "cargando" ? (
        <Vincular agente={agente} estado={estado} />
      ) : (
        <>
          <Impresora agente={agente} estado={estado} />
          <Ordenes agente={agente} estado={estado} />
          <Ultimas agente={agente} estado={estado} />
          <footer className="pie">
            <button type="button" className="secundario" onClick={() => window.amise.ventana.ocultar()}>
              Ocultar ventana (sigue trabajando)
            </button>
            <Desvincular agente={agente} />
          </footer>
        </>
      )}
    </main>
  );
}

function Vincular({ agente, estado }: { agente: Agente; estado: EstadoAgente }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function vincular() {
    setEnviando(true);
    setError(null);
    try {
      await agente.vincular(codigo);
      setCodigo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <section className="tarjeta">
      <h2>Vincular esta computadora</h2>
      <ol className="pasos">
        <li>
          En admin entra a Accesos y baja hasta <b>"Impresoras de etiquetas"</b>: crea una (o toca "Nuevo código" en
          la que ya tienes). No es el enlace de un teléfono.
        </li>
        <li>Copia el código de vinculación (empieza con AMISE1.) y pégalo aquí.</li>
      </ol>
      {estado.mensaje && estado.fase === "sin_vincular" && <p className="aviso-texto">{estado.mensaje}</p>}
      <textarea
        aria-label="Código de vinculación"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="AMISE1.…"
        rows={3}
        spellCheck={false}
      />
      {error && <p className="error">{error}</p>}
      <button type="button" disabled={enviando || !codigo.trim()} onClick={() => void vincular()}>
        {enviando ? "Vinculando…" : "Vincular"}
      </button>
    </section>
  );
}

function Impresora({ agente, estado }: { agente: Agente; estado: EstadoAgente }) {
  const [lista, setLista] = useState<ImpresoraWindows[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const cargar = useCallback(async () => {
    setLista(await window.amise.impresoras.listar());
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  async function prueba() {
    setAviso("Mandando la prueba…");
    const error = await agente.imprimirPrueba();
    setAviso(error ?? "Prueba enviada. Revisa que salió la etiqueta y que el lector lee 12345678.");
  }
  const elegida = estado.impresoraWindows ?? "";
  const existe = !elegida || lista.some((i) => i.nombre === elegida);
  return (
    <section className="tarjeta">
      <h2>Impresora {estado.nombre ? `"${estado.nombre}"` : ""}</h2>
      {estado.fase !== "listo" && <p className="aviso-texto">{estado.mensaje}</p>}
      <label className="campo">
        <span>Impresora de etiquetas en Windows</span>
        <div className="fila">
          <select
            aria-label="Impresora de Windows"
            value={elegida}
            onChange={(e) => void agente.elegirImpresora(e.target.value || null)}
          >
            <option value="">— Elige la impresora —</option>
            {lista.map((i) => (
              <option key={i.nombre} value={i.nombre}>
                {i.nombre}
                {i.predeterminada ? " (predeterminada)" : ""}
              </option>
            ))}
            {!existe && <option value={elegida}>{elegida} (no está conectada)</option>}
          </select>
          <button type="button" className="secundario" onClick={() => void cargar()}>
            Actualizar
          </button>
        </div>
      </label>
      {!elegida && <p className="aviso-texto">Elige la impresora para empezar a imprimir. Mientras, las órdenes esperan.</p>}
      <div className="fila">
        <button type="button" onClick={() => void prueba()} disabled={!elegida}>
          Imprimir prueba
        </button>
        <button type="button" className="secundario" onClick={() => setPreparando((x) => !x)}>
          {preparando ? "Cerrar" : "Preparar impresora USB…"}
        </button>
      </div>
      {aviso && <p className="sutil">{aviso}</p>}
      {preparando && (
        <PrepararImpresora
          alTerminar={async (nombre) => {
            await cargar();
            await agente.elegirImpresora(nombre);
            setPreparando(false);
            setAviso(`Lista: "${nombre}". Ahora da "Imprimir prueba".`);
          }}
        />
      )}
    </section>
  );
}

function PrepararImpresora({ alTerminar }: { alTerminar: (nombre: string) => Promise<void> }) {
  const [puertos, setPuertos] = useState<PuertoUsb[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    setError(null);
    setPuertos(null);
    try {
      setPuertos(await window.amise.impresoras.puertosUsb());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  async function preparar(puerto: string) {
    setTrabajando(puerto);
    setError(null);
    const r = await window.amise.impresoras.preparar(puerto);
    setTrabajando(null);
    if (r.ok) await alTerminar("Etiquetas AMISE");
    else setError(r.error);
  }
  return (
    <div className="subtarjeta">
      <p>
        Conecta la impresora de etiquetas por USB y préndela. Windows le da un puerto <b>USB00…</b>. Elige el
        suyo: se crea la impresora <b>"Etiquetas AMISE"</b> con el driver genérico de Windows (pide permiso de
        administrador una vez). No se toca ninguna otra impresora.
      </p>
      {puertos === null && !error && <p className="sutil">Buscando puertos USB…</p>}
      {puertos?.length === 0 && (
        <p className="aviso-texto">
          No hay puertos USB de impresora. Revisa el cable y que esté prendida; si sigue sin aparecer, instala el
          driver de la marca y elígela arriba.
        </p>
      )}
      {!!puertos?.length && !puertos.some((p) => p.conectada) && (
        <p className="aviso-texto">
          Ningún puerto tiene una impresora conectada ahora. Revisa el cable y que esté prendida, y toca "Buscar otra
          vez".
        </p>
      )}
      <ul className="lista">
        {puertos?.map((p) => (
          <li key={p.puerto} data-puerto={p.puerto} data-conectada={p.conectada ? "si" : "no"}>
            <div>
              <b>{p.puerto}</b> {p.dispositivo ? `· ${p.dispositivo}` : ""}
              <div className={p.conectada ? "bien-texto" : "sutil"}>
                {p.conectada ? "Conectada ahora: aquí está tu impresora" : "Nada conectado ahora"}
                {p.impresoras.length > 0 ? ` · Ya lo usa: ${p.impresoras.join(", ")}` : ""}
              </div>
            </div>
            <button
              type="button"
              className={p.conectada ? undefined : "secundario"}
              disabled={!!trabajando}
              onClick={() => void preparar(p.puerto)}
            >
              {trabajando === p.puerto ? "Creando…" : "Usar este"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
      <button type="button" className="secundario" onClick={() => void cargar()}>
        Buscar otra vez
      </button>
    </div>
  );
}

function Ordenes({ agente, estado }: { agente: Agente; estado: EstadoAgente }) {
  return (
    <section className="tarjeta">
      <h2>Órdenes</h2>
      <label className="interruptor">
        <input
          type="checkbox"
          aria-label="Imprimir al llegar"
          checked={!estado.pausada}
          onChange={(e) => void agente.pausar(!e.target.checked)}
        />
        <span>{estado.pausada ? "En pausa: las órdenes esperan en la cola" : "Imprimir en cuanto llegan"}</span>
      </label>
      <p data-cola={estado.enCola}>
        En cola: <b>{estado.enCola}</b>
        {estado.imprimiendo ? " · imprimiendo ahora" : ""}
      </p>
      {estado.fase === "listo" && <p className="sutil">{estado.mensaje}</p>}
    </section>
  );
}

function Ultimas({ agente, estado }: { agente: Agente; estado: EstadoAgente }) {
  const [aviso, setAviso] = useState<string | null>(null);
  // Confirmación en la misma lista (un window.confirm congelaría la cola).
  const [seguro, setSeguro] = useState<string | null>(null);
  async function otraVez(o: OrdenVista) {
    setSeguro(null);
    setAviso("Mandando otra vez…");
    const error = await agente.reimprimirLocal(o);
    setAviso(error ?? "Se mandó otra vez.");
  }
  return (
    <section className="tarjeta">
      <h2>Últimas órdenes en esta PC</h2>
      {estado.ultimas.length === 0 ? (
        <p className="sutil">Todavía no llega ninguna.</p>
      ) : (
        <ul className="lista" aria-label="Últimas órdenes">
          {estado.ultimas.map((o) => (
            <li key={`${o.id}-${o.cuandoMs}`} data-estado={o.estado}>
              <div>
                <b>{o.tipo === "etiquetas_lote" ? "Etiquetas de lote" : "Etiquetas de precio"}</b> · {o.etiquetas} ·{" "}
                {new Date(o.cuandoMs).toLocaleString("es-MX")}
                {o.quien ? ` · ${o.quien}` : ""}
                <div className="sutil">{o.detalle}</div>
                {o.estado === "error" && <div className="error">{o.error}</div>}
              </div>
              {o.estado === "impreso" &&
                (seguro === `${o.id}-${o.cuandoMs}` ? (
                  <span className="fila">
                    <span className="sutil">
                      ¿Otra vez {o.etiquetas} con los mismos números? (para un atasco de papel)
                    </span>
                    <button type="button" onClick={() => void otraVez(o)}>
                      Sí, otra vez
                    </button>
                    <button type="button" className="secundario" onClick={() => setSeguro(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" className="secundario" onClick={() => setSeguro(`${o.id}-${o.cuandoMs}`)}>
                    Otra vez aquí
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {aviso && <p className="sutil">{aviso}</p>}
    </section>
  );
}

function Desvincular({ agente }: { agente: Agente }) {
  const [seguro, setSeguro] = useState(false);
  return seguro ? (
    <span className="fila">
      <button type="button" className="peligro" onClick={() => void agente.desvincular().then(() => setSeguro(false))}>
        Sí, desvincular
      </button>
      <button type="button" className="secundario" onClick={() => setSeguro(false)}>
        No
      </button>
    </span>
  ) : (
    <button type="button" className="secundario" onClick={() => setSeguro(true)}>
      Desvincular esta PC
    </button>
  );
}

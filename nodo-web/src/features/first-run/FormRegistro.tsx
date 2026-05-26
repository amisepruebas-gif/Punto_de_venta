import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNodoSession } from "@/hooks/useNodoSession";
import {
  useRegistroNodo,
  type Sucursal,
  type NodoItem,
} from "./useRegistroNodo";

type Step = "loading" | "elegir-sucursal" | "nueva-sucursal" | "datos-nodo" | "rebind";

export function FormRegistro() {
  const navigate = useNavigate();
  const { setSession } = useNodoSession();
  const r = useRegistroNodo();

  const [step, setStep] = useState<Step>("loading");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalElegida, setSucursalElegida] = useState<string | null>(null);

  // Nueva sucursal
  const [sucNombre, setSucNombre] = useState("");
  const [sucDireccion, setSucDireccion] = useState("");
  const [sucTelefono, setSucTelefono] = useState("");

  // Nodo
  const [nombreNodo, setNombreNodo] = useState("");
  const [registradoPor, setRegistradoPor] = useState("");

  // Rebind
  const [modoRebind, setModoRebind] = useState(false);
  const [nodos, setNodos] = useState<NodoItem[]>([]);
  const [nodoElegido, setNodoElegido] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await r.listarSucursales();
      setSucursales(s);
      setStep(s.length > 0 ? "elegir-sucursal" : "nueva-sucursal");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onElegirSucursal(sid: string) {
    setSucursalElegida(sid);
    if (modoRebind) {
      const ns = await r.listarNodos(sid);
      setNodos(ns);
      setStep("rebind");
    } else {
      setStep("datos-nodo");
    }
  }

  async function onGuardarNuevaSucursal() {
    if (!sucNombre.trim() || !sucDireccion.trim()) return;
    // La sucursal se crea dentro de registrarNodo — guardamos el flag y
    // pasamos al paso de datos del nodo.
    setSucursalElegida(null); // señal: crear nueva
    setStep("datos-nodo");
  }

  async function onRegistrar() {
    if (!nombreNodo.trim() || !registradoPor.trim()) return;

    const session = await r.registrar({
      sucursalId: sucursalElegida ?? undefined,
      nuevaSucursal: sucursalElegida
        ? undefined
        : {
            nombre: sucNombre.trim(),
            direccion: sucDireccion.trim(),
            telefono: sucTelefono.trim() || undefined,
          },
      nombreNodo: nombreNodo.trim(),
      registradoPor: registradoPor.trim(),
    });
    if (session) {
      setSession(session);
      navigate("/", { replace: true });
    }
  }

  async function onRebind() {
    if (!nodoElegido || !registradoPor.trim()) return;
    const elegido = nodos.find((n) => n.nodoId === nodoElegido);
    if (!elegido) return;
    const session = await r.rebind({
      nodoId: nodoElegido,
      registradoPor: registradoPor.trim(),
      nombreNodo: elegido.nombre,
    });
    if (session) {
      setSession(session);
      navigate("/", { replace: true });
    }
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando sucursales…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <header>
          <h1 className="text-2xl font-semibold">Amise — Nodo</h1>
          <p className="text-sm text-muted-foreground">
            {modoRebind
              ? "Vincular esta tablet a un nodo existente"
              : "Registra esta tablet como nuevo nodo"}
          </p>
        </header>

        {/* ---------- Elegir sucursal ---------- */}
        {step === "elegir-sucursal" && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Elige la sucursal</label>
            <div className="space-y-2">
              {sucursales.map((s) => (
                <button
                  key={s.sucursalId}
                  onClick={() => onElegirSucursal(s.sucursalId)}
                  className="flex w-full flex-col items-start rounded-md border bg-background p-3 text-left hover:bg-accent"
                >
                  <span className="font-medium">{s.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.direccion}
                  </span>
                </button>
              ))}
            </div>
            {!modoRebind && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("nueva-sucursal")}
              >
                + Nueva sucursal
              </Button>
            )}
            <button
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setModoRebind((v) => !v)}
            >
              {modoRebind
                ? "Prefiero registrar un nodo nuevo"
                : "Tablet recuperada — vincular a nodo existente"}
            </button>
          </div>
        )}

        {/* ---------- Nueva sucursal ---------- */}
        {step === "nueva-sucursal" && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Nueva sucursal</label>
            <Input
              placeholder="Nombre (ej. Tienda Central)"
              value={sucNombre}
              onChange={(e) => setSucNombre(e.target.value)}
            />
            <Input
              placeholder="Dirección"
              value={sucDireccion}
              onChange={(e) => setSucDireccion(e.target.value)}
            />
            <Input
              placeholder="Teléfono (opcional)"
              value={sucTelefono}
              onChange={(e) => setSucTelefono(e.target.value)}
            />
            <div className="flex gap-2">
              {sucursales.length > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("elegir-sucursal")}
                >
                  Atrás
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={onGuardarNuevaSucursal}
                disabled={!sucNombre.trim() || !sucDireccion.trim()}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* ---------- Datos del nodo ---------- */}
        {step === "datos-nodo" && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Datos del nodo</label>
            <Input
              placeholder="Nombre del nodo (ej. Caja 1)"
              value={nombreNodo}
              onChange={(e) => setNombreNodo(e.target.value)}
            />
            <Input
              placeholder="Quien registra"
              value={registradoPor}
              onChange={(e) => setRegistradoPor(e.target.value)}
            />
            {r.error && (
              <p className="text-sm text-destructive" role="alert">{r.error}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  setStep(sucursalElegida ? "elegir-sucursal" : "nueva-sucursal")
                }
              >
                Atrás
              </Button>
              <Button
                className="flex-1"
                onClick={onRegistrar}
                disabled={
                  r.loading || !nombreNodo.trim() || !registradoPor.trim()
                }
              >
                {r.loading ? "Registrando…" : "Registrar nodo"}
              </Button>
            </div>
          </div>
        )}

        {/* ---------- Rebind ---------- */}
        {step === "rebind" && (
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Elige el nodo existente a vincular
            </label>
            {nodos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay nodos activos en esta sucursal.
              </p>
            ) : (
              <div className="space-y-2">
                {nodos.map((n) => (
                  <label
                    key={n.nodoId}
                    className="flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 hover:bg-accent"
                  >
                    <input
                      type="radio"
                      name="nodo"
                      checked={nodoElegido === n.nodoId}
                      onChange={() => setNodoElegido(n.nodoId)}
                      className="mt-1"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{n.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        Registrado por {n.registradoPor}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <Input
              placeholder="Tu nombre (para el log)"
              value={registradoPor}
              onChange={(e) => setRegistradoPor(e.target.value)}
            />
            {r.error && (
              <p className="text-sm text-destructive" role="alert">{r.error}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("elegir-sucursal")}
              >
                Atrás
              </Button>
              <Button
                className="flex-1"
                onClick={onRebind}
                disabled={r.loading || !nodoElegido || !registradoPor.trim()}
              >
                {r.loading ? "Vinculando…" : "Vincular"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

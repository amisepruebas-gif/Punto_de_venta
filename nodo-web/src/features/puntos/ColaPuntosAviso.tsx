import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { esValorPuntos, necesitaAtencionPuntos } from "@shared";
import { useClientePuntos, type LlamadaPuntos } from "./clientePuntosStore";
import { reintentarAhoraPuntos } from "./usePuntosColaFlush";

const NOMBRES: Record<string, string> = {
  register: "Registrar cliente",
  earn: "Acumular cashback",
  card: "Ligar tarjeta de cashback",
  gift: "Activar tarjeta de regalo",
  giftRecarga: "Recargar tarjeta de regalo",
};

function detalle(item: LlamadaPuntos, ahora: number): string {
  const p = item.payload;
  const partes: string[] = [];
  const monto = Number(p.amount ?? p.denominacion);
  if (Number.isFinite(monto) && monto > 0) partes.push(`$${monto.toFixed(2)}`);
  const tel = String(p.phone ?? "").replace(/\D/g, "");
  if (tel.length >= 4) partes.push(`tel ••••${tel.slice(-4)}`);
  if (item.creadoEn) {
    const min = Math.max(0, Math.floor((ahora - item.creadoEn) / 60000));
    partes.push(
      min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.floor(min / 60)} h`
        : `hace ${Math.floor(min / 1440)} d`,
    );
  }
  return partes.join(" · ");
}

/**
 * Aviso en la cabecera de Ventas cuando hay cashback, tarjetas o regalos sin
 * enviar a amise: lo que lleva rato en la cola o lo que el servidor rechazó
 * (fallidos). Nada de eso se borra solo; aquí el cajero lo ve, lo reintenta o,
 * si ya lo resolvió de otra forma, lo quita.
 */
export function ColaPuntosAviso() {
  const cola = useClientePuntos((s) => s.cola);
  const fallidos = useClientePuntos((s) => s.fallidos);
  const [ahora, setAhora] = useState(() => Date.now());
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);

  useEffect(() => {
    const iv = window.setInterval(() => setAhora(Date.now()), 30000);
    return () => window.clearInterval(iv);
  }, []);

  const pendientes = cola.filter((x) => esValorPuntos(x.tipo));
  const atencion =
    pendientes.filter((x) => necesitaAtencionPuntos(x, ahora)).length + fallidos.length;
  if (atencion === 0 && !abierto) return null;

  async function reintentar() {
    setEnviando(true);
    try {
      await reintentarAhoraPuntos();
    } finally {
      setEnviando(false);
      setAhora(Date.now());
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAbierto(true)}
        aria-label={`Por enviar: ${atencion}`}
        className="relative"
      >
        <CloudUpload className="h-5 w-5 text-rose-600" />
        {atencion > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {atencion}
          </span>
        )}
      </Button>
      {abierto &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal
            aria-label="Por enviar"
          >
            <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-hidden rounded-t-xl bg-card p-5 shadow-lg sm:rounded-xl">
              <div>
                <h2 className="text-lg font-semibold">Por enviar</h2>
                <p className="text-sm text-muted-foreground">
                  Cashback, tarjetas y regalos que aún no llegan a amise. Se
                  reintentan solos; nada se borra sin que lo quites.
                </p>
              </div>
              <ul className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
                {fallidos.map((item) => (
                  <li key={item.id} className="rounded-md border border-rose-300 bg-rose-50 p-2.5 text-sm">
                    <p className="font-medium">{NOMBRES[item.tipo] ?? item.tipo}</p>
                    <p className="text-xs text-muted-foreground">{detalle(item, ahora)}</p>
                    <p className="text-xs text-rose-700">Rechazado: {item.ultimoError}</p>
                    {quitando === item.id ? (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="flex-1">¿Quitar? Ya no se enviará.</span>
                        <Button size="sm" variant="outline" onClick={() => setQuitando(null)}>
                          No
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            useClientePuntos.getState().quitarFallido(item.id);
                            setQuitando(null);
                          }}
                        >
                          Sí, quitar
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            useClientePuntos.getState().reintentarFallido(item.id);
                            void reintentar();
                          }}
                        >
                          Reintentar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setQuitando(item.id)}>
                          Quitar
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
                {pendientes.map((item) => (
                  <li key={item.id} className="rounded-md border p-2.5 text-sm">
                    <p className="font-medium">{NOMBRES[item.tipo] ?? item.tipo}</p>
                    <p className="text-xs text-muted-foreground">{detalle(item, ahora)}</p>
                    {item.ultimoError && (
                      <p className="text-xs text-amber-700">
                        {item.intentos} intento{item.intentos === 1 ? "" : "s"} · {item.ultimoError}
                      </p>
                    )}
                  </li>
                ))}
                {fallidos.length === 0 && pendientes.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    Todo enviado.
                  </li>
                )}
              </ul>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setAbierto(false);
                    setQuitando(null);
                  }}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={enviando || pendientes.length === 0}
                  onClick={() => void reintentar()}
                >
                  {enviando ? "Enviando…" : "Reintentar ahora"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

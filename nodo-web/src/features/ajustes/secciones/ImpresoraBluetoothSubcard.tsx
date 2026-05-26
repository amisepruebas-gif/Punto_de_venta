import { useEffect, useState } from "react";
import { Bluetooth, RefreshCw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getEstado,
  imprimirTicket,
  listarImpresorasBluetooth,
  seleccionarImpresoraBluetooth,
  type ImpresoraBluetooth,
} from "@/lib/pos-bridge";

/**
 * Subsección de configuración de la impresora Bluetooth (tickets ESC/POS).
 * Lista las impresoras emparejadas en el sistema, permite elegir una, y
 * permite mandar un ticket de prueba.
 */
export function ImpresoraBluetoothSubcard() {
  const [lista, setLista] = useState<ImpresoraBluetooth[]>([]);
  const [seleccionadaMac, setSeleccionadaMac] = useState<string | null>(null);
  const [conectada, setConectada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [resultadoTest, setResultadoTest] = useState<string | null>(null);

  function refrescar() {
    setLoading(true);
    setError(null);
    const r = listarImpresorasBluetooth();
    if (r.ok) {
      setLista(r.data.dispositivos);
    } else {
      setError(r.error);
      setLista([]);
    }
    const s = getEstado();
    if (s.ok && s.data.impresoraBT) {
      setSeleccionadaMac(s.data.impresoraBT.mac ?? null);
      setConectada(!!s.data.impresoraBT.conectada);
    }
    setLoading(false);
  }

  useEffect(() => {
    refrescar();
  }, []);

  function elegir(mac: string) {
    setError(null);
    const r = seleccionarImpresoraBluetooth(mac);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSeleccionadaMac(mac);
  }

  async function pruebaImpresion() {
    setImprimiendo(true);
    setResultadoTest(null);
    setError(null);
    const ahora = new Date().toLocaleString();
    const formato =
      "[C]<u><font size='big'>PRUEBA</font></u>\n" +
      "[C]Amise POS\n" +
      "[L]\n" +
      `[L]Fecha: ${ahora}\n` +
      "[L]Si lees esto, la impresora\n" +
      "[L]Bluetooth funciona correctamente.\n" +
      "[L]\n" +
      "[C]----------------\n";
    const r = await imprimirTicket({ formato });
    if (r.ok) {
      setResultadoTest("✓ Imprimió correctamente");
    } else {
      setResultadoTest(null);
      setError(r.error);
    }
    setImprimiendo(false);
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Bluetooth className="h-3.5 w-3.5 text-blue-600" />
          Impresora Bluetooth (tickets)
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refrescar}
          disabled={loading}
          aria-label="Refrescar"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {error && (
        <p className="mb-2 rounded bg-destructive/10 p-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {loading
            ? "Cargando…"
            : "No hay impresoras emparejadas. Empareja la impresora desde Ajustes de Bluetooth del Android, luego refresca."}
        </p>
      ) : (
        <ul className="space-y-1">
          {lista.map((p) => {
            const activa = p.mac === seleccionadaMac;
            return (
              <li key={p.mac}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent ${
                    activa ? "bg-accent/50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="impresora-bt"
                    checked={activa}
                    onChange={() => elegir(p.mac)}
                    className="h-3.5 w-3.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nombre || "(sin nombre)"}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {p.mac}
                    </p>
                  </div>
                  {activa && conectada && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                      conectada
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {seleccionadaMac && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={pruebaImpresion}
            disabled={imprimiendo}
            className="flex-1"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            {imprimiendo ? "Imprimiendo…" : "Imprimir ticket de prueba"}
          </Button>
        </div>
      )}

      {resultadoTest && (
        <p className="mt-2 text-xs text-emerald-700">{resultadoTest}</p>
      )}
    </div>
  );
}

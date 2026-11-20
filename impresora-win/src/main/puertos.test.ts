import { describe, expect, it } from "vitest";
import { IMPRESION_MAX_ERROR } from "@shared";
import type { DiagnosticoPuerto, PuertoUsb, ResultadoImpresion } from "../compartido/api";
import {
  conDiagnostico,
  diagnosticarPuerto,
  limpiarNombreArchivo,
  lineasPonerEnLinea,
  mensajeErrorRaw,
  mensajeOrdenPuerto,
  modeloDe,
  parsearPuertos,
  psq,
  resultadoRaw,
} from "./puertos";

// Lo que dio el script en la PC del taller el 20-nov: el cable se cambió de
// puerto y Windows le dio USB006; "Etiquetas AMISE" se quedó en USB005.
const PC_TALLER = JSON.stringify({
  puertos: ["USB001", "USB002", "USB005", "USB006"],
  impresoras: [
    { nombre: "Etiquetas AMISE", puerto: "USB005" },
    { nombre: "Microsoft Print to PDF", puerto: "PORTPROMPT:" },
  ],
  dispositivos: [
    { puerto: "USB006", descripcion: "UnknownPrinter", conectada: true, instancia: "USB\\VID_1FC9&PID_2016\\5&6096c15&0&2" },
    { puerto: "USB005", descripcion: "UnknownPrinter", conectada: false, instancia: "USB\\VID_1FC9&PID_2016\\6&33c77d33&1&2" },
  ],
});

// La misma PC a las 3 pm: ya con "Usar USB006", pero Windows dejó "Etiquetas
// AMISE" en "Usar impresora sin conexión" (y así guarda las órdenes).
const PC_TALLER_3PM = JSON.stringify({
  puertos: ["USB001", "USB002", "USB005", "USB006"],
  impresoras: [
    { nombre: "Etiquetas AMISE", puerto: "USB006", sinConexion: true },
    { nombre: "Microsoft Print to PDF", puerto: "PORTPROMPT:", sinConexion: false },
  ],
  dispositivos: [
    { puerto: "USB006", descripcion: "UnknownPrinter", conectada: true, instancia: "USB\\VID_1FC9&PID_2016\\5&6096c15&0&2" },
    { puerto: "USB005", descripcion: "UnknownPrinter", conectada: false, instancia: "USB\\VID_1FC9&PID_2016\\6&33c77d33&1&2" },
  ],
});

const usb = (puerto: string, x: Partial<PuertoUsb> = {}): PuertoUsb => ({ puerto, impresoras: [], ...x });
const ETIQ = "VID_1FC9&PID_2016";
const EPSON = "VID_04B8&PID_1234";

describe("puertos USB de impresora", () => {
  it("junta cada puerto con su aparato y las impresoras que lo usan", () => {
    const json = JSON.stringify({
      puertos: ["USB002", "USB001", "LPT1"],
      impresoras: [
        { nombre: "EPSON L8160", puerto: "USB001" },
        { nombre: "Microsoft Print to PDF", puerto: "PORTPROMPT:" },
      ],
      dispositivos: [
        { puerto: "USB001", descripcion: "EPSON L8160 Series" },
        { puerto: "USB002", descripcion: " XP-365B " },
      ],
    });
    expect(parsearPuertos(json)).toEqual([
      { puerto: "USB001", dispositivo: "EPSON L8160 Series", impresoras: ["EPSON L8160"] },
      { puerto: "USB002", dispositivo: "XP-365B", impresoras: [] },
    ]);
  });

  it("pone primero el puerto con la impresora conectada ahora (los viejos al final)", () => {
    // Como en la PC del taller: USB001 y USB002 sin nada; la de etiquetas en USB005.
    const json = JSON.stringify({
      puertos: ["USB001", "USB002", "USB005"],
      impresoras: [{ nombre: "Etiquetas AMISE", puerto: "USB001" }],
      dispositivos: [
        { puerto: "USB002", descripcion: "Vieja", conectada: false },
        { puerto: "USB005", descripcion: "Otra vieja", conectada: false },
        { puerto: "USB005", descripcion: "UnknownPrinter", conectada: true },
      ],
    });
    expect(parsearPuertos(json)).toEqual([
      { puerto: "USB005", dispositivo: "UnknownPrinter", conectada: true, impresoras: [] },
      { puerto: "USB001", impresoras: ["Etiquetas AMISE"] },
      { puerto: "USB002", dispositivo: "Vieja", impresoras: [] },
    ]);
  });

  it("aguanta lo raro de ConvertTo-Json: un solo objeto, nulos, BOM y basura", () => {
    const uno = "\uFEFF" + JSON.stringify({
      puertos: "USB003",
      impresoras: { nombre: "Etiquetas AMISE", puerto: "USB003" },
      dispositivos: null,
    });
    expect(parsearPuertos(uno)).toEqual([{ puerto: "USB003", impresoras: ["Etiquetas AMISE"] }]);
    expect(parsearPuertos("")).toEqual([]);
    expect(parsearPuertos("no es json")).toEqual([]);
    expect(parsearPuertos(JSON.stringify({ puertos: ["USB001", "USB001"] }))).toEqual([
      { puerto: "USB001", impresoras: [] },
    ]);
  });
});

describe("la impresora cambió de puerto USB", () => {
  it("lee el modelo de cada puerto (VID/PID) sin el lugar", () => {
    expect(modeloDe("USB\\VID_1fc9&PID_2016\\5&6096c15&0&2")).toBe(ETIQ);
    expect(modeloDe("")).toBeUndefined();
    expect(modeloDe(null)).toBeUndefined();
    expect(modeloDe("ROOT\\algo")).toBeUndefined();
    expect(parsearPuertos(PC_TALLER)).toEqual([
      { puerto: "USB006", dispositivo: "UnknownPrinter", modelo: ETIQ, modelos: [ETIQ], conectada: true, impresoras: [] },
      { puerto: "USB001", impresoras: [] },
      { puerto: "USB002", impresoras: [] },
      { puerto: "USB005", dispositivo: "UnknownPrinter", modelos: [ETIQ], impresoras: ["Etiquetas AMISE"] },
    ]);
  });

  it("una impresora en grupo usa todos sus puertos y no se revisa", () => {
    const grupo = parsearPuertos(
      JSON.stringify({
        puertos: ["USB003", "USB004", "USB006"],
        impresoras: [{ nombre: "Grupo", puerto: "USB003, USB004" }, { nombre: "Etiquetas AMISE", puerto: "USB006" }],
        dispositivos: [
          { puerto: "USB003", conectada: true, instancia: `USB\\${ETIQ}\\1` },
          { puerto: "USB006", conectada: false, instancia: `USB\\${ETIQ}\\2` },
        ],
      }),
    );
    expect(grupo.find((p) => p.puerto === "USB004")?.impresoras).toEqual(["Grupo"]);
    expect(diagnosticarPuerto("Grupo", grupo)).toEqual({ tipo: "bien" });
    // Y un puerto del grupo no está libre para "Etiquetas AMISE".
    expect(diagnosticarPuerto("Etiquetas AMISE", grupo)).toEqual({ tipo: "sin_usb", puerto: "USB006" });
  });

  it('como en la PC del taller a las 3 pm: ya en USB006, pero Windows la tiene "sin conexión"', () => {
    const p = parsearPuertos(PC_TALLER_3PM);
    expect(p.find((x) => x.puerto === "USB006")).toEqual({
      puerto: "USB006",
      dispositivo: "UnknownPrinter",
      modelo: ETIQ,
      modelos: [ETIQ],
      conectada: true,
      impresoras: ["Etiquetas AMISE"],
      sinConexion: ["Etiquetas AMISE"],
    });
    expect(diagnosticarPuerto("Etiquetas AMISE", p)).toEqual({ tipo: "sin_conexion", puerto: "USB006" });
    // En línea: bien.
    const enLinea = PC_TALLER_3PM.replace('"sinConexion":true', '"sinConexion":false');
    expect(diagnosticarPuerto("Etiquetas AMISE", parsearPuertos(enLinea))).toEqual({ tipo: "bien" });
  });

  it('fuera de su puerto, primero se arregla el puerto ("Usar USB006" también la pone en línea)', () => {
    const p = parsearPuertos(PC_TALLER.replace('"puerto":"USB005"}', '"puerto":"USB005","sinConexion":true}'));
    expect(p.find((x) => x.puerto === "USB005")?.sinConexion).toEqual(["Etiquetas AMISE"]);
    expect(diagnosticarPuerto("Etiquetas AMISE", p)).toEqual({ tipo: "otro_puerto", puerto: "USB005", conectado: "USB006" });
  });

  it("ponerla en línea: busca por nombre exacto, con comillas seguras, y revisa que sí quedó", () => {
    const l = lineasPonerEnLinea("Etiquetas de O'Brien").join("\n");
    expect(l).toContain("$_.Name -eq 'Etiquetas de O''Brien'");
    expect(l).toContain("Set-CimInstance -InputObject $imp -Property @{ WorkOffline = $false }");
    expect(l).toContain("$wmi.WorkOffline = $false; $null = $wmi.Put()");
    expect(l).toContain("throw 'Windows la dejó sin conexión.'");
    expect(l).toContain(`throw 'No encuentro la impresora "Etiquetas de O''Brien" en Windows.'`);
  });

  it("como en la PC del taller: la ve en USB006 y la impresora de Windows sigue en USB005", () => {
    expect(diagnosticarPuerto("Etiquetas AMISE", parsearPuertos(PC_TALLER))).toEqual({
      tipo: "otro_puerto",
      puerto: "USB005",
      conectado: "USB006",
    });
  });

  it("en su puerto, sin impresora elegida o sin puerto USB: no hay nada que decir", () => {
    const enSuPuerto = [usb("USB005", { modelo: ETIQ, conectada: true, impresoras: ["Etiquetas AMISE"] })];
    expect(diagnosticarPuerto("Etiquetas AMISE", enSuPuerto)).toEqual({ tipo: "bien" });
    const p = parsearPuertos(PC_TALLER);
    expect(diagnosticarPuerto("", p)).toEqual({ tipo: "bien" });
    expect(diagnosticarPuerto("Microsoft Print to PDF", p)).toEqual({ tipo: "bien" });
    expect(diagnosticarPuerto("No existe", p)).toEqual({ tipo: "bien" });
  });

  it("nunca propone otra impresora: otro modelo, o un puerto que ya usa otra impresora de Windows", () => {
    const suya = usb("USB005", { modelos: [ETIQ], impresoras: ["Etiquetas AMISE"] });
    // La de etiquetas está apagada y la EPSON sí está conectada en USB001.
    const conEpson = [usb("USB001", { modelo: EPSON, modelos: [EPSON], conectada: true, impresoras: ["EPSON L8160"] }), suya];
    expect(diagnosticarPuerto("Etiquetas AMISE", conEpson)).toEqual({ tipo: "sin_usb", puerto: "USB005" });
    // Otro modelo en un puerto sin impresora de Windows: tampoco es ella.
    const otroModelo = [usb("USB006", { modelo: EPSON, modelos: [EPSON], conectada: true }), suya];
    expect(diagnosticarPuerto("Etiquetas AMISE", otroModelo)).toEqual({ tipo: "sin_usb", puerto: "USB005" });
    // El mismo modelo (mismo chip, otra marca) que ya usa la de tickets: no se toca.
    const tickets = [usb("USB003", { modelo: ETIQ, modelos: [ETIQ], conectada: true, impresoras: ["POS-58"] }), suya];
    expect(diagnosticarPuerto("Etiquetas AMISE", tickets)).toEqual({ tipo: "sin_usb", puerto: "USB005" });
  });

  it("sin saber el modelo de su puerto, no adivina", () => {
    const libre = [usb("USB002", { impresoras: ["Etiquetas AMISE"] }), usb("USB004", { modelo: EPSON, modelos: [EPSON], conectada: true })];
    expect(diagnosticarPuerto("Etiquetas AMISE", libre)).toEqual({ tipo: "sin_usb", puerto: "USB002" });
  });

  it("si su puerto recuerda un aparato viejo de otro modelo, igual encuentra la suya (y no la de tickets)", () => {
    const p = parsearPuertos(
      JSON.stringify({
        puertos: ["USB003", "USB004", "USB006"],
        impresoras: [{ nombre: "Etiquetas AMISE", puerto: "USB003" }, { nombre: "Tickets", puerto: "USB004" }],
        dispositivos: [
          { puerto: "USB003", conectada: false, instancia: `USB\\${EPSON}\\viejo` },
          { puerto: "USB003", conectada: false, instancia: `USB\\${ETIQ}\\antes` },
          { puerto: "USB004", conectada: true, instancia: `USB\\${EPSON}\\tickets` },
          { puerto: "USB006", conectada: true, instancia: `USB\\${ETIQ}\\ahora` },
        ],
      }),
    );
    expect(p.find((x) => x.puerto === "USB003")?.modelos).toEqual([EPSON, ETIQ]);
    expect(diagnosticarPuerto("Etiquetas AMISE", p)).toEqual({ tipo: "otro_puerto", puerto: "USB003", conectado: "USB006" });
  });

  it("dos iguales conectadas en otros puertos: no adivina cuál es", () => {
    const dos = [
      usb("USB007", { modelo: ETIQ, conectada: true }),
      usb("USB006", { modelo: ETIQ, conectada: true }),
      usb("USB005", { modelos: [ETIQ], impresoras: ["Etiquetas AMISE"] }),
    ];
    expect(diagnosticarPuerto("Etiquetas AMISE", dos)).toEqual({
      tipo: "varios_puertos",
      puerto: "USB005",
      conectados: ["USB006", "USB007"],
    });
  });

  it("el error de la orden dice qué pasó y qué hacer, y cabe en la orden", () => {
    const casos: DiagnosticoPuerto[] = [
      { tipo: "otro_puerto", puerto: "USB005", conectado: "USB006" },
      { tipo: "varios_puertos", puerto: "USB005", conectados: ["USB006", "USB007"] },
      { tipo: "sin_usb", puerto: "USB005" },
      { tipo: "sin_conexion", puerto: "USB006" },
    ];
    expect(mensajeOrdenPuerto(casos[3]!)).toBe(
      'Windows tiene la impresora en "Usar impresora sin conexión" y no le manda nada. En la PC abre AMISE Impresora y toca "Ponerla en línea"; luego toca "Reimprimir".',
    );
    expect(mensajeOrdenPuerto(casos[0]!)).toBe(
      'La impresora se conectó en otro puerto USB de la PC (USB006) y Windows la sigue buscando en USB005. En la PC abre AMISE Impresora y toca "Usar USB006"; luego toca "Reimprimir".',
    );
    expect(mensajeOrdenPuerto(casos[1]!)).toMatch(/no está en su puerto USB \(USB005\).*elige el puerto/);
    expect(mensajeOrdenPuerto(casos[2]!)).toMatch(/^La PC no ve la impresora por USB: revisa que esté prendida/);
    expect(mensajeOrdenPuerto({ tipo: "bien" })).toBeNull();
    const atorada: ResultadoImpresion = {
      ok: false,
      noResponde: true,
      error: "x",
      detalle: "ERROR 9001 … estado 0x2 (error); NO se pudo quitar de la cola de Windows",
    };
    for (const d of casos) {
      const r = conDiagnostico(atorada, d);
      expect(!r.ok && r.error.length).toBeLessThanOrEqual(IMPRESION_MAX_ERROR);
      expect(!r.ok && r.error).toMatch(/Ojo: quedó esperando en Windows y puede salir sola\.$/);
    }
  });

  it("solo cambia el error cuando la impresora no respondió y su puerto está mal", () => {
    const noResponde = resultadoRaw("ERROR 9001 no respondió en 12 s; se quitó de la cola de Windows", "Etiquetas AMISE");
    const otro: DiagnosticoPuerto = { tipo: "otro_puerto", puerto: "USB005", conectado: "USB006" };
    expect(conDiagnostico(noResponde, otro)).toEqual({
      ...noResponde,
      error: mensajeOrdenPuerto(otro),
      puerto: otro,
    });
    // Puerto bien: el mismo error ("revisa que esté prendida, con etiquetas…"), con el diagnóstico.
    expect(conDiagnostico(noResponde, { tipo: "bien" })).toEqual({ ...noResponde, puerto: { tipo: "bien" } });
    // No se pudo revisar, imprimió u otro error: igual que antes.
    expect(conDiagnostico(noResponde, null)).toBe(noResponde);
    expect(conDiagnostico({ ok: true }, otro)).toEqual({ ok: true });
    const noExiste = resultadoRaw("ERROR 1801 OpenPrinter: no válido", "X");
    expect(conDiagnostico(noExiste, otro)).toBe(noExiste);
  });
});

describe("mensajes de raw-print.exe", () => {
  it("dice en español sencillo qué pasó", () => {
    expect(mensajeErrorRaw("ERROR 1801 OpenPrinter: El nombre de la impresora no es válido.", "Etiquetas AMISE")).toMatch(
      /No encuentro la impresora "Etiquetas AMISE"/,
    );
    expect(mensajeErrorRaw("ERROR 1804 StartDocPrinter: tipo de datos no válido", "PDF")).toMatch(/no acepta comandos directos/);
    expect(mensajeErrorRaw("ERROR 5 OpenPrinter: Acceso denegado.", "X")).toMatch(/permisos/);
    expect(mensajeErrorRaw("ERROR 31 WritePrinter: algo raro", "X")).toBe('Windows no pudo imprimir en "X": WritePrinter: algo raro');
    expect(mensajeErrorRaw("spawn ENOENT", "X")).toBe('Windows no pudo imprimir en "X": spawn ENOENT');
  });

  it("impresora apagada o desconectada: no responde, sin quedar en la cola", () => {
    const salida = "ERROR 9001 La impresora no respondió en 12 s, estado 0x12 (error imprimiendo); se quitó de la cola de Windows\r\n";
    const r = resultadoRaw(salida, "Etiquetas AMISE");
    expect(r).toEqual({
      ok: false,
      noResponde: true,
      error:
        'La impresora "Etiquetas AMISE" no respondió: revisa que esté prendida, con etiquetas y bien conectada, y toca "Reimprimir".',
      detalle: salida.trim(),
    });
    // Si Windows no dejó quitarla, se avisa que puede salir sola después.
    const atorada = resultadoRaw("ERROR 9001 … estado 0x2 (error); NO se pudo quitar de la cola de Windows", "X");
    expect(!atorada.ok && atorada.error).toMatch(/puede salir sola al prenderla/);
  });

  it("OK, cancelada en Windows y otros errores", () => {
    expect(resultadoRaw("OK\r\n", "X")).toEqual({ ok: true });
    const cancelada = resultadoRaw("ERROR 9002 Se canceló en la cola de Windows", "X");
    expect(cancelada).toMatchObject({ ok: false, error: 'Se canceló en la cola de Windows. Toca "Reimprimir" si hace falta.' });
    expect(cancelada).not.toHaveProperty("noResponde");
    expect(resultadoRaw("ERROR 1801 OpenPrinter: no válido", "X")).not.toHaveProperty("noResponde");
    expect(resultadoRaw("", "X")).toEqual({ ok: false, error: 'Windows no pudo imprimir en "X": error desconocido' });
  });
});

describe("utilidades", () => {
  it("comillas de PowerShell y nombres de archivo", () => {
    expect(psq("C:\\Users\\O'Brien\\a.ps1")).toBe("'C:\\Users\\O''Brien\\a.ps1'");
    expect(limpiarNombreArchivo("AMISE lote abc/123")).toBe("AMISE-lote-abc-123");
    expect(limpiarNombreArchivo("***")).toBe("trabajo");
  });
});

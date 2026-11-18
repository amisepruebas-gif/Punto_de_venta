import { describe, expect, it } from "vitest";
import { limpiarNombreArchivo, mensajeErrorRaw, parsearPuertos, psq } from "./puertos";

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
});

describe("utilidades", () => {
  it("comillas de PowerShell y nombres de archivo", () => {
    expect(psq("C:\\Users\\O'Brien\\a.ps1")).toBe("'C:\\Users\\O''Brien\\a.ps1'");
    expect(limpiarNombreArchivo("AMISE lote abc/123")).toBe("AMISE-lote-abc-123");
    expect(limpiarNombreArchivo("***")).toBe("trabajo");
  });
});

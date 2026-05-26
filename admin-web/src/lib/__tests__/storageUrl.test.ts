import { describe, expect, it } from "vitest";
import { canonicalStoragePath, parseStorageUrl } from "@shared";

/**
 * Tests del helper compartido `canonicalStoragePath` / `parseStorageUrl`.
 *
 * IMPORTANTE: el cache nativo (`ImageCache.java`) implementa la misma lógica
 * en Java y debe producir output idéntico para los mismos inputs. Si estos
 * tests cambian, hay que actualizar también el equivalente Java —
 * desincronización ≡ web y native indexan con keys distintas ≡ el GC no
 * funciona ≡ huérfanos vuelven.
 */

describe("parseStorageUrl — paridad TS↔Java", () => {
  it("URL válida con token → extrae canonicalPath y token", () => {
    const r = parseStorageUrl(
      "https://firebasestorage.googleapis.com/v0/b/amise-nodo.appspot.com/o/media_web_new_version%2Farticulos%2F123.webp?alt=media&token=abc-def",
    );
    expect(r).toEqual({
      canonicalPath:
        "amise-nodo.appspot.com/o/media_web_new_version%2Farticulos%2F123.webp",
      token: "abc-def",
    });
  });

  it("URL válida sin token → token=null", () => {
    const r = parseStorageUrl(
      "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/path%2Fa.webp?alt=media",
    );
    expect(r).toEqual({
      canonicalPath: "x.appspot.com/o/path%2Fa.webp",
      token: null,
    });
  });

  it("subvariación con código v-NN-XXX preserva el path completo", () => {
    const r = parseStorageUrl(
      "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/media_web_new_version%2Farticulos%2F123_v-01-XYZ.webp?alt=media&token=t1",
    );
    expect(r?.canonicalPath).toBe(
      "x.appspot.com/o/media_web_new_version%2Farticulos%2F123_v-01-XYZ.webp",
    );
  });

  it("chat_media path canónico", () => {
    const r = parseStorageUrl(
      "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/chat_media_web_new_version%2Fneg1%2Fnodo1%2Fh.webp?alt=media&token=t",
    );
    expect(r?.canonicalPath).toBe(
      "x.appspot.com/o/chat_media_web_new_version%2Fneg1%2Fnodo1%2Fh.webp",
    );
  });

  it("URL no-Firebase → null", () => {
    expect(parseStorageUrl("https://example.com/foo.webp?token=x")).toBeNull();
  });

  it("URL malformada → null", () => {
    expect(parseStorageUrl("not a url")).toBeNull();
  });

  it("string vacío → null", () => {
    expect(parseStorageUrl("")).toBeNull();
  });

  it("Firebase sin /o/ → null", () => {
    expect(
      parseStorageUrl(
        "https://firebasestorage.googleapis.com/v0/b/bucket/",
      ),
    ).toBeNull();
  });

  it("Firebase sin path tras /o/ → null", () => {
    expect(
      parseStorageUrl(
        "https://firebasestorage.googleapis.com/v0/b/bucket/o/",
      ),
    ).toBeNull();
  });

  it("Firebase con bucket vacío → null", () => {
    expect(
      parseStorageUrl(
        "https://firebasestorage.googleapis.com/v0/b//o/path.webp",
      ),
    ).toBeNull();
  });
});

describe("canonicalStoragePath — atajo", () => {
  it("retorna solo el path canónico", () => {
    expect(
      canonicalStoragePath(
        "https://firebasestorage.googleapis.com/v0/b/x/o/p.webp?alt=media&token=t",
      ),
    ).toBe("x/o/p.webp");
  });

  it("null para inputs inválidos", () => {
    expect(canonicalStoragePath("https://example.com/x")).toBeNull();
    expect(canonicalStoragePath("")).toBeNull();
  });
});

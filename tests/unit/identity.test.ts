import { describe, expect, it } from "vitest";
import { mintIdentityToken, tokenHash, verifyIdentityToken } from "@/lib/server/identity-token";
import { defaultDisplayName, sanitizeDisplayName } from "@/lib/server/names";

const SECRET = "secreto-de-pruebas-0123456789abcdef0123456789";

describe("identidad anónima", () => {
  it("emite tokens aleatorios firmados que el servidor puede verificar", () => {
    const a = mintIdentityToken(SECRET);
    const b = mintIdentityToken(SECRET);
    expect(a).not.toBe(b);
    expect(verifyIdentityToken(a, SECRET)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("rechaza tokens manipulados, inventados o firmados con otro secreto", () => {
    const token = mintIdentityToken(SECRET);
    const [v, random, sig] = token.split(".") as [string, string, string];
    const otherRandom = random.slice(0, -1) + (random.endsWith("A") ? "B" : "A");
    expect(verifyIdentityToken(`${v}.${otherRandom}.${sig}`, SECRET)).toBeNull();
    expect(verifyIdentityToken(`${v}.${random}.${sig.slice(0, -1)}x`, SECRET)).toBeNull();
    expect(verifyIdentityToken(token, "otro-secreto-0123456789abcdef0123456789abcd")).toBeNull();
    expect(verifyIdentityToken("jugador-123", SECRET)).toBeNull();
    expect(verifyIdentityToken(undefined, SECRET)).toBeNull();
  });

  it("guarda solo el hash del secreto", () => {
    const random = verifyIdentityToken(mintIdentityToken(SECRET), SECRET)!;
    expect(tokenHash(random)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash(random)).not.toContain(random);
  });
});

describe("nombre visible", () => {
  it("genera un nombre anónimo estable", () => {
    expect(defaultDisplayName("abc")).toBe(defaultDisplayName("abc"));
    expect(defaultDisplayName("abc")).toMatch(/^\S+ \S+ \d{2}$/u);
  });

  it("valida y limpia el nombre en el servidor", () => {
    expect(sanitizeDisplayName("  Lince   27 ")).toEqual({ ok: true, name: "Lince 27" });
    expect(sanitizeDisplayName("Ñandú_Veloz")).toEqual({ ok: true, name: "Ñandú_Veloz" });
    expect(sanitizeDisplayName("<script>alert(1)</script>").ok).toBe(false);
    expect(sanitizeDisplayName("x").ok).toBe(false);
    expect(sanitizeDisplayName("a".repeat(21)).ok).toBe(false);
    expect(sanitizeDisplayName("Hola‮mundo")).toEqual({ ok: true, name: "Holamundo" });
    expect(sanitizeDisplayName(42).ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ALPHABET, ROSCO_SIZE } from "@/lib/game/alphabet";
import { answerMatchesLetter, isCorrectAnswer, normalizeAnswer, sanitizeGivenAnswer } from "@/lib/game/normalize";

describe("alfabeto", () => {
  it("tiene las 27 letras del español, sin duplicados e incluye Ñ, K y W", () => {
    expect(ROSCO_SIZE).toBe(27);
    expect(new Set(ALPHABET).size).toBe(27);
    expect(ALPHABET).toContain("Ñ");
    expect(ALPHABET).toContain("K");
    expect(ALPHABET).toContain("W");
    expect(ALPHABET.indexOf("Ñ")).toBe(ALPHABET.indexOf("N") + 1);
  });
});

describe("normalizeAnswer", () => {
  it("ignora mayúsculas, espacios sobrantes y tildes", () => {
    expect(normalizeAnswer("  CAMIÓN  ")).toBe("camion");
    expect(normalizeAnswer("Pingüino")).toBe("pinguino");
    expect(normalizeAnswer("árbol   frutal")).toBe("arbol frutal");
  });

  it("conserva la Ñ y no la confunde con la N", () => {
    expect(normalizeAnswer("AÑO")).toBe("año");
    expect(normalizeAnswer("año")).not.toBe(normalizeAnswer("ano"));
    expect(isCorrectAnswer("ano", ["año"])).toBe(false);
    expect(isCorrectAnswer("AÑO", ["año"])).toBe(true);
  });

  it("convierte signos y guiones en espacios", () => {
    expect(normalizeAnswer("¡Walkie-talkie!")).toBe("walkie talkie");
  });
});

describe("isCorrectAnswer", () => {
  it("acepta la respuesta sin tilde y con mayúsculas", () => {
    expect(isCorrectAnswer("Murcielago", ["murciélago"])).toBe(true);
  });

  it("solo acepta variantes definidas explícitamente", () => {
    expect(isCorrectAnswer("güisqui", ["whisky"])).toBe(false);
    expect(isCorrectAnswer("güisqui", ["whisky", "güisqui"])).toBe(true);
  });

  it("tolera un artículo inicial y espacios internos", () => {
    expect(isCorrectAnswer("la montaña", ["montaña"])).toBe(true);
    expect(isCorrectAnswer("walkietalkie", ["walkie-talkie"])).toBe(true);
  });

  it("rechaza respuestas vacías o parecidas", () => {
    expect(isCorrectAnswer("", ["casa"])).toBe(false);
    expect(isCorrectAnswer("   ", ["casa"])).toBe(false);
    expect(isCorrectAnswer("casas", ["casa"])).toBe(false);
    expect(isCorrectAnswer("cas", ["casa"])).toBe(false);
  });
});

describe("answerMatchesLetter", () => {
  it("valida «empieza por» y «contiene»", () => {
    expect(answerMatchesLetter("Ñandú", "Ñ", "starts")).toBe(true);
    expect(answerMatchesLetter("nandu", "Ñ", "starts")).toBe(false);
    expect(answerMatchesLetter("Nube", "N", "starts")).toBe(true);
    expect(answerMatchesLetter("Ñu", "N", "starts")).toBe(false);
    expect(answerMatchesLetter("montaña", "Ñ", "contains")).toBe(true);
    expect(answerMatchesLetter("kiwi", "W", "contains")).toBe(true);
    expect(answerMatchesLetter("Árbol", "A", "starts")).toBe(true);
  });
});

describe("sanitizeGivenAnswer", () => {
  it("elimina caracteres de control y limita la longitud", () => {
    expect(sanitizeGivenAnswer("hola\u0000\n mundo")).toBe("hola mundo");
    expect(sanitizeGivenAnswer("x".repeat(500)).length).toBe(60);
  });
});

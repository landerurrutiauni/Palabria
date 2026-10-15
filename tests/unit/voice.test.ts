import { describe, expect, it } from "vitest";
import { interpretSpeech, promptSpeech } from "@/lib/client/voice";

describe("modo voz", () => {
  it("«Palabria» (y variantes que oye el reconocedor) pasa la letra", () => {
    for (const said of ["Palabria", "palabría", "Pala bria", "pasapalabra"]) {
      expect(interpretSpeech(said)).toEqual({ kind: "pass" });
    }
    expect(interpretSpeech("paso")).toEqual({ kind: "answer", text: "paso" });
    expect(interpretSpeech("paso", ["paso"])).toEqual({ kind: "pass" });
  });

  it("quita muletillas y artículos al principio, conserva tildes", () => {
    expect(interpretSpeech("es el cocodrilo")).toEqual({ kind: "answer", text: "cocodrilo" });
    expect(interpretSpeech("La respuesta es astronauta")).toEqual({ kind: "answer", text: "astronauta" });
    expect(interpretSpeech("Ñandú")).toEqual({ kind: "answer", text: "Ñandú" });
    expect(interpretSpeech("arco iris")).toEqual({ kind: "answer", text: "arco iris" });
    expect(interpretSpeech("   ")).toBeNull();
  });

  it("lee cada tipo de pregunta", () => {
    expect(promptSpeech({ kind: "rosco", index: 0, letter: "C", mode: "starts", definition: "Reptil." })).toBe(
      "Empieza por C. Reptil.",
    );
    expect(promptSpeech({ kind: "saying", index: 0, text: "A quien madruga, ___ le ayuda", hint: "" })).toContain(
      "Completa",
    );
    expect(promptSpeech({ kind: "link", index: 0, words: ["a", "b", "c", "d"], hint: "" })).toBe(
      "¿Qué palabra une a, b, c, d?",
    );
  });
});

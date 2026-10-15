/**
 * Alfabeto español completo de 27 letras (incluye Ñ, K y W).
 * El orden define el recorrido del rosco.
 */
// prettier-ignore
export const ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
  "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;

export type Letter = (typeof ALPHABET)[number];

export const ROSCO_SIZE = ALPHABET.length; // 27

export type LetterMode = "starts" | "contains";

export function isLetter(value: string): value is Letter {
  return (ALPHABET as readonly string[]).includes(value);
}

export function letterAt(index: number): Letter {
  const letter = ALPHABET[index];
  if (!letter) throw new Error(`Índice de letra fuera de rango: ${index}`);
  return letter;
}

export function letterModeLabel(mode: LetterMode): string {
  return mode === "starts" ? "Empieza por" : "Contiene la";
}

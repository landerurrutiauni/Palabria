import { fnv1a } from "@/lib/content/hash";

const ANIMALS = [
  "Lince", "Halcón", "Delfín", "Búho", "Zorro", "Tigre", "Puma", "Cóndor", "Nutria", "Koala",
  "Panda", "Lobo", "Gacela", "Orca", "Colibrí", "Jaguar", "Pingüino", "Erizo", "Ardilla", "Castor",
  "Bisonte", "Camaleón", "Flamenco", "Pelícano", "Tejón", "Quetzal", "Ñandú", "Kiwi", "Yak", "Lémur",
];
const ADJECTIVES = [
  "Veloz", "Audaz", "Sagaz", "Tenaz", "Feliz", "Valiente", "Brillante", "Elegante", "Paciente", "Capaz",
  "Genial", "Leal", "Ágil", "Firme", "Sereno",
];

/** Nombre anónimo predeterminado, estable para una identidad: «Lince Audaz 27». */
export function defaultDisplayName(seed: string): string {
  const h = fnv1a(seed);
  const animal = ANIMALS[h % ANIMALS.length]!;
  const adjective = ADJECTIVES[Math.floor(h / ANIMALS.length) % ADJECTIVES.length]!;
  const number = (Math.floor(h / 7919) % 90) + 10;
  return `${animal} ${adjective} ${number}`;
}

export const NAME_MIN = 2;
export const NAME_MAX = 20;

/**
 * Limpia y valida un nombre visible elegido por el jugador.
 * Solo letras, números, espacios y . _ - ; sin datos personales obligatorios.
 */
export function sanitizeDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Nombre no válido." };
  const name = raw
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < NAME_MIN) return { ok: false, error: `El nombre debe tener al menos ${NAME_MIN} caracteres.` };
  if (name.length > NAME_MAX) return { ok: false, error: `El nombre no puede superar ${NAME_MAX} caracteres.` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name)) {
    return { ok: false, error: "Usa solo letras, números, espacios, puntos, guiones o guiones bajos." };
  }
  return { ok: true, name };
}

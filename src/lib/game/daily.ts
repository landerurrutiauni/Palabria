/**
 * Fechas oficiales del desafío diario en la zona horaria Europe/Madrid.
 * Se calculan siempre con el reloj del servidor; la hora del navegador
 * nunca decide si alguien puede volver a jugar.
 */
export const CHALLENGE_TIME_ZONE = "Europe/Madrid";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHALLENGE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: number): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Desfase (ms) de Madrid respecto a UTC en un instante dado (+1 h o +2 h). */
export function madridOffsetMs(instant: number): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant / 1000) * 1000;
  return asUtc - truncated;
}

/** Fecha del desafío («YYYY-MM-DD») vigente en el instante indicado. */
export function challengeDateKey(instant: number): string {
  const p = zonedParts(instant);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Días transcurridos desde 1970-01-01 para una fecha «YYYY-MM-DD». */
export function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Instante UTC en que empieza (00:00 en Madrid) la fecha indicada. */
export function startOfChallengeDay(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const localMidnightAsUtc = Date.UTC(y, m - 1, d);
  // Dos iteraciones bastan: en España el cambio horario nunca ocurre a medianoche.
  let guess = localMidnightAsUtc - madridOffsetMs(localMidnightAsUtc);
  guess = localMidnightAsUtc - madridOffsetMs(guess);
  return guess;
}

/** Próximo cambio de desafío (siguiente medianoche en Madrid) a partir de `instant`. */
export function nextChallengeStart(instant: number): number {
  return startOfChallengeDay(addDays(challengeDateKey(instant), 1));
}

/** Fecha larga en español: «jueves, 15 de octubre de 2026». */
export function formatChallengeDate(dateKey: string, options: { weekday?: boolean } = {}): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const formatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: options.weekday === false ? undefined : "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formatter.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Error de aplicación con código HTTP y código estable para el cliente. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
}

export const Errors = {
  attemptUsed: (kind: "solo" | "duel") =>
    new AppError(
      409,
      kind === "solo" ? "solo_attempt_used" : "duel_attempt_used",
      kind === "solo"
        ? "Ya has usado tu intento individual de hoy. Vuelve mañana para el nuevo desafío."
        : "Ya has jugado tu duelo 1 vs 1 de hoy. Vuelve mañana para el nuevo desafío.",
    ),
  roomNotFound: () => new AppError(404, "room_not_found", "Esta sala no existe o el enlace no es correcto."),
  roomFull: () => new AppError(403, "room_full", "Esta sala ya tiene dos jugadores. Solo ellos pueden acceder."),
  roomExpired: () => new AppError(410, "room_expired", "Esta sala ha caducado."),
  notParticipant: () => new AppError(403, "not_participant", "No participas en esta sala."),
  ownRoom: () => new AppError(409, "own_room", "No puedes unirte como rival a tu propia sala."),
  badRequest: (message = "Petición no válida.") => new AppError(400, "bad_request", message),
};

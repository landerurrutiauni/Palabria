export type GameErrorCode =
  | "finished"
  | "not_your_turn"
  | "not_started"
  | "stale"
  | "time_up"
  | "invalid_action"
  | "not_playing";

const MESSAGES: Record<GameErrorCode, string> = {
  finished: "La partida ya ha terminado.",
  not_your_turn: "No es tu turno.",
  not_started: "La partida todavía no ha empezado.",
  stale: "Esa pregunta ya no está activa.",
  time_up: "Se ha agotado el tiempo.",
  invalid_action: "Acción no válida en este momento.",
  not_playing: "Ya no puedes seguir respondiendo.",
};

/** Error de reglas del juego: la acción se rechaza sin modificar el estado. */
export class GameRuleError extends Error {
  readonly code: GameErrorCode;
  constructor(code: GameErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.code = code;
    this.name = "GameRuleError";
  }
}

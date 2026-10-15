import { afterEach, describe, expect, it } from "vitest";
import { resetServerEnvCache, serverEnv, setChallengeSaltFallback } from "@/lib/server/env";

describe("semilla de los desafíos", () => {
  const original = process.env.CHALLENGE_SALT;
  afterEach(() => {
    if (original === undefined) delete process.env.CHALLENGE_SALT;
    else process.env.CHALLENGE_SALT = original;
    setChallengeSaltFallback(null);
    resetServerEnvCache();
  });

  it("usa la semilla de la base de datos si no hay CHALLENGE_SALT", () => {
    delete process.env.CHALLENGE_SALT;
    setChallengeSaltFallback("semilla-de-la-base-de-datos");
    expect(serverEnv().challengeSalt).toBe("semilla-de-la-base-de-datos");
  });

  it("la variable de entorno tiene prioridad", () => {
    process.env.CHALLENGE_SALT = "semilla-del-entorno";
    setChallengeSaltFallback("semilla-de-la-base-de-datos");
    expect(serverEnv().challengeSalt).toBe("semilla-del-entorno");
  });
});

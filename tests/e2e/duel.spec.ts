import { expect, test, type Page } from "@playwright/test";
import { answer, answers, clockSeconds, letter, today } from "./helpers";

async function clockOf(page: Page, who: "Tu reloj" | "Su reloj"): Promise<number> {
  const label = await page
    .getByRole("timer", { name: new RegExp(`^${who}`) })
    .first()
    .getAttribute("aria-label");
  return clockSeconds(label);
}

test("duelo 1 vs 1 entre dos navegadores: invitación, turnos, relojes, reconexión y resultado", async ({ browser }) => {
  const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const intruderCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  // 1. Crear sala (no consume el intento) y obtener el enlace privado.
  await host.goto("/duelo");
  await host.getByRole("button", { name: /Crear sala/ }).click();
  await host.waitForURL(/\/sala\/[A-Za-z0-9_-]{16}$/);
  const url = host.url();
  await expect(host.getByLabel("Enlace de invitación privado")).toHaveValue(url);
  const me = (await (await host.request.get("/api/me")).json()) as { attempts: { duel: { used: boolean } } };
  expect(me.attempts.duel.used).toBe(false);

  // 2. El invitado entra sin registrarse y acepta.
  await guest.goto(url);
  await expect(guest.getByRole("heading", { name: /te reta/ })).toBeVisible();
  await guest.getByRole("button", { name: "Aceptar el desafío" }).click();
  await expect(host.getByRole("button", { name: "¡Empezar duelo!" })).toBeVisible();

  // 3. Un tercero no puede entrar en la sala privada.
  const intruder = await intruderCtx.newPage();
  await intruder.goto(url);
  await expect(intruder.getByRole("heading", { name: "Esta sala es privada" })).toBeVisible();

  // 4. Empieza el duelo: intentos consumidos y sincronización en tiempo real.
  await host.getByRole("button", { name: "¡Empezar duelo!" }).click();
  await expect(guest.getByText("¡Tu turno!").first()).toBeVisible({ timeout: 10_000 });
  await expect(host.getByText(/Turno de/).first()).toBeVisible();
  await expect(host.getByLabel("Tu respuesta")).toBeDisabled();
  await expect(host.getByRole("button", { name: "Palabria" })).toBeDisabled();
  const meAfter = (await (await host.request.get("/api/me")).json()) as { attempts: { duel: { used: boolean } } };
  expect(meAfter.attempts.duel.used).toBe(true);

  const date = await today(guest);
  const guestAnswers = await answers(date, "duel_b", "rosco");
  const hostAnswers = await answers(date, "duel_a", "rosco");

  // Prueba D: el anfitrión intenta responder fuera de turno → el servidor lo rechaza.
  const code = url.split("/").pop()!;
  const outOfTurn = await host.request.post(`/api/rooms/${code}/action`, {
    data: { actionId: crypto.randomUUID(), action: { type: "answer", stage: 0, item: 0, text: hostAnswers[0] } },
  });
  expect(outOfTurn.status()).toBe(409);
  expect(((await outOfTurn.json()) as { error: { code: string } }).error.code).toBe("not_your_turn");

  // Prueba A: acierto → el invitado sigue y su reloj corre; el del anfitrión está parado.
  await answer(guest, guestAnswers[0]!);
  await expect(letter(guest, "Tu rosco", "A")).toHaveAttribute("data-state", "correct");
  await expect(guest.getByText("¡Tu turno!").first()).toBeVisible();
  const hostPaused1 = await clockOf(host, "Tu reloj");
  await guest.waitForTimeout(2200);
  expect(await clockOf(host, "Tu reloj")).toBe(hostPaused1);
  expect(await clockOf(guest, "Tu reloj")).toBeLessThan(25);

  // Prueba C: Palabria → el reloj del invitado se congela y arranca el del anfitrión.
  await guest.getByRole("button", { name: "Palabria" }).click();
  await expect(host.getByText("¡Tu turno!").first()).toBeVisible();
  const guestFrozen = await clockOf(guest, "Tu reloj");
  await expect(letter(guest, "Tu rosco", "B")).toHaveAttribute("data-state", "passed");
  await host.waitForTimeout(2200);
  expect(await clockOf(guest, "Tu reloj")).toBe(guestFrozen);
  expect(await clockOf(host, "Tu reloj")).toBeLessThan(hostPaused1);

  // Prueba E: el jugador activo recarga → mismo turno, reloj sin reiniciar.
  const hostBeforeReload = await clockOf(host, "Tu reloj");
  await host.reload();
  await expect(host.getByText("¡Tu turno!").first()).toBeVisible();
  expect(await clockOf(host, "Tu reloj")).toBeLessThanOrEqual(hostBeforeReload);

  // Prueba B: fallo → se detiene el reloj del anfitrión y vuelve el turno al invitado,
  // que retoma su tiempo congelado y su siguiente letra pendiente (la C).
  await answer(host, "respuestaincorrecta");
  await expect(host.getByText(`Era «${hostAnswers[0]}»`)).toBeVisible();
  await expect(guest.getByText("¡Tu turno!").first()).toBeVisible();
  expect(await clockOf(guest, "Tu reloj")).toBeLessThanOrEqual(guestFrozen);
  expect(await clockOf(guest, "Tu reloj")).toBeGreaterThanOrEqual(guestFrozen - 1);
  await expect(letter(guest, "Tu rosco", "C")).toHaveAttribute("data-state", "active");
  // El invitado no ve la solución de la letra fallada por su rival.
  await expect(guest.getByText(hostAnswers[0]!, { exact: true })).toHaveCount(0);

  // Prueba F: el invitado agota su tiempo (25 s) → turno al anfitrión, que sigue con el suyo.
  await expect(host.getByText("¡Tu turno!").first()).toBeVisible({ timeout: 40_000 });
  await expect(guest.getByText("Te has quedado sin tiempo").first()).toBeVisible();
  const late = await guest.request.post(`/api/rooms/${code}/action`, {
    data: { actionId: crypto.randomUUID(), action: { type: "pass", stage: 0, item: 2 } },
  });
  expect(late.status()).toBe(409);

  // Final: el anfitrión acierta y deja correr su reloj → resultado guardado.
  await answer(host, hostAnswers[1]!);
  await expect(host.getByRole("heading", { name: /Victoria|Derrota|Empate/ })).toBeVisible({ timeout: 40_000 });
  await expect(guest.getByRole("heading", { name: /Victoria|Derrota|Empate/ })).toBeVisible({ timeout: 10_000 });
  const guestMe = (await (await guest.request.get("/api/me")).json()) as {
    attempts: { duel: { used: boolean; status: string | null } };
  };
  expect(guestMe.attempts.duel.used).toBe(true);

  // Tras jugar, no se puede crear otra sala el mismo día.
  const again = await host.request.post("/api/rooms", { data: { mode: "rosco" } });
  expect(again.status()).toBe(409);

  await hostCtx.close();
  await guestCtx.close();
  await intruderCtx.close();
});

import { expect, test } from "@playwright/test";
import { answer, answers, clockSeconds, letter, today } from "./helpers";

test.describe("modo individual", () => {
  test("identidad anónima sin registro: cookie HttpOnly y portada con intentos", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Veintisiete letras/ })).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === "palabria_id");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    await expect(page.getByText("Juegas como")).toBeVisible();
    await expect(page.locator("input[type=password], input[type=email]")).toHaveCount(0);
    // Un identificador manipulado se rechaza y se sustituye por otro válido.
    await context.addCookies([{ name: "palabria_id", value: "v1.falso.falso", url: page.url() }]);
    const me = await page.request.get("/api/me");
    expect(me.ok()).toBe(true);
  });

  test("rosco: aciertos, fallos, palabria, recarga sin reiniciar y bloqueo del otro modo", async ({ page }) => {
    await page.goto("/jugar/rosco");
    await page.getByRole("button", { name: "¡Empezar!" }).click();
    const date = await today(page);
    const solutions = await answers(date, "solo", "rosco");

    await answer(page, solutions[0]!.toUpperCase());
    await expect(page.getByText("¡Correcto!")).toBeVisible();
    await expect(letter(page, "Tu rosco", "A")).toHaveAttribute("data-state", "correct");

    await answer(page, "respuestaincorrecta");
    await expect(page.getByText(`Era «${solutions[1]}»`)).toBeVisible();
    await expect(letter(page, "Tu rosco", "B")).toHaveAttribute("data-state", "wrong");

    await page.getByRole("button", { name: "Palabria" }).click();
    await expect(letter(page, "Tu rosco", "C")).toHaveAttribute("data-state", "passed");
    await expect(letter(page, "Tu rosco", "D")).toHaveAttribute("data-state", "active");

    const before = clockSeconds(await page.getByRole("timer").first().getAttribute("aria-label"));
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(letter(page, "Tu rosco", "A")).toHaveAttribute("data-state", "correct");
    await expect(letter(page, "Tu rosco", "C")).toHaveAttribute("data-state", "passed");
    const after = clockSeconds(await page.getByRole("timer").first().getAttribute("aria-label"));
    expect(after).toBeLessThan(before); // el reloj no se reinicia al recargar

    // El programa completo comparte el intento: bloqueado en la interfaz y en el servidor.
    await page.goto("/jugar/programa");
    await expect(page.getByRole("heading", { name: "Ya tienes una partida en curso" })).toBeVisible();
    const res = await page.request.post("/api/solo", { data: { mode: "program" } });
    expect(res.status()).toBe(409);

    // Fin del tiempo (25 s en el entorno de pruebas): resultado y soluciones.
    await page.goto("/jugar/rosco");
    await expect(page.getByText("Puntuación final")).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText("Soluciones del rosco")).toBeVisible();
    await expect(page.getByText(solutions[5]!, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Compartir resultado" })).toBeVisible();

    // La partida terminada no admite más respuestas.
    const session = (await (await page.request.get("/api/solo")).json()) as { session: { sessionId: string } };
    const late = await page.request.post("/api/solo/action", {
      data: {
        sessionId: session.session.sessionId,
        actionId: crypto.randomUUID(),
        action: { type: "pass", stage: 0, item: 3 },
      },
    });
    expect(late.status()).toBe(409);
  });

  test("la hora del navegador no cambia la fecha oficial ni devuelve intentos", async ({ page }) => {
    await page.goto("/jugar/rosco");
    await page.getByRole("button", { name: "¡Empezar!" }).click();
    await expect(page.getByLabel("Tu respuesta")).toBeEnabled();
    const date = await today(page);
    // Se adelanta el reloj del navegador una semana.
    await page.clock.setFixedTime(new Date(Date.now() + 7 * 86_400_000));
    await page.goto("/");
    await expect(page.getByText(/Desafío PAL-/)).toContainText(`PAL-${date.replace(/-/g, "")}`);
    await expect(page.getByRole("link", { name: "Continuar partida" }).first()).toBeVisible();
    const res = await page.request.post("/api/solo", { data: { mode: "program" } });
    expect(res.status()).toBe(409);
  });

  test("programa completo: pruebas jugables, puntos acumulados y rosco final", async ({ page }) => {
    await page.goto("/jugar/programa");
    await page.getByRole("button", { name: "¡Empezar!" }).click();
    const date = await today(page);
    const quick = await answers(date, "solo", "quick");
    const clues = await answers(date, "solo", "clues");
    const sayings = await answers(date, "solo", "saying");
    const links = await answers(date, "solo", "link");
    const rosco = await answers(date, "solo", "rosco");

    await expect(page.getByRole("heading", { name: "Palabras al vuelo" })).toBeVisible();
    await answer(page, quick[0]!);
    await expect(page.getByText("¡Correcto! +10 puntos")).toBeVisible();
    for (const a of quick.slice(1)) await answer(page, a);
    await expect(page.getByRole("heading", { name: "La pista justa" })).toBeVisible();
    await page.getByRole("button", { name: "Empezar prueba" }).click();
    await page.getByRole("button", { name: "Otra pista" }).click();
    await expect(page.getByText("Vale 30 puntos")).toBeVisible();
    await answer(page, clues[0]!);
    await page.getByRole("button", { name: "Paso" }).click();

    await page.getByRole("button", { name: "Empezar prueba" }).click();
    for (const a of sayings) await answer(page, a);
    await page.getByRole("button", { name: "Empezar prueba" }).click();
    for (const a of links) await answer(page, a);

    // Entreacto antes del rosco: 20 s base + segundos ganados (6×3 + 6 + 5×3 + 3×5).
    await expect(page.getByText(/Tu rosco: 1:14/)).toBeVisible();
    await page.getByRole("button", { name: "Empezar prueba" }).click();
    for (let i = 0; i < 27; i++) await answer(page, rosco[i]!);
    await expect(page.getByRole("heading", { name: "¡Rosco perfecto!" })).toBeVisible();
    await expect(page.getByText("225 de las pruebas", { exact: false })).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { answer, answers, letter } from "../e2e/helpers";

const BASE = "/Pasapalabra";
const API = "http://localhost:3301";

async function today(): Promise<string> {
  const res = await fetch(`${API}/health`);
  return ((await res.json()) as { today: string }).today;
}

test("Pages: identidad anónima sin cookies, rosco individual, historial y clasificación", async ({ page, context }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByRole("heading", { name: /Veintisiete letras/ })).toBeVisible();
  await expect(page.getByText("Juegas como")).toBeVisible();
  expect(await context.cookies()).toHaveLength(0);
  const identity = await page.evaluate(() => window.localStorage.getItem("palabria-dev-identity"));
  expect(identity).toMatch(/^dev\./);

  // La navegación interna conserva el prefijo del repositorio.
  await page.getByRole("link", { name: "Jugar", exact: true }).first().click();
  await expect(page).toHaveURL(`${BASE}/jugar/`);
  await page.goto(`${BASE}/jugar/rosco/`);
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  const solutions = await answers(await today(), "solo", "rosco");

  await answer(page, solutions[0]!.toUpperCase());
  await expect(page.getByText("¡Correcto!")).toBeVisible();
  await page.getByRole("button", { name: "Pasapalabra" }).click();
  await expect(letter(page, "Tu rosco", "B")).toHaveAttribute("data-state", "passed");

  // Recargar recupera la partida del servidor.
  await page.reload();
  await expect(letter(page, "Tu rosco", "A")).toHaveAttribute("data-state", "correct");
  await expect(letter(page, "Tu rosco", "B")).toHaveAttribute("data-state", "passed");

  // El intento individual es compartido entre modos.
  await page.goto(`${BASE}/jugar/programa/`);
  await expect(page.getByRole("heading", { name: "Ya tienes una partida en curso" })).toBeVisible();

  await page.goto(`${BASE}/jugar/rosco/`);
  await expect(page.getByText("Puntuación final")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Soluciones del rosco")).toBeVisible();

  await page.goto(`${BASE}/historial/`);
  await page.getByRole("link", { name: /individual, Solo El Rosco/ }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/historial/ver/\\?id=`));
  await expect(page.getByText("Soluciones del rosco")).toBeVisible();

  await page.goto(`${BASE}/clasificacion/?modo=rosco`);
  await expect(page.getByRole("heading", { name: "Los mejores del día" })).toBeVisible();

  // Las preferencias se guardan en el servidor y se aplican al recargar.
  await page.goto(`${BASE}/ajustes/`);
  await page.getByText("Texto más grande", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text", "large");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text", "large");
  await expect(page.getByRole("switch", { name: /Texto más grande/ })).toBeChecked();
});

test("Pages: duelo 1 vs 1 por enlace de invitación entre dos navegadores", async ({ browser }) => {
  const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const intruderCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  await host.goto(`${BASE}/duelo/`);
  await host.getByRole("button", { name: /Crear sala/ }).click();
  await host.waitForURL(new RegExp(`${BASE}/sala/\\?c=[A-Za-z0-9_-]{16}$`));
  const url = host.url();
  await expect(host.getByLabel("Enlace de invitación privado")).toHaveValue(url);

  await guest.goto(url);
  await expect(guest.getByRole("heading", { name: /te reta/ })).toBeVisible();
  await guest.getByRole("button", { name: "Aceptar el desafío" }).click();
  await expect(host.getByRole("button", { name: "¡Empezar duelo!" })).toBeVisible();

  const intruder = await intruderCtx.newPage();
  await intruder.goto(url);
  await expect(intruder.getByRole("heading", { name: "Esta sala es privada" })).toBeVisible();

  await host.getByRole("button", { name: "¡Empezar duelo!" }).click();
  await expect(guest.getByText("¡Tu turno!").first()).toBeVisible({ timeout: 10_000 });
  await expect(host.getByLabel("Tu respuesta")).toBeDisabled();

  const date = await today();
  const guestAnswers = await answers(date, "duel_b", "rosco");
  await answer(guest, guestAnswers[0]!);
  await expect(letter(guest, "Tu rosco", "A")).toHaveAttribute("data-state", "correct");
  await guest.getByRole("button", { name: "Pasapalabra" }).click();
  // Sin Realtime (servidor de desarrollo) el anfitrión se entera por sondeo.
  await expect(host.getByText("¡Tu turno!").first()).toBeVisible({ timeout: 10_000 });
  await expect(host.getByLabel("Tu respuesta")).toBeEnabled();

  await hostCtx.close();
  await guestCtx.close();
  await intruderCtx.close();
});

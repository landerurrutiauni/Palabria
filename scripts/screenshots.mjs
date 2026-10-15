/**
 * Capturas de las pantallas principales para revisar el diseño.
 *   node scripts/screenshots.mjs <base-url> <carpeta-salida>
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();

async function shoot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

for (const [label, viewport] of [
  ["desktop", { width: 1280, height: 860 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  await shoot(page, `${label}-home`);
  await page.goto(`${base}/jugar/rosco`);
  await page.getByRole("button", { name: "¡Empezar!" }).click();
  await page.getByLabel("Tu respuesta").fill("prueba");
  await page.getByLabel("Tu respuesta").press("Enter");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Pasapalabra" }).click();
  await shoot(page, `${label}-rosco`);
  await page.goto(`${base}/duelo`);
  await shoot(page, `${label}-duelo`);
  await ctx.close();
}

// Duelo en curso entre dos navegadores.
const host = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await host.goto(`${base}/duelo`);
await host.getByRole("button", { name: /Crear sala/ }).click();
await host.waitForURL(/sala/);
await shoot(host, "desktop-sala-espera");
await guest.goto(host.url());
await shoot(guest, "mobile-invitacion");
await guest.getByRole("button", { name: "Aceptar el desafío" }).click();
await host.getByRole("button", { name: "¡Empezar duelo!" }).click();
await guest.getByText("¡Tu turno!").first().waitFor({ timeout: 15000 });
await shoot(host, "desktop-duelo-espera-turno");
await shoot(guest, "mobile-duelo-mi-turno");
await browser.close();
console.log("capturas en", out);

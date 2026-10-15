import { expect, test } from "@playwright/test";
import { answers, letter, today } from "./helpers";

/**
 * Modo voz con la Web Speech API simulada: la «voz» termina enseguida y el
 * «micrófono» devuelve lo que la prueba deja en window.__said.
 */
test("modo voz: se lee la pregunta, se responde hablando y «Palabria» pasa la letra", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __said: string[]; __spoken: string[] };
    w.__said = [];
    w.__spoken = [];
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak(u: { text: string; onend?: () => void }) {
          w.__spoken.push(u.text);
          setTimeout(() => u.onend?.(), 30);
        },
        cancel() {},
        getVoices: () => [],
      },
    });
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      private timer = 0;
      start() {
        this.timer = window.setTimeout(() => {
          const said = w.__said.shift();
          if (said) this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: said } }] });
          else this.onend?.();
        }, 120);
      }
      stop() {
        window.clearTimeout(this.timer);
      }
      abort() {
        window.clearTimeout(this.timer);
      }
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });

  await page.goto("/jugar/rosco");
  await page.getByRole("switch", { name: /Jugar con voz/ }).click();
  await expect(page.getByRole("switch", { name: /Voz activada/ })).toBeVisible();
  const solutions = await answers(await today(page), "solo", "rosco");
  await page.evaluate(
    (said) => {
      (window as unknown as { __said: string[] }).__said.push(said[0]!, "Palabria");
    },
    [`es ${solutions[0]}`],
  );
  await page.getByRole("button", { name: "¡Empezar!" }).click();

  await expect(letter(page, "Tu rosco", "A")).toHaveAttribute("data-state", "correct", { timeout: 15_000 });
  await expect(letter(page, "Tu rosco", "B")).toHaveAttribute("data-state", "passed", { timeout: 15_000 });
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken[0]).toMatch(/^(Empieza por|Contiene la) A\. /);
});

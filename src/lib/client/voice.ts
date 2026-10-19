"use client";

/**
 * Modo voz con la Web Speech API del navegador:
 *  - Síntesis: una voz en español lee la pregunta.
 *  - Reconocimiento: el jugador responde hablando; «Palabria» pasa la letra.
 * El navegador solo transcribe: la respuesta se envía como texto y el
 * servidor la valida igual que si se hubiera escrito.
 */
import { letterModeLabel } from "@/lib/game/alphabet";
import type { PromptView } from "@/lib/views";

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceSupport(): { speak: boolean; listen: boolean } {
  if (typeof window === "undefined") return { speak: false, listen: false };
  return { speak: "speechSynthesis" in window, listen: recognitionCtor() !== null };
}

function spanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "es-ES") ?? voices.find((v) => v.lang.toLowerCase().startsWith("es")) ?? null;
}

/** Lee un texto en voz alta. Se resuelve al terminar (o si falla o se cancela). */
export function speak(text: string): Promise<void> {
  if (!voiceSupport().speak || !text) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    const voice = spanishVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    // Algunos navegadores no avisan del final: límite de seguridad.
    window.setTimeout(finish, 1_500 + text.length * 90);
    synth.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (voiceSupport().speak) window.speechSynthesis.cancel();
}

/** Texto que se lee para cada tipo de pregunta. */
export function promptSpeech(prompt: PromptView): string {
  switch (prompt.kind) {
    case "rosco":
      return `${letterModeLabel(prompt.mode)} ${prompt.letter}. ${prompt.definition}`;
    case "quick":
      return prompt.definition;
    case "clues":
      return `Pistas: ${prompt.clues.join(". ")}`;
    case "saying":
      return `Completa: ${prompt.text.replace(/_{2,}/g, "…")}`;
    case "link":
      return `¿Qué palabra une ${prompt.words.join(", ")}?`;
  }
}

function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PASS_WORDS = new Set(["palabria", "pala bria", "palabra ria", "palabrea", "pasapalabra", "pasa palabra"]);
const FILLERS = /^(es|son|seria|la respuesta es|respuesta|creo que es|creo que|pues|eh|el|la|los|las|un|una)\s+/;

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** El reconocedor no conoce «Palabria»: acepta lo que suena parecido (palabra, palabras, Valeria, pala bría…). */
function soundsLikePass(text: string): boolean {
  const joined = text.replace(/\s+/g, "");
  if (text.split(" ").length > 3) return false;
  if (/^(palabr|pasapalabr)/.test(joined) || /bria$|bria /.test(text)) return true;
  return distance(joined, "palabria") <= 3 || ["valeria", "palabras", "palabra"].includes(joined);
}

export type SpokenAnswer = { kind: "pass" } | { kind: "answer"; text: string };

/** Interpreta lo dicho: palabra para pasar o respuesta (sin muletillas ni artículos iniciales). */
export function interpretSpeech(transcript: string, extraPassWords: string[] = []): SpokenAnswer | null {
  let text = plain(transcript);
  if (!text) return null;
  if (PASS_WORDS.has(text) || extraPassWords.includes(text) || soundsLikePass(text)) return { kind: "pass" };
  for (let i = 0; i < 3; i++) {
    const next = text.replace(FILLERS, "");
    if (next === text || !next) break;
    text = next;
  }
  // Se conserva la forma original (con tildes) de las palabras que quedan.
  const words = transcript.trim().split(/\s+/);
  const kept = words.slice(words.length - text.split(" ").length).join(" ");
  return { kind: "answer", text: kept || text };
}

export interface Listener {
  stop(): void;
}

/**
 * Escucha una respuesta. `onText` recibe la transcripción provisional y
 * `onFinal` la definitiva; `onEnd` avisa cuando el micrófono se cierra.
 */
export function listen(handlers: {
  onText: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}): Listener | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "es-ES";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let stopped = false;
  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      if (result.isFinal) {
        handlers.onFinal(result[0].transcript);
        return;
      }
      interim += result[0].transcript;
    }
    handlers.onText(interim);
  };
  rec.onerror = (event) => {
    if (!stopped) handlers.onError(event.error);
  };
  rec.onend = () => {
    if (!stopped) handlers.onEnd();
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop() {
      stopped = true;
      try {
        rec.abort();
      } catch {
        /* ya cerrado */
      }
    },
  };
}

/* Preferencia de voz en el modo individual (por dispositivo: depende del micrófono). */
const VOICE_KEY = "palabria-voice";
const listeners = new Set<() => void>();

export function getVoicePreference(): boolean {
  try {
    return window.localStorage.getItem(VOICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoicePreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(VOICE_KEY, enabled ? "1" : "0");
  } catch {
    /* almacenamiento no disponible */
  }
  listeners.forEach((l) => l());
}

export function subscribeVoicePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

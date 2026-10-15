"use client";

/**
 * Efectos de sonido sintetizados con Web Audio (sin archivos externos).
 * Solo suenan si el jugador los tiene activados y después de una interacción
 * del usuario, respetando las políticas de reproducción de los navegadores.
 */
export type SoundName = "correct" | "wrong" | "pass" | "tick" | "end" | "turn" | "start" | "win";

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number; slide?: number };

const SOUNDS: Record<SoundName, Note[]> = {
  correct: [
    { f: 784, t: 0, d: 0.12, type: "triangle" },
    { f: 1175, t: 0.09, d: 0.22, type: "triangle" },
  ],
  wrong: [
    { f: 220, t: 0, d: 0.18, type: "sawtooth", g: 0.5, slide: 150 },
    { f: 165, t: 0.16, d: 0.26, type: "sawtooth", g: 0.45, slide: 110 },
  ],
  pass: [
    { f: 523, t: 0, d: 0.09, type: "square", g: 0.35 },
    { f: 659, t: 0.08, d: 0.09, type: "square", g: 0.35 },
    { f: 880, t: 0.16, d: 0.16, type: "square", g: 0.35 },
  ],
  tick: [{ f: 1320, t: 0, d: 0.05, type: "sine", g: 0.5 }],
  turn: [
    { f: 988, t: 0, d: 0.1, type: "sine" },
    { f: 1319, t: 0.1, d: 0.18, type: "sine" },
  ],
  start: [
    { f: 392, t: 0, d: 0.12, type: "triangle" },
    { f: 523, t: 0.12, d: 0.12, type: "triangle" },
    { f: 784, t: 0.24, d: 0.3, type: "triangle" },
  ],
  end: [
    { f: 659, t: 0, d: 0.16, type: "triangle" },
    { f: 523, t: 0.16, d: 0.16, type: "triangle" },
    { f: 392, t: 0.32, d: 0.4, type: "triangle" },
  ],
  win: [
    { f: 523, t: 0, d: 0.14, type: "triangle" },
    { f: 659, t: 0.12, d: 0.14, type: "triangle" },
    { f: 784, t: 0.24, d: 0.14, type: "triangle" },
    { f: 1047, t: 0.36, d: 0.5, type: "triangle" },
  ],
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  enabled = true;
  volume = 0.7;

  /** Se llama desde un gesto del usuario para desbloquear el audio. */
  unlock(): void {
    if (typeof window === "undefined" || !this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(name: SoundName): void {
    if (!this.enabled || this.volume <= 0 || !this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx;
    const base = ctx.currentTime + 0.01;
    for (const note of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? "sine";
      osc.frequency.setValueAtTime(note.f, base + note.t);
      if (note.slide) osc.frequency.linearRampToValueAtTime(note.slide, base + note.t + note.d);
      const peak = 0.18 * this.volume * (note.g ?? 1);
      gain.gain.setValueAtTime(0.0001, base + note.t);
      gain.gain.exponentialRampToValueAtTime(peak, base + note.t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, base + note.t + note.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(base + note.t);
      osc.stop(base + note.t + note.d + 0.05);
    }
  }
}

export const sound = new SoundEngine();

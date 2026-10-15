"use client";

import { Mic, MicOff, RotateCcw, Send, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MAX_ANSWER_LENGTH } from "@/lib/game/normalize";
import { cn } from "@/lib/client/cn";
import { interpretSpeech, listen, speak, stopSpeaking, voiceSupport, type Listener } from "@/lib/client/voice";

type VoiceStatus = "speaking" | "listening" | "idle" | "denied" | "unsupported";

/**
 * Modo voz: lee la pregunta y después escucha. Lo transcrito aparece en el
 * campo; al terminar de hablar se envía (o se pasa si se dice «Palabria»).
 */
function useVoiceAnswer({
  enabled,
  text,
  promptKey,
  passWords,
  onText,
  onAnswer,
  onPass,
}: {
  enabled: boolean;
  text: string | null;
  promptKey: string;
  passWords: string[];
  onText: (text: string) => void;
  onAnswer: (text: string) => void;
  onPass: () => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [round, setRound] = useState(0);
  const handlers = useRef({ onText, onAnswer, onPass, passWords });
  useEffect(() => {
    handlers.current = { onText, onAnswer, onPass, passWords };
  });

  useEffect(() => {
    if (!enabled || !text) return;
    let cancelled = false;
    let listener: Listener | null = null;
    let tries = 0;
    const support = voiceSupport();

    const startListening = () => {
      if (cancelled) return;
      if (!support.listen) {
        setStatus("unsupported");
        return;
      }
      setStatus("listening");
      let gotFinal = false;
      listener = listen({
        onText: (t) => handlers.current.onText(t),
        onFinal: (t) => {
          gotFinal = true;
          const spoken = interpretSpeech(t, handlers.current.passWords);
          if (!spoken) return;
          setStatus("idle");
          if (spoken.kind === "pass") handlers.current.onPass();
          else {
            handlers.current.onText(spoken.text);
            handlers.current.onAnswer(spoken.text);
          }
        },
        onEnd: () => {
          if (cancelled || gotFinal) return;
          // Sin respuesta: se vuelve a escuchar unas cuantas veces.
          if (++tries < 4) startListening();
          else setStatus("idle");
        },
        onError: (error) => {
          if (error === "not-allowed" || error === "service-not-allowed") setStatus("denied");
        },
      });
      if (!listener) setStatus("unsupported");
    };

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setStatus("speaking");
      await speak(text);
      startListening();
    })();

    return () => {
      cancelled = true;
      stopSpeaking();
      listener?.stop();
    };
  }, [enabled, text, promptKey, round]);

  return { status, retry: () => setRound((n) => n + 1) };
}

function VoiceBar({ status, onRetry, passWord }: { status: VoiceStatus; onRetry: () => void; passWord: string }) {
  const label =
    status === "speaking"
      ? "Leyendo la pregunta…"
      : status === "listening"
        ? `Te escucho: di la respuesta o «${passWord}»`
        : status === "denied"
          ? "Permite el micrófono en el navegador para responder hablando."
          : status === "unsupported"
            ? "Este navegador no reconoce la voz: escribe la respuesta."
            : "Micrófono en pausa.";
  const Icon = status === "speaking" ? Volume2 : status === "listening" ? Mic : MicOff;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-full border-2 px-4 py-2 text-sm font-extrabold",
        status === "listening"
          ? "border-ok-500 bg-ok-50 text-ok-700"
          : "border-glaze-300 bg-ink-900/[0.06] text-ink-700",
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2">
        <Icon className={cn("size-5", status === "listening" && "animate-pulse")} aria-hidden="true" />
        {label}
      </span>
      {status !== "speaking" ? (
        <button
          type="button"
          className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-ink-900/10"
          onClick={onRetry}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {status === "listening" ? "Repetir" : "Hablar"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Campo de respuesta + «Responder» + «Palabria».
 * Enter envía la respuesta; un envío en curso bloquea nuevos envíos.
 */
export function AnswerForm({
  promptKey,
  disabled,
  busy,
  onAnswer,
  onPass,
  passLabel = "Palabria",
  disabledReason,
  extra,
  autoFocus = true,
  voiceText = null,
  className,
}: {
  promptKey: string;
  disabled: boolean;
  busy: boolean;
  onAnswer: (text: string) => void;
  onPass: () => void;
  passLabel?: string;
  disabledReason?: string;
  extra?: ReactNode;
  autoFocus?: boolean;
  /** Modo voz activo: texto que se lee antes de escuchar la respuesta. */
  voiceText?: string | null;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [shownKey, setShownKey] = useState(promptKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = disabled || busy;

  // Nueva pregunta: se vacía el campo (ajuste de estado durante el renderizado).
  if (shownKey !== promptKey) {
    setShownKey(promptKey);
    setText("");
  }

  const voiceOn = voiceText !== null && !disabled && !busy;
  const voice = useVoiceAnswer({
    enabled: voiceOn,
    text: voiceText,
    promptKey,
    passWords: passLabel === "Paso" ? ["paso", "palabria"] : [],
    onText: (t) => setText(t.slice(0, MAX_ANSWER_LENGTH)),
    onAnswer: (t) => {
      if (!locked) onAnswer(t);
      setText("");
    },
    onPass: () => !locked && onPass(),
  });

  useEffect(() => {
    // En modo voz no se abre el teclado del móvil.
    if (!disabled && autoFocus && voiceText === null) inputRef.current?.focus({ preventScroll: true });
  }, [promptKey, disabled, autoFocus, voiceText]);

  const submit = () => {
    const value = text.trim();
    if (!value || locked) return;
    onAnswer(value);
    setText("");
  };

  return (
    <form
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-describedby={disabledReason ? "answer-disabled-reason" : undefined}
    >
      {voiceOn ? <VoiceBar status={voice.status} onRetry={voice.retry} passWord={passLabel} /> : null}
      <label htmlFor="answer" className="sr-only">
        Tu respuesta
      </label>
      <div className="flex gap-2">
        <input
          id="answer"
          ref={inputRef}
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
          placeholder={disabled ? (disabledReason ?? "Espera tu turno") : "Escribe tu respuesta"}
          disabled={disabled}
          readOnly={busy}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={MAX_ANSWER_LENGTH}
          aria-label="Tu respuesta"
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0 !px-4 sm:!px-6"
          disabled={locked || text.trim().length === 0}
        >
          <Send className="size-5" aria-hidden="true" />
          <span className="hidden sm:inline">Responder</span>
          <span className="sr-only sm:hidden">Responder</span>
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-gold min-h-14 flex-1 font-display text-[1.35rem] font-black sm:text-2xl"
          onClick={() => !locked && onPass()}
          disabled={locked}
        >
          {passLabel}
        </button>
        {extra}
      </div>
      {disabledReason && disabled ? (
        <p id="answer-disabled-reason" className="text-center text-sm font-semibold text-ink-600">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}

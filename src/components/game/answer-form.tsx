"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MAX_ANSWER_LENGTH } from "@/lib/game/normalize";
import { cn } from "@/lib/client/cn";

/**
 * Campo de respuesta + «Responder» + «Pasapalabra».
 * Enter envía la respuesta; un envío en curso bloquea nuevos envíos.
 */
export function AnswerForm({
  promptKey,
  disabled,
  busy,
  onAnswer,
  onPass,
  passLabel = "Pasapalabra",
  disabledReason,
  extra,
  autoFocus = true,
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

  useEffect(() => {
    if (!disabled && autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [promptKey, disabled, autoFocus]);

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
          className="btn btn-gold min-h-14 flex-1 font-display text-base uppercase tracking-[0.14em] sm:text-lg"
          onClick={() => !locked && onPass()}
          disabled={locked}
        >
          {passLabel}
        </button>
        {extra}
      </div>
      {disabledReason && disabled ? (
        <p id="answer-disabled-reason" className="text-center text-sm font-semibold text-ink-300">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/common/Button";

function AttachIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 12h14M12 5l7 7-7 7"
      />
    </svg>
  );
}

export interface InputAreaProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  modelLabel?: string;
  temperatureLabel?: string;
  tokenLabel?: string;
}

export function InputArea({
  onSend,
  disabled,
  modelLabel,
  temperatureLabel,
  tokenLabel,
}: InputAreaProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [value]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onSend(trimmed);
    setValue("");
  };

  return (
    <div className="input-area-gradient px-8 pb-8 pt-6">
      <div className="relative max-w-[680px]">
        <textarea
          ref={textareaRef}
          className="min-h-[60px] max-h-[180px] w-full resize-none rounded-2xl border border-parchment bg-paper px-6 py-[18px] pr-[120px] font-body text-[0.95rem] text-ink outline-none transition-all duration-200 placeholder:text-sand focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
          placeholder="Type your message..."
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />

        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-transparent text-sand transition-all duration-150 hover:bg-cream hover:text-ink disabled:opacity-50"
            disabled={disabled}
            aria-label="Attach"
          >
            <div className="h-[18px] w-[18px]">
              <AttachIcon />
            </div>
          </button>

          <Button
            variant="primary"
            className="h-9 w-9 rounded-[10px] px-0 hover:scale-105"
            disabled={disabled || !value.trim()}
            aria-label="Send"
            onClick={() => void submit()}
          >
            <div className="h-5 w-5">
              <SendIcon />
            </div>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex max-w-[680px] justify-between px-1 font-mono text-[0.7rem] text-sand">
        <span>
          {modelLabel ? `Model: ${modelLabel}` : "Model: —"}
          {temperatureLabel ? ` - Temp: ${temperatureLabel}` : ""}
        </span>
        <span>{tokenLabel ?? ""}</span>
      </div>
    </div>
  );
}

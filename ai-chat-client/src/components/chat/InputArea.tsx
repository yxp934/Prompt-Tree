"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/common/Button";
import {
  buildModelSelectionKey,
  type EnabledModelOption,
} from "@/lib/services/providerModelService";
import type { ProviderModelSelection } from "@/types/provider";

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
  modelOptions?: EnabledModelOption[];
  selectedModels?: ProviderModelSelection[];
  onSelectedModelsChange?: (models: ProviderModelSelection[]) => void;
}

export function InputArea({
  onSend,
  disabled,
  modelLabel,
  temperatureLabel,
  tokenLabel,
  modelOptions = [],
  selectedModels = [],
  onSelectedModelsChange,
}: InputAreaProps) {
  const [value, setValue] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const selectedKeys = useMemo(
    () => new Set(selectedModels.map(buildModelSelectionKey)),
    [selectedModels],
  );

  const handleToggleModel = (option: EnabledModelOption) => {
    if (!onSelectedModelsChange) return;
    const key = buildModelSelectionKey(option);
    const exists = selectedKeys.has(key);
    const next = exists
      ? selectedModels.filter((selection) => buildModelSelectionKey(selection) !== key)
      : [...selectedModels, { providerId: option.providerId, modelId: option.modelId }];
    onSelectedModelsChange(next);
  };

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelMenuOpen]);

  return (
    <div className="input-area-gradient shrink-0 px-8 pb-6 pt-5">
      <div className="relative max-w-[680px]">
        <textarea
          ref={textareaRef}
          className="min-h-[60px] max-h-[180px] w-full resize-none rounded-2xl border border-parchment bg-paper px-6 py-4 pr-[120px] font-body text-[0.95rem] text-ink outline-none transition-all duration-200 placeholder:text-sand focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
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
            <div className="h-6 w-6">
              <SendIcon />
            </div>
          </Button>
        </div>
      </div>

      <div className="mt-2 flex max-w-[680px] items-center gap-3 px-1 font-mono text-[0.7rem] text-sand">
        <div className="flex items-center gap-3">
          <span>
            {modelLabel ? `Model: ${modelLabel}` : "Model: —"}
            {temperatureLabel ? ` - Temp: ${temperatureLabel}` : ""}
          </span>
          {modelOptions.length > 0 && onSelectedModelsChange ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                className="flex items-center gap-2 rounded-[10px] border border-parchment bg-paper px-3 py-1.5 text-[0.7rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink"
                onClick={() => setModelMenuOpen((prev) => !prev)}
                disabled={disabled}
              >
                <span>Models</span>
                <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[0.65rem] text-clay">
                  {selectedModels.length}
                </span>
              </button>

              {modelMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[260px] rounded-xl border border-parchment bg-paper p-3 shadow-[0_16px_40px_rgba(35,31,28,0.18)]">
                  <div className="mb-2 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.12em] text-sand">
                    <span>Enabled Models</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-parchment px-2 py-1 text-[0.6rem] text-sand hover:border-copper hover:text-ink"
                        onClick={() =>
                          onSelectedModelsChange(
                            modelOptions.map((option) => ({
                              providerId: option.providerId,
                              modelId: option.modelId,
                            })),
                          )
                        }
                      >
                        全选
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-parchment px-2 py-1 text-[0.6rem] text-sand hover:border-copper hover:text-ink"
                        onClick={() => onSelectedModelsChange([])}
                      >
                        清空
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                    {modelOptions.map((option) => {
                      const isSelected = selectedKeys.has(
                        buildModelSelectionKey(option),
                      );
                      return (
                        <button
                          key={`${option.providerId}-${option.modelId}`}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                            isSelected
                              ? "border-copper/50 bg-copper/10"
                              : "border-parchment/30 bg-shoji-white hover:border-copper/40"
                          }`}
                          onClick={() => handleToggleModel(option)}
                        >
                          <span
                            className={`flex h-4.5 w-4.5 items-center justify-center rounded border text-[0.6rem] ${
                              isSelected
                                ? "border-copper bg-copper text-white"
                                : "border-parchment bg-transparent text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <div className="flex-1">
                            <div className="font-mono text-[0.75rem] text-ink">
                              {option.modelId}
                            </div>
                            <div className="text-[0.65rem] text-sand">
                              {option.providerName}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <span className="ml-auto">{tokenLabel ?? ""}</span>
      </div>
    </div>
  );
}

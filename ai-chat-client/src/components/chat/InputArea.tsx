"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/common/Button";
import { useT } from "@/lib/i18n/useT";
import { getSupportedFileAcceptAttribute } from "@/lib/services/fileImportService";
import {
  buildModelSelectionKey,
  type EnabledModelOption,
} from "@/lib/services/providerModelService";
import type { ProviderModelSelection } from "@/types/provider";
import type { ToolSettings, ToolUseId } from "@/types";

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

function OptimizeIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M5 16l.8 1.8L7.6 19l-1.8.8L5 21l-.8-1.8L2.4 19l1.8-.8L5 16z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export interface InputAreaProps {
  onSend: (content: string) => Promise<void>;
  onOptimizePrompt?: (content: string, signal: AbortSignal) => Promise<string>;
  onAttachFiles?: (files: File[]) => Promise<void> | void;
  disabled?: boolean;
  modelLabel?: string;
  temperatureLabel?: string;
  tokenLabel?: string;
  modelOptions?: EnabledModelOption[];
  selectedModels?: ProviderModelSelection[];
  onSelectedModelsChange?: (models: ProviderModelSelection[]) => void;
  selectedTools?: ToolUseId[];
  onSelectedToolsChange?: (tools: ToolUseId[]) => void;
  toolSettings?: ToolSettings;
  includeMemoryTool?: boolean;
}

export function InputArea({
  onSend,
  onOptimizePrompt,
  onAttachFiles,
  disabled,
  modelLabel,
  temperatureLabel,
  tokenLabel,
  modelOptions = [],
  selectedModels = [],
  onSelectedModelsChange,
  selectedTools = [],
  onSelectedToolsChange,
  toolSettings,
  includeMemoryTool = true,
}: InputAreaProps) {
  const t = useT();
  const [value, setValue] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const optimizeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [value]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onSend(trimmed);
    setUndoValue(null);
    setOptimizeError(null);
    setValue("");
  };

  const handleOptimize = async () => {
    if (!onOptimizePrompt) return;
    if (isOptimizing) {
      optimizeAbortRef.current?.abort();
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) return;

    const previous = value;
    const controller = new AbortController();
    optimizeAbortRef.current = controller;
    setIsOptimizing(true);
    setOptimizeError(null);

    try {
      const optimized = await onOptimizePrompt(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setUndoValue(previous);
      setValue(optimized);
    } catch (err) {
      if (
        (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }
      setOptimizeError(err instanceof Error ? err.message : t("chat.input.optimizeFailed"));
    } finally {
      if (optimizeAbortRef.current === controller) {
        optimizeAbortRef.current = null;
      }
      setIsOptimizing(false);
    }
  };

  const selectedKeys = useMemo(
    () => new Set(selectedModels.map(buildModelSelectionKey)),
    [selectedModels],
  );

  const selectedToolsSet = useMemo(() => new Set(selectedTools), [selectedTools]);

  const toolOptions = useMemo(() => {
    const base: Array<{ id: ToolUseId; title: string; subtitle: string }> = [
      ...(includeMemoryTool
        ? [
            {
              id: "search_memory" as ToolUseId,
              title: t("chat.input.tool.memory"),
              subtitle: t("chat.input.tool.memorySubtitle"),
            },
          ]
        : []),
      { id: "web_search", title: t("chat.input.tool.webSearch"), subtitle: "Exa / Tavily" },
      { id: "python", title: t("chat.input.tool.python"), subtitle: t("chat.input.tool.pythonSubtitle") },
    ];

    const servers = toolSettings?.mcp.servers ?? [];
    const mcp = servers.map((server) => ({
      id: `mcp:${server.id}` as ToolUseId,
      title: server.name || server.id,
      subtitle: `MCP · ${server.transport} · ${server.id}`,
    }));

    return [...base, ...mcp];
  }, [includeMemoryTool, t, toolSettings?.mcp.servers]);

  const selectAllTools = () => {
    if (!onSelectedToolsChange) return;
    onSelectedToolsChange(toolOptions.map((t) => t.id));
  };

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
    if (!modelMenuOpen && !toolMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (toolMenuRef.current && toolMenuRef.current.contains(target)) return;
      setModelMenuOpen(false);
      setToolMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelMenuOpen, toolMenuOpen]);

  useEffect(
    () => () => {
      optimizeAbortRef.current?.abort();
    },
    [],
  );

  const handleToggleTool = (tool: ToolUseId) => {
    if (!onSelectedToolsChange) return;
    const exists = selectedToolsSet.has(tool);
    const next = exists ? selectedTools.filter((t) => t !== tool) : [...selectedTools, tool];
    onSelectedToolsChange(next);
  };

  return (
    <div className="input-area-gradient shrink-0 px-8 pb-6 pt-5">
      <div className="relative max-w-[680px]">
        <textarea
          ref={textareaRef}
          className="min-h-[60px] max-h-[180px] w-full resize-none rounded-2xl border border-parchment bg-paper px-6 py-4 pr-[166px] font-body text-[0.95rem] text-ink outline-none transition-all duration-200 placeholder:text-sand focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
          placeholder={t("chat.input.placeholder")}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isOptimizing) return;
              void submit();
            }
          }}
        />

        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-transparent text-sand transition-all duration-150 hover:bg-cream hover:text-ink disabled:opacity-50"
            disabled={disabled}
            aria-label={t("chat.input.attach")}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-[18px] w-[18px]">
              <AttachIcon />
            </div>
          </button>

          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            multiple
            accept={getSupportedFileAcceptAttribute()}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) {
                void onAttachFiles?.(files);
              }
              e.target.value = "";
            }}
          />

          {onOptimizePrompt ? (
            <button
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-all duration-150 disabled:opacity-50 ${
                isOptimizing
                  ? "bg-copper/15 text-copper hover:bg-copper/20"
                  : "bg-transparent text-sand hover:bg-cream hover:text-ink"
              }`}
              disabled={disabled || (!isOptimizing && !value.trim())}
              aria-label={isOptimizing ? t("chat.input.optimizeCancel") : t("chat.input.optimize")}
              onClick={() => void handleOptimize()}
            >
              <div className="h-[18px] w-[18px]">
                {isOptimizing ? <SpinnerIcon /> : <OptimizeIcon />}
              </div>
            </button>
          ) : null}

          <Button
            variant="primary"
            className="h-10 w-10 rounded-[10px] px-0 hover:scale-105"
            disabled={disabled || isOptimizing || !value.trim()}
            aria-label={t("chat.input.send")}
            onClick={() => void submit()}
          >
            <div className="h-7 w-7">
              <SendIcon />
            </div>
          </Button>
        </div>
      </div>

      <div className="mt-2 flex max-w-[680px] items-center gap-3 px-1 font-mono text-[0.7rem] text-sand">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-[32px] min-w-0 flex-1 overflow-y-auto whitespace-normal break-words pr-1 leading-[1.25]">
            {modelLabel
              ? t("chat.input.modelMeta", {
                  model: modelLabel,
                  tempPart: temperatureLabel
                    ? t("chat.input.tempPart", { temp: temperatureLabel })
                    : "",
                })
              : t("chat.input.modelMetaNone")}
          </div>
          {modelOptions.length > 0 && onSelectedModelsChange ? (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                className="flex w-[118px] items-center justify-between rounded-[10px] border border-parchment bg-paper px-3 py-1.5 text-[0.7rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink"
                onClick={() => setModelMenuOpen((prev) => !prev)}
                disabled={disabled}
              >
                <span>{t("chat.input.models")}</span>
                <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[0.65rem] text-clay">
                  {selectedModels.length}/{modelOptions.length}
                </span>
              </button>

              {modelMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[260px] rounded-xl border border-parchment bg-paper p-3 shadow-[0_16px_40px_rgba(35,31,28,0.18)]">
                  <div className="mb-2 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.12em] text-sand">
                    <div className="flex items-center gap-2">
                      <span>{t("chat.input.enabledModels")}</span>
                      <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[0.65rem] text-clay">
                        {selectedModels.length}/{modelOptions.length}
                      </span>
                    </div>
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
                        {t("common.selectAll")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-parchment px-2 py-1 text-[0.6rem] text-sand hover:border-copper hover:text-ink"
                        onClick={() => onSelectedModelsChange([])}
                      >
                        {t("common.clear")}
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
          {onSelectedToolsChange ? (
            <div ref={toolMenuRef} className="relative shrink-0">
              <button
                type="button"
                className="flex w-[118px] items-center justify-between rounded-[10px] border border-parchment bg-paper px-3 py-1.5 text-[0.7rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink"
                onClick={() => setToolMenuOpen((prev) => !prev)}
                disabled={disabled}
              >
                <span>{t("common.tools")}</span>
                <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[0.65rem] text-clay">
                  {selectedTools.length}
                </span>
              </button>

              {toolMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-[240px] rounded-xl border border-parchment bg-paper p-3 shadow-[0_16px_40px_rgba(35,31,28,0.18)]">
                  <div className="mb-2 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.12em] text-sand">
                    <span>{t("chat.input.toolUse")}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-parchment px-2 py-1 text-[0.6rem] text-sand hover:border-copper hover:text-ink"
                        onClick={selectAllTools}
                      >
                        {t("common.selectAll")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-parchment px-2 py-1 text-[0.6rem] text-sand hover:border-copper hover:text-ink"
                        onClick={() => onSelectedToolsChange([])}
                      >
                        {t("common.clear")}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                    {toolOptions.map((tool) => {
                      const isSelected = selectedToolsSet.has(tool.id);
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                            isSelected
                              ? "border-copper/50 bg-copper/10"
                              : "border-parchment/30 bg-shoji-white hover:border-copper/40"
                          }`}
                          onClick={() => handleToggleTool(tool.id)}
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
                              {tool.title}
                            </div>
                            <div className="text-[0.65rem] text-sand">
                              {tool.subtitle}
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
        <span className="shrink-0 whitespace-nowrap">{tokenLabel ?? ""}</span>
      </div>

      {isOptimizing || optimizeError || undoValue ? (
        <div className="mt-2 flex max-w-[680px] items-center justify-between gap-3 px-1 font-zen-body text-[0.7rem] text-stone-gray">
          <div className="min-h-[16px]">
            {isOptimizing ? t("chat.input.optimizing") : optimizeError ?? ""}
          </div>
          {undoValue ? (
            <button
              type="button"
              className="rounded-md border border-parchment/30 bg-paper px-2 py-1 text-[0.65rem] text-clay transition-all duration-150 hover:border-copper hover:text-ink"
              onClick={() => {
                setValue(undoValue);
                setUndoValue(null);
                setOptimizeError(null);
              }}
            >
              {t("chat.input.undoOptimization")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import type { ProviderModelSelection } from "@/types/provider";

export interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number | null;
  selectedModels: ProviderModelSelection[];
  compressionModel: ProviderModelSelection | null;
  summaryModel: ProviderModelSelection | null;
  promptOptimizerModel: ProviderModelSelection | null;
  promptOptimizerPrompt: string;
  promptOptimizerSmartMemory: boolean;
}

export const DEFAULT_PROMPT_OPTIMIZER_PROMPT = [
  "You are my prompt ghostwriter and optimizer.",
  "",
  "Your task is to rewrite my draft prompt into a clearer, more specific, and more actionable final prompt that I can use directly with an LLM.",
  "",
  "Hard requirements:",
  "1. Write entirely from my perspective using first-person voice (\"I\").",
  "2. Preserve the original intent, goals, and constraints. Do not change the task itself.",
  "3. Remove ambiguity, fix logic and wording issues, and convert vague or negative constraints into explicit positive requirements whenever possible.",
  "4. If memory and context are provided, use them to improve accuracy and consistency with my preferences. Never invent, complete, or assume missing memory entries.",
  "5. If the draft includes code in triple backticks (```), keep the code blocks unchanged.",
  "6. Determine the output language from the draft input language. Keep product names, API names, technical terms, code, and file paths in English when appropriate.",
  "7. Do not mention where information came from, and do not refer to any conversation source.",
  "8. Output only the optimized prompt text. No explanations, no headers, no extra notes.",
].join("\n");

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: null,
  selectedModels: [],
  compressionModel: null,
  summaryModel: null,
  promptOptimizerModel: null,
  promptOptimizerPrompt: DEFAULT_PROMPT_OPTIMIZER_PROMPT,
  promptOptimizerSmartMemory: false,
};

const LLM_SETTINGS_STORAGE_KEY = "prompt-tree.llm_settings.v1";
const LEGACY_LLM_SETTINGS_KEYS = ["new-chat.llm_settings"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSelectedModels(
  value: unknown,
  fallback: ProviderModelSelection[],
): ProviderModelSelection[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const selections: ProviderModelSelection[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { providerId, modelId } = item as {
      providerId?: unknown;
      modelId?: unknown;
    };
    if (typeof providerId !== "string" || typeof modelId !== "string") continue;
    const key = `${providerId}:${modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selections.push({ providerId, modelId });
  }

  return selections;
}

function normalizeModelSelection(value: unknown): ProviderModelSelection | null {
  if (!value || typeof value !== "object") return null;
  const { providerId, modelId } = value as {
    providerId?: unknown;
    modelId?: unknown;
  };
  if (typeof providerId !== "string" || typeof modelId !== "string") return null;
  return { providerId, modelId };
}

function normalizeOptionalMaxTokens(
  value: unknown,
  fallback: number | null,
): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

export function normalizeLLMSettings(
  settings: Partial<LLMSettings>,
  fallback: LLMSettings = DEFAULT_LLM_SETTINGS,
): LLMSettings {
  const model =
    typeof settings.model === "string" && settings.model.trim()
      ? settings.model.trim()
      : fallback.model;
  const temperature =
    typeof settings.temperature === "number" && Number.isFinite(settings.temperature)
      ? clamp(settings.temperature, 0, 2)
      : fallback.temperature;
  const maxTokens = normalizeOptionalMaxTokens(settings.maxTokens, fallback.maxTokens);

  const selectedModels = normalizeSelectedModels(
    settings.selectedModels,
    fallback.selectedModels,
  );

  const compressionModel = Object.prototype.hasOwnProperty.call(
    settings,
    "compressionModel",
  )
    ? normalizeModelSelection(settings.compressionModel)
    : fallback.compressionModel;
  const summaryModel = Object.prototype.hasOwnProperty.call(settings, "summaryModel")
    ? normalizeModelSelection(settings.summaryModel)
    : fallback.summaryModel;
  const promptOptimizerModel = Object.prototype.hasOwnProperty.call(
    settings,
    "promptOptimizerModel",
  )
    ? normalizeModelSelection(settings.promptOptimizerModel)
    : fallback.promptOptimizerModel;
  const promptOptimizerPrompt =
    typeof settings.promptOptimizerPrompt === "string" && settings.promptOptimizerPrompt.trim()
      ? settings.promptOptimizerPrompt.trim()
      : fallback.promptOptimizerPrompt;
  const promptOptimizerSmartMemory =
    typeof settings.promptOptimizerSmartMemory === "boolean"
      ? settings.promptOptimizerSmartMemory
      : fallback.promptOptimizerSmartMemory;

  return {
    model,
    temperature,
    maxTokens,
    selectedModels,
    compressionModel,
    summaryModel,
    promptOptimizerModel,
    promptOptimizerPrompt,
    promptOptimizerSmartMemory,
  };
}

export function getStoredLLMSettings(): LLMSettings | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<LLMSettings>;
      return normalizeLLMSettings(parsed);
    } catch {
      // fall through to legacy keys
    }
  }

  for (const legacyKey of LEGACY_LLM_SETTINGS_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) continue;
    try {
      const parsed = JSON.parse(legacy) as Partial<LLMSettings>;
      const normalized = normalizeLLMSettings(parsed);
      localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.removeItem(legacyKey);
      return normalized;
    } catch {
      continue;
    }
  }

  return null;
}

export function setStoredLLMSettings(settings: LLMSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  for (const legacyKey of LEGACY_LLM_SETTINGS_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

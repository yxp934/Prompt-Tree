import type { ProviderModelSelection } from "@/types/provider";

export interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  selectedModels: ProviderModelSelection[];
  compressionModel: ProviderModelSelection | null;
  summaryModel: ProviderModelSelection | null;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 1024,
  selectedModels: [],
  compressionModel: null,
  summaryModel: null,
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
  const maxTokens =
    typeof settings.maxTokens === "number" && Number.isFinite(settings.maxTokens)
      ? Math.max(1, Math.round(settings.maxTokens))
      : fallback.maxTokens;

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

  return {
    model,
    temperature,
    maxTokens,
    selectedModels,
    compressionModel,
    summaryModel,
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

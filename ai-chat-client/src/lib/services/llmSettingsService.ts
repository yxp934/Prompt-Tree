export interface LLMSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 1024,
};

const LLM_SETTINGS_STORAGE_KEY = "new-chat.llm_settings";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

  return { model, temperature, maxTokens };
}

export function getStoredLLMSettings(): LLMSettings | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<LLMSettings>;
    return normalizeLLMSettings(parsed);
  } catch {
    return null;
  }
}

export function setStoredLLMSettings(settings: LLMSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

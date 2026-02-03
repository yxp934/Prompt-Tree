export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

const OPENAI_BASE_URL_STORAGE_KEY = "prompt-tree.openai_base_url.v1";
const LEGACY_OPENAI_BASE_URL_KEYS = ["new-chat.openai_base_url"];

export function normalizeOpenAIBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getOpenAIBaseUrl(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(OPENAI_BASE_URL_STORAGE_KEY);
  if (stored) {
    const normalized = normalizeOpenAIBaseUrl(stored);
    return normalized ? normalized : null;
  }

  for (const legacyKey of LEGACY_OPENAI_BASE_URL_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) continue;
    const normalized = normalizeOpenAIBaseUrl(legacy);
    if (!normalized) continue;
    localStorage.setItem(OPENAI_BASE_URL_STORAGE_KEY, normalized);
    localStorage.removeItem(legacyKey);
    return normalized;
  }

  return null;
}

export function getOpenAIBaseUrlOrDefault(): string {
  return getOpenAIBaseUrl() ?? DEFAULT_OPENAI_BASE_URL;
}

export function setOpenAIBaseUrl(url: string): void {
  if (typeof window === "undefined") return;

  const normalized = normalizeOpenAIBaseUrl(url);
  if (!normalized) {
    localStorage.removeItem(OPENAI_BASE_URL_STORAGE_KEY);
    for (const legacyKey of LEGACY_OPENAI_BASE_URL_KEYS) {
      localStorage.removeItem(legacyKey);
    }
    return;
  }

  localStorage.setItem(OPENAI_BASE_URL_STORAGE_KEY, normalized);
  for (const legacyKey of LEGACY_OPENAI_BASE_URL_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

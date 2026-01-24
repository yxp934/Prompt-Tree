export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

const OPENAI_BASE_URL_STORAGE_KEY = "new-chat.openai_base_url";

export function normalizeOpenAIBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getOpenAIBaseUrl(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(OPENAI_BASE_URL_STORAGE_KEY);
  if (!stored) return null;
  const normalized = normalizeOpenAIBaseUrl(stored);
  return normalized ? normalized : null;
}

export function getOpenAIBaseUrlOrDefault(): string {
  return getOpenAIBaseUrl() ?? DEFAULT_OPENAI_BASE_URL;
}

export function setOpenAIBaseUrl(url: string): void {
  if (typeof window === "undefined") return;

  const normalized = normalizeOpenAIBaseUrl(url);
  if (!normalized) {
    localStorage.removeItem(OPENAI_BASE_URL_STORAGE_KEY);
    return;
  }

  localStorage.setItem(OPENAI_BASE_URL_STORAGE_KEY, normalized);
}


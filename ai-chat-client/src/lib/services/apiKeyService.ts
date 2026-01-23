const OPENAI_API_KEY_STORAGE_KEY = "new-chat.openai_api_key";

export function getOpenAIApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
}

export function setOpenAIApiKey(key: string): void {
  if (typeof window === "undefined") return;

  const trimmed = key.trim();
  if (!trimmed) {
    localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    return;
  }

  localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmed);
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}...`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}


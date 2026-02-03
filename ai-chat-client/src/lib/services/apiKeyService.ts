const OPENAI_API_KEY_STORAGE_KEY = "prompt-tree.openai_api_key.v1";
const LEGACY_OPENAI_API_KEY_KEYS = ["new-chat.openai_api_key"];

export function getOpenAIApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
  if (stored) return stored;

  for (const legacyKey of LEGACY_OPENAI_API_KEY_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) continue;
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  }

  return null;
}

export function setOpenAIApiKey(key: string): void {
  if (typeof window === "undefined") return;

  const trimmed = key.trim();
  if (!trimmed) {
    localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    for (const legacyKey of LEGACY_OPENAI_API_KEY_KEYS) {
      localStorage.removeItem(legacyKey);
    }
    return;
  }

  localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmed);
  for (const legacyKey of LEGACY_OPENAI_API_KEY_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}...`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

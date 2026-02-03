export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "prompt-tree.theme.v1";
const LEGACY_THEME_KEYS = ["new-chat.theme"];

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  for (const legacyKey of LEGACY_THEME_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== "light" && legacy !== "dark") continue;
    localStorage.setItem(THEME_STORAGE_KEY, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  }

  return null;
}

export function setStoredTheme(theme: ThemeMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  for (const legacyKey of LEGACY_THEME_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LLM_SETTINGS,
  getStoredLLMSettings,
  normalizeLLMSettings,
  setStoredLLMSettings,
} from "@/lib/services/llmSettingsService";

function createLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  } as unknown as Storage;

  return { localStorageMock, store };
}

describe("llmSettingsService", () => {
  beforeEach(() => {
    const { localStorageMock } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults maxTokens to null (unset)", () => {
    const normalized = normalizeLLMSettings({});
    expect(normalized.maxTokens).toBeNull();
  });

  it("keeps explicit null maxTokens even when fallback has a number", () => {
    const fallback = { ...DEFAULT_LLM_SETTINGS, maxTokens: 1024 };
    const normalized = normalizeLLMSettings({ maxTokens: null }, fallback);
    expect(normalized.maxTokens).toBeNull();
  });

  it("normalizes numeric maxTokens and persists null values to storage", () => {
    const normalized = normalizeLLMSettings({ maxTokens: 2048.6 });
    expect(normalized.maxTokens).toBe(2049);

    const settingsWithNull = { ...DEFAULT_LLM_SETTINGS, maxTokens: null };
    setStoredLLMSettings(settingsWithNull);

    const stored = getStoredLLMSettings();
    expect(stored?.maxTokens).toBeNull();
  });
});


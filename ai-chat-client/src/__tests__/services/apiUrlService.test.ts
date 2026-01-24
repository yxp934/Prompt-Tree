import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OPENAI_BASE_URL,
  getOpenAIBaseUrl,
  getOpenAIBaseUrlOrDefault,
  setOpenAIBaseUrl,
} from "@/lib/services/apiUrlService";

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

  return localStorageMock;
}

describe("apiUrlService", () => {
  beforeEach(() => {
    const localStorageMock = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and retrieves OpenAI base URL in localStorage", () => {
    expect(getOpenAIBaseUrl()).toBeNull();
    expect(getOpenAIBaseUrlOrDefault()).toBe(DEFAULT_OPENAI_BASE_URL);

    setOpenAIBaseUrl(" https://example.com/openai/v1/ ");
    expect(getOpenAIBaseUrl()).toBe("https://example.com/openai/v1");
    expect(getOpenAIBaseUrlOrDefault()).toBe("https://example.com/openai/v1");

    setOpenAIBaseUrl("");
    expect(getOpenAIBaseUrl()).toBeNull();
    expect(getOpenAIBaseUrlOrDefault()).toBe(DEFAULT_OPENAI_BASE_URL);
  });
});


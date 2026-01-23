import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getOpenAIApiKey,
  maskApiKey,
  setOpenAIApiKey,
} from "@/lib/services/apiKeyService";

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

describe("apiKeyService", () => {
  beforeEach(() => {
    const localStorageMock = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and retrieves OpenAI API key in localStorage", () => {
    expect(getOpenAIApiKey()).toBeNull();

    setOpenAIApiKey(" sk-test ");
    expect(getOpenAIApiKey()).toBe("sk-test");

    setOpenAIApiKey("");
    expect(getOpenAIApiKey()).toBeNull();
  });

  it("masks API keys for display", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-123...cdef");
    expect(maskApiKey("short")).toBe("sh...");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LLMService } from "@/lib/services/llmService";

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

describe("LLMService", () => {
  beforeEach(() => {
    const { localStorageMock, store } = createLocalStorageMock();
    store.set("new-chat.openai_api_key", "sk-test");
    store.set("new-chat.openai_base_url", "https://example.com/openai/v1");

    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/chat with apiKey + params and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: "ok" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    const content = await service.chat({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-test",
      temperature: 0.5,
      maxTokens: 123,
    });

    expect(content).toBe("ok");

    const args = fetchMock.mock.calls[0];
    expect(args?.[0]).toBe("/api/chat");
    const init = args?.[1] as { body?: string };
    const body = JSON.parse(init.body ?? "{}") as {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      maxTokens?: number;
    };
    expect(body.apiKey).toBe("sk-test");
    expect(body.baseUrl).toBe("https://example.com/openai/v1");
    expect(body.model).toBe("gpt-test");
    expect(body.maxTokens).toBe(123);
  });

  it("omits maxTokens from request body when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: "ok" }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    await service.chat({
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-test",
    });

    const args = fetchMock.mock.calls[0];
    const init = args?.[1] as { body?: string };
    const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(body, "maxTokens")).toBe(false);
  });

  it("throws when api key is missing", async () => {
    const { localStorageMock } = createLocalStorageMock();
    vi.stubGlobal("window", { localStorage: localStorageMock } as unknown as Window);
    vi.stubGlobal("localStorage", localStorageMock);

    const service = new LLMService();
    await expect(
      service.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/Missing OpenAI API key/);
  });

  it("throws when /api/chat returns non-OK", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    await expect(
      service.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/LLM request failed/);
  });

  it("throws when response payload is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nope: true }),
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LLMService();
    await expect(
      service.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/Invalid LLM response/);
  });
});

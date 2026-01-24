import { afterEach, describe, expect, it, vi } from "vitest";

import { openAIChatCompletion } from "@/lib/services/openaiClient";

describe("openAIChatCompletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the first choice content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{ message: { content: "hello from openai" } }],
      }),
      text: async () => "",
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const content = await openAIChatCompletion({
      apiKey: "sk-test",
      baseUrl: "https://example.com/openai/v1/",
      messages: [{ role: "user", content: "hi" }],
      model: "gpt-test",
    });

    expect(content).toBe("hello from openai");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://example.com/openai/v1/chat/completions",
    );
  });

  it("throws on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
      text: async () => "bad key",
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(
      openAIChatCompletion({
        apiKey: "sk-bad",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/OpenAI API error/);
  });
});

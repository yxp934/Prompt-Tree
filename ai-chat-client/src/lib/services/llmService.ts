import type { ChatMessage } from "@/types";

import { getOpenAIApiKey } from "./apiKeyService";
import { getOpenAIBaseUrlOrDefault } from "./apiUrlService";

export interface ChatParams {
  messages: ChatMessage[];
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: unknown;
  stream?: boolean;
  onToken?: (chunk: string) => void;
}

export interface ILLMService {
  chat(params: ChatParams): Promise<string>;
}

/**
 * Client-side LLM service that proxies to our Next.js API route.
 * The OpenAI API key is stored locally (localStorage) and sent per-request.
 */
export class LLMService implements ILLMService {
  async chat(params: ChatParams): Promise<string> {
    const {
      apiKey: apiKeyOverride,
      baseUrl: baseUrlOverride,
      onToken,
      stream,
      ...rest
    } = params;
    const apiKey = apiKeyOverride ?? getOpenAIApiKey();
    if (!apiKey) {
      throw new Error("Missing OpenAI API key. Add it in Settings.");
    }

    const baseUrl = baseUrlOverride ?? getOpenAIBaseUrlOrDefault();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, ...rest, stream: Boolean(stream) }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${text}`);
    }

    if (stream) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.body || contentType.includes("application/json")) {
        const json = (await response.json()) as unknown;
        if (
          typeof json === "object" &&
          json !== null &&
          "content" in json &&
          typeof (json as { content: unknown }).content === "string"
        ) {
          return (json as { content: string }).content;
        }
        throw new Error("Invalid LLM response payload.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let content = "";
      let done = false;

      while (!done) {
        const result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.replace(/^data:\s*/, "");
            if (!data) continue;
            if (data === "[DONE]") {
              done = true;
              break;
            }
            try {
              const json = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string | null } }>;
              };
              const delta = json.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                content += delta;
                onToken?.(delta);
              }
            } catch {
              // ignore malformed stream payloads
            }
          }
          if (done) break;
        }
      }

      return content;
    }

    const json = (await response.json()) as unknown;
    if (
      typeof json === "object" &&
      json !== null &&
      "content" in json &&
      typeof (json as { content: unknown }).content === "string"
    ) {
      return (json as { content: string }).content;
    }

    throw new Error("Invalid LLM response payload.");
  }
}

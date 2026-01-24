import type { ChatMessage } from "@/types";

import { getOpenAIApiKey } from "./apiKeyService";
import { getOpenAIBaseUrlOrDefault } from "./apiUrlService";

export interface ChatParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
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
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error("Missing OpenAI API key. Add it in Settings.");
    }

    const baseUrl = getOpenAIBaseUrlOrDefault();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, baseUrl, ...params }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${text}`);
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

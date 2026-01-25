import type { ChatMessage } from "@/types";

import { DEFAULT_OPENAI_BASE_URL } from "./apiUrlService";

export interface OpenAIChatParams {
  apiKey: string;
  baseUrl?: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: unknown;
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) return `${DEFAULT_OPENAI_BASE_URL}/chat/completions`;
  if (normalized.endsWith("/chat/completions")) return normalized;
  return `${normalized}/chat/completions`;
}

export async function openAIChatCompletion(
  params: OpenAIChatParams,
): Promise<string> {
  const response = await fetch(
    buildChatCompletionsUrl(params.baseUrl ?? DEFAULT_OPENAI_BASE_URL),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model ?? "gpt-4o-mini",
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        response_format: params.responseFormat,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API error (${response.status} ${response.statusText}): ${text}`,
    );
  }

  const json = (await response.json()) as OpenAIChatCompletionResponse;
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("OpenAI returned empty content.");
  return content;
}

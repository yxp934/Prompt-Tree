import type { ChatMessage } from "@/types";

export interface OpenAIChatParams {
  apiKey: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

export async function openAIChatCompletion(
  params: OpenAIChatParams,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    }),
  });

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


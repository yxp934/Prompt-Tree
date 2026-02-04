import { NextResponse } from "next/server";

import {
  openAIChatCompletion,
  openAIChatCompletionStream,
} from "@/lib/services/openaiClient";
import {
  DEFAULT_OPENAI_BASE_URL,
  normalizeOpenAIBaseUrl,
} from "@/lib/services/apiUrlService";
import type { ChatMessage, ChatRole } from "@/types";

function isChatRole(value: unknown): value is ChatRole {
  return value === "system" || value === "user" || value === "assistant";
}

function isChatContentPart(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; text?: unknown; image_url?: unknown };
  if (v.type === "text") return typeof v.text === "string";
  if (v.type === "image_url") {
    if (typeof v.image_url !== "object" || v.image_url === null) return false;
    const url = (v.image_url as { url?: unknown }).url;
    return typeof url === "string" && url.length > 0;
  }
  return false;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { role?: unknown; content?: unknown };
  if (!isChatRole(v.role)) return false;
  if (typeof v.content === "string") return true;
  if (Array.isArray(v.content) && v.content.every(isChatContentPart)) return true;
  return false;
}

function parseBaseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeOpenAIBaseUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }

  return normalized;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const b = body as {
      apiKey?: unknown;
      baseUrl?: unknown;
      messages?: unknown;
      model?: unknown;
      temperature?: unknown;
      maxTokens?: unknown;
      responseFormat?: unknown;
      stream?: unknown;
    };

    const apiKey =
      typeof b.apiKey === "string" && b.apiKey.trim()
        ? b.apiKey.trim()
        : process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OpenAI API key." },
        { status: 400 },
      );
    }

    const baseUrl =
      parseBaseUrl(b.baseUrl) ??
      parseBaseUrl(process.env.OPENAI_BASE_URL) ??
      DEFAULT_OPENAI_BASE_URL;

    if (!Array.isArray(b.messages) || !b.messages.every(isChatMessage)) {
      return NextResponse.json(
        { error: "Invalid messages payload." },
        { status: 400 },
      );
    }

    const stream = typeof b.stream === "boolean" ? b.stream : false;

    if (stream) {
      const upstream = await openAIChatCompletionStream({
        apiKey,
        baseUrl,
        messages: b.messages,
        model: typeof b.model === "string" ? b.model : undefined,
        temperature: typeof b.temperature === "number" ? b.temperature : undefined,
        maxTokens: typeof b.maxTokens === "number" ? b.maxTokens : undefined,
        responseFormat: b.responseFormat,
      });

      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const content = await openAIChatCompletion({
      apiKey,
      baseUrl,
      messages: b.messages,
      model: typeof b.model === "string" ? b.model : undefined,
      temperature: typeof b.temperature === "number" ? b.temperature : undefined,
      maxTokens: typeof b.maxTokens === "number" ? b.maxTokens : undefined,
      responseFormat: b.responseFormat,
    });

    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

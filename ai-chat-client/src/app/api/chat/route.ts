import { NextResponse } from "next/server";

import { openAIChatCompletion } from "@/lib/services/openaiClient";
import {
  DEFAULT_OPENAI_BASE_URL,
  normalizeOpenAIBaseUrl,
} from "@/lib/services/apiUrlService";
import type { ChatMessage, ChatRole } from "@/types";

function isChatRole(value: unknown): value is ChatRole {
  return value === "system" || value === "user" || value === "assistant";
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { role?: unknown; content?: unknown };
  return isChatRole(v.role) && typeof v.content === "string";
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

    const content = await openAIChatCompletion({
      apiKey,
      baseUrl,
      messages: b.messages,
      model: typeof b.model === "string" ? b.model : undefined,
      temperature: typeof b.temperature === "number" ? b.temperature : undefined,
      maxTokens: typeof b.maxTokens === "number" ? b.maxTokens : undefined,
    });

    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

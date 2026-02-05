import { NextResponse } from "next/server";

import {
  buildAuthHeaders,
  createTimeoutController,
  parseProviderRequest,
} from "../providers/utils";

export const runtime = "nodejs";

type EmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function buildEmbeddingsUrl(baseUrl: string): string {
  return `${baseUrl}/embeddings`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseProviderRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const payload = body as { model?: unknown; input?: unknown };
  const model =
    typeof payload.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : "";
  if (!model) {
    return NextResponse.json({ error: "Missing embedding model." }, { status: 400 });
  }

  const input =
    typeof payload.input === "string"
      ? payload.input
      : isStringArray(payload.input)
        ? payload.input
        : null;
  if (input == null) {
    return NextResponse.json({ error: "Invalid input payload." }, { status: 400 });
  }

  const { apiKey, baseUrl, headers, timeout } = parsed.data;
  const { signal, cancel } = createTimeoutController(timeout);

  try {
    const response = await fetch(buildEmbeddingsUrl(baseUrl), {
      method: "POST",
      headers: buildAuthHeaders(apiKey, headers),
      body: JSON.stringify({ model, input }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `Embeddings request failed (${response.status}): ${text || response.statusText}` },
        { status: 500 },
      );
    }

    const json = (await response.json().catch(() => null)) as EmbeddingsResponse | null;
    const embeddings = (json?.data ?? [])
      .map((item) => (Array.isArray(item.embedding) ? item.embedding : null))
      .filter((x): x is number[] => Boolean(x));

    if (typeof input === "string") {
      if (embeddings.length !== 1) {
        return NextResponse.json({ error: "Invalid embeddings response." }, { status: 500 });
      }
      return NextResponse.json({ embeddings });
    }

    if (embeddings.length !== input.length) {
      return NextResponse.json({ error: "Invalid embeddings response." }, { status: 500 });
    }

    return NextResponse.json({ embeddings });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Embeddings request timed out."
        : err instanceof Error
          ? err.message
          : "Unknown embeddings error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    cancel();
  }
}


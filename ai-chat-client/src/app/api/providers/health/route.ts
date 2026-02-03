import { NextResponse } from "next/server";

import { DEFAULT_OPENAI_BASE_URL } from "@/lib/services/apiUrlService";

import {
  buildAuthHeaders,
  buildChatCompletionsUrl,
  buildModelsUrl,
  coerceTimeout,
  createTimeoutController,
  parseBaseUrl,
  sanitizeHeaders,
} from "../utils";

type ProviderHealthRequest = {
  providerId?: unknown;
  baseUrl?: unknown;
  headers?: unknown;
  timeout?: unknown;
  apiKeys?: Array<{
    id?: unknown;
    value?: unknown;
    isPrimary?: unknown;
  }>;
};

type HealthResult = {
  keyId: string;
  status: "unknown" | "healthy" | "error" | "checking";
  error?: string;
  responseTime?: number;
};

async function checkByChat(
  key: { id: string; value: string },
  baseUrl: string,
  headers: Record<string, string>,
  timeout: number,
  startTime?: number,
): Promise<HealthResult> {
  const start = startTime ?? Date.now();
  const { signal, cancel } = createTimeoutController(timeout);

  try {
    const response = await fetch(buildChatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: buildAuthHeaders(key.value, headers),
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal,
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      const message =
        response.status === 401
          ? "errors.invalidApiKey"
          : `HTTP ${response.status}: ${response.statusText}`;
      return { keyId: key.id, status: "error", error: message, responseTime };
    }

    return { keyId: key.id, status: "healthy", responseTime };
  } catch (err) {
    const responseTime = Date.now() - start;
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "errors.requestTimeout"
        : err instanceof Error
          ? err.message
          : "errors.unknownError";
    return { keyId: key.id, status: "error", error: message, responseTime };
  } finally {
    cancel();
  }
}

async function checkKey(
  key: { id: string; value: string },
  baseUrl: string,
  headers: Record<string, string>,
  timeout: number,
): Promise<HealthResult> {
  const startTime = Date.now();
  const { signal, cancel } = createTimeoutController(timeout);

  try {
    const response = await fetch(buildModelsUrl(baseUrl), {
      method: "GET",
      headers: buildAuthHeaders(key.value, headers),
      signal,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 401) {
        return { keyId: key.id, status: "error", error: "errors.invalidApiKey", responseTime };
      }
      if (response.status === 404) {
        return await checkByChat(key, baseUrl, headers, timeout, startTime);
      }
      return {
        keyId: key.id,
        status: "error",
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    return { keyId: key.id, status: "healthy", responseTime };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "errors.requestTimeout"
        : err instanceof Error
          ? err.message
          : "errors.unknownError";
    return { keyId: key.id, status: "error", error: message, responseTime };
  } finally {
    cancel();
  }
}

async function fetchAvailableModels(
  apiKey: string,
  baseUrl: string,
  headers: Record<string, string>,
  timeout: number,
): Promise<string[] | null> {
  const { signal, cancel } = createTimeoutController(timeout);

  try {
    const response = await fetch(buildModelsUrl(baseUrl), {
      method: "GET",
      headers: buildAuthHeaders(apiKey, headers),
      signal,
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      return null;
    }

    const json = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: string }>; models?: Array<{ id?: string }> }
      | null;
    const rawModels = json?.data ?? json?.models ?? [];
    const ids = rawModels
      .filter((model) => model && typeof model.id === "string")
      .map((model) => model.id as string);

    return ids;
  } catch {
    return null;
  } finally {
    cancel();
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProviderHealthRequest | null;
  if (!body) {
    return NextResponse.json({ error: "errors.invalidRequestBody" }, { status: 400 });
  }

  const parsedBaseUrl = parseBaseUrl(body.baseUrl);
  if (typeof body.baseUrl === "string" && !parsedBaseUrl) {
    return NextResponse.json({ error: "errors.invalidBaseUrl" }, { status: 400 });
  }

  const baseUrl = parsedBaseUrl ?? DEFAULT_OPENAI_BASE_URL;
  const providerId = typeof body.providerId === "string" ? body.providerId : "unknown";
  const headers = sanitizeHeaders(body.headers);
  const timeout = coerceTimeout(body.timeout);
  const apiKeys = Array.isArray(body.apiKeys) ? body.apiKeys : [];

  const parsedKeys = apiKeys
    .map((key) => {
      if (typeof key?.id !== "string" || typeof key?.value !== "string") return null;
      return {
        id: key.id,
        value: key.value.trim(),
        isPrimary: Boolean(key.isPrimary),
      };
    })
    .filter((key): key is { id: string; value: string; isPrimary: boolean } => Boolean(key));

  if (parsedKeys.length === 0) {
    return NextResponse.json({
      providerId,
      status: "error",
      keyResults: [],
      checkedAt: Date.now(),
    });
  }

  const keyResults = await Promise.all(
    parsedKeys.map((key) => checkKey(key, baseUrl, headers, timeout)),
  );

  const allHealthy = keyResults.every((result) => result.status === "healthy");
  const someHealthy = keyResults.some((result) => result.status === "healthy");

  let status: "unknown" | "healthy" | "partial" | "error" | "checking" = "error";
  if (allHealthy && keyResults.length > 0) {
    status = "healthy";
  } else if (someHealthy) {
    status = "partial";
  }

  let availableModels: string[] | undefined;
  const primaryKey = parsedKeys.find((key) => key.isPrimary) ?? parsedKeys[0];
  if (primaryKey && keyResults.find((r) => r.keyId === primaryKey.id)?.status === "healthy") {
    const models = await fetchAvailableModels(primaryKey.value, baseUrl, headers, timeout);
    if (models) {
      availableModels = models;
    }
  }

  return NextResponse.json({
    providerId,
    status,
    keyResults,
    availableModels,
    checkedAt: Date.now(),
  });
}

import { DEFAULT_OPENAI_BASE_URL } from "@/lib/services/apiUrlService";

const DEFAULT_TIMEOUT = 30000;
const MIN_TIMEOUT = 3000;
const MAX_TIMEOUT = 120000;

export type ProviderRequestConfig = {
  apiKey: string;
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number;
};

export function normalizeProviderBaseUrl(value: string): string {
  const trimmed = value.trim();
  let normalized = trimmed.replace(/\/+$/, "");

  if (normalized.endsWith("/chat/completions")) {
    normalized = normalized.replace(/\/chat\/completions$/, "");
  }

  if (normalized.endsWith("/models")) {
    normalized = normalized.replace(/\/models$/, "");
  }

  if (!normalized.includes("/v1") && !normalized.includes("/api")) {
    if (normalized.includes("api.openai.com")) {
      normalized = `${normalized}/v1`;
    }
  }

  return normalized;
}

export function parseBaseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeProviderBaseUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }

  return normalized;
}

export function sanitizeHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const headers: Record<string, string> = {};

  for (const [key, headerValue] of entries) {
    if (typeof headerValue === "string" && headerValue.trim()) {
      headers[key] = headerValue;
    }
  }

  return headers;
}

export function coerceTimeout(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TIMEOUT;
  const rounded = Math.round(value);
  return Math.min(MAX_TIMEOUT, Math.max(MIN_TIMEOUT, rounded));
}

export function parseProviderRequest(body: unknown):
  | { data: ProviderRequestConfig }
  | { error: string; status: number } {
  if (typeof body !== "object" || body === null) {
    return { error: "errors.invalidRequestBody", status: 400 };
  }

  const payload = body as {
    apiKey?: unknown;
    baseUrl?: unknown;
    headers?: unknown;
    timeout?: unknown;
  };

  const apiKey =
    typeof payload.apiKey === "string" && payload.apiKey.trim()
      ? payload.apiKey.trim()
      : null;

  if (!apiKey) {
    return { error: "errors.missingApiKey", status: 400 };
  }

  const parsedBaseUrl = parseBaseUrl(payload.baseUrl);
  if (typeof payload.baseUrl === "string" && !parsedBaseUrl) {
    return { error: "errors.invalidBaseUrl", status: 400 };
  }

  return {
    data: {
      apiKey,
      baseUrl: parsedBaseUrl ?? DEFAULT_OPENAI_BASE_URL,
      headers: sanitizeHeaders(payload.headers),
      timeout: coerceTimeout(payload.timeout),
    },
  };
}

export function buildAuthHeaders(
  apiKey: string,
  headers: Record<string, string>,
): Record<string, string> {
  return {
    ...headers,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function buildModelsUrl(baseUrl: string): string {
  return `${baseUrl}/models`;
}

export function buildChatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl}/chat/completions`;
}

export function createTimeoutController(timeout: number): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

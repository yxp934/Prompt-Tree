/**
 * 提供商 API 服务
 * 处理 API 连接检测、模型列表获取等功能
 */

import type { Provider, ProviderHealthCheck, ModelConfig } from "@/types/provider";

type ProviderRequestOptions = {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
};

export type ProviderModelTestResult = {
  status: "healthy" | "error";
  error?: string;
  responseTime?: number;
  content?: string;
};

/**
 * API 密钥掩码显示
 */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}...`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/**
 * 标准化 Base URL
 */
export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
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

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

function buildRequestBody(
  apiKey: string,
  baseUrl: string,
  options?: ProviderRequestOptions,
): {
  apiKey: string;
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
} {
  return {
    apiKey,
    baseUrl: normalizeBaseUrl(baseUrl),
    headers: options?.headers,
    timeout: options?.timeout,
  };
}

/**
 * 获取可用的模型列表
 */
export async function fetchAvailableModels(
  apiKey: string,
  baseUrl: string,
  options?: ProviderRequestOptions,
): Promise<{ models: ModelConfig[]; error?: string }> {
  try {
    const response = await postJson<{
      models?: Array<{ id: string; object?: string }>;
      error?: string;
    }>("/api/providers/models", buildRequestBody(apiKey, baseUrl, options), options?.signal);

    if (response.error) {
      return { models: [], error: response.error };
    }

    const rawModels = response.models ?? [];
    const models: ModelConfig[] = rawModels
      .filter((model) => model && typeof model.id === "string")
      .map((model) => ({
        id: model.id,
        name: model.id,
        enabled: false,
        category: inferModelCategory(model.id, model.object),
      }));

    models.sort((a, b) => a.id.localeCompare(b.id));
    return { models };
  } catch (err) {
    if (err instanceof Error) {
      return { models: [], error: err.message };
    }
    return { models: [], error: "errors.unknownError" };
  }
}

/**
 * 检测整个提供商的健康状态
 */
export async function checkProviderHealth(
  provider: Provider,
  signal?: AbortSignal,
): Promise<ProviderHealthCheck> {
  try {
    const response = await postJson<ProviderHealthCheck>(
      "/api/providers/health",
      {
        providerId: provider.id,
        baseUrl: normalizeBaseUrl(provider.baseUrl),
        apiKeys: provider.apiKeys.map((key) => ({
          id: key.id,
          value: key.value,
          isPrimary: key.isPrimary,
        })),
        headers: provider.headers,
        timeout: provider.timeout,
      },
      signal,
    );

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "errors.connectionFailed";
    return {
      providerId: provider.id,
      status: "error",
      keyResults: provider.apiKeys.map((key) => ({
        keyId: key.id,
        status: "error",
        error: message,
      })),
      checkedAt: Date.now(),
    };
  }
}

/**
 * 测试指定模型
 */
export async function testProviderModel(
  apiKey: string,
  baseUrl: string,
  model: string,
  options?: ProviderRequestOptions & { prompt?: string },
): Promise<ProviderModelTestResult> {
  try {
    const response = await postJson<ProviderModelTestResult>(
      "/api/providers/test",
      {
        ...buildRequestBody(apiKey, baseUrl, options),
        model,
        prompt: options?.prompt,
      },
      options?.signal,
    );

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "errors.connectionFailed";
    return { status: "error", error: message };
  }
}

/**
 * 推断模型类型
 */
function inferModelCategory(modelId: string, objectType?: string): ModelConfig["category"] {
  const id = modelId.toLowerCase();

  if (id.includes("vision") || id.includes("image") || id.includes("gpt-4o") || id.includes("claude-3")) {
    return "vision";
  }
  if (id.includes("embed")) {
    return "embedding";
  }
  if (id.includes("reason") || id.includes("o1") || id.includes("r1")) {
    return "reasoning";
  }
  if (id.includes("tool")) {
    return "tool";
  }

  if (objectType === "embedding") {
    return "embedding";
  }

  return "chat";
}

/**
 * 模型分类显示名称
 */
export function getModelCategoryName(category: ModelConfig["category"]): string {
  const names: Record<string, string> = {
    chat: "Chat",
    reasoning: "Reasoning",
    vision: "Vision",
    embedding: "Embedding",
    tool: "Tool",
    completion: "Completion",
  };
  return names[category || "chat"] || "Other";
}

export const MODEL_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "reasoning", label: "Reasoning" },
  { value: "vision", label: "Vision" },
  { value: "embedding", label: "Embedding" },
  { value: "tool", label: "Tool" },
] as const;

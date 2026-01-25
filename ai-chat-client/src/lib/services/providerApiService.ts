/**
 * 提供商 API 服务
 * 处理 API 连接检测、模型列表获取等功能
 */

import type { Provider, ApiKey, ProviderHealthCheck, ModelConfig } from "@/types/provider";

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
  // 移除末尾斜杠
  let normalized = trimmed.replace(/\/+$/, "");
  // 如果没有 /v1 或类似路径，尝试添加
  if (!normalized.includes("/v1") && !normalized.includes("/api")) {
    // 检查是否是标准的 OpenAI 兼容端点
    if (normalized.includes("api.openai.com")) {
      normalized = `${normalized}/v1`;
    }
  }
  return normalized;
}

/**
 * 获取模型列表的 API 端点
 */
export function getModelsEndpoint(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}/models`;
}

/**
 * 获取聊天补全的 API 端点
 */
export function getChatEndpoint(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return `${normalized}/chat/completions`;
}

/**
 * 检测单个 API 密钥的可用性
 */
export async function checkApiKey(
  apiKey: ApiKey,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ status: "healthy" | "error"; error?: string; responseTime?: number }> {
  const startTime = Date.now();

  try {
    // 尝试获取模型列表
    const modelsUrl = getModelsEndpoint(baseUrl);
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey.value}`,
        "Content-Type": "application/json",
      },
      signal,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 401) {
        return { status: "error", error: "API 密钥无效", responseTime };
      }
      if (response.status === 404) {
        // 有些 API 不支持 /models 端点，尝试简单的 chat 请求
        return await checkBySimpleChat(apiKey, baseUrl, signal, startTime);
      }
      return {
        status: "error",
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    return { status: "healthy", responseTime };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { status: "error", error: "请求超时", responseTime };
      }
      return { status: "error", error: err.message, responseTime };
    }
    return { status: "error", error: "未知错误", responseTime };
  }
}

/**
 * 通过简单的 chat 请求检测 API
 */
async function checkBySimpleChat(
  apiKey: ApiKey,
  baseUrl: string,
  signal?: AbortSignal,
  startTime?: number,
): Promise<{ status: "healthy" | "error"; error?: string; responseTime?: number }> {
  const start = startTime ?? Date.now();

  try {
    const chatUrl = getChatEndpoint(baseUrl);
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal,
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      if (response.status === 401) {
        return { status: "error", error: "API 密钥无效", responseTime };
      }
      return {
        status: "error",
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    return { status: "healthy", responseTime };
  } catch (err) {
    const responseTime = Date.now() - start;
    if (err instanceof Error) {
      return { status: "error", error: err.message, responseTime };
    }
    return { status: "error", error: "未知错误", responseTime };
  }
}

/**
 * 获取可用的模型列表
 */
export async function fetchAvailableModels(
  apiKey: string,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ models: ModelConfig[]; error?: string }> {
  try {
    const modelsUrl = getModelsEndpoint(baseUrl);
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        // 不支持 /models 端点，返回空列表但不报错
        return { models: [] };
      }
      return { models: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const rawModels = data.data || data.models || [];

    // 转换为 ModelConfig 格式
    const models: ModelConfig[] = rawModels.map((model: { id: string; object?: string }) => ({
      id: model.id,
      name: model.id,
      enabled: false,
      category: inferModelCategory(model.id, model.object),
    }));

    // 按名称排序
    models.sort((a, b) => a.id.localeCompare(b.id));

    return { models };
  } catch (err) {
    if (err instanceof Error) {
      return { models: [], error: err.message };
    }
    return { models: [], error: "未知错误" };
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

  return "chat";
}

/**
 * 检测整个提供商的健康状态
 */
export async function checkProviderHealth(
  provider: Provider,
  signal?: AbortSignal,
): Promise<ProviderHealthCheck> {
  const keyResults = await Promise.all(
    provider.apiKeys.map(async (key) => {
      const result = await checkApiKey(key, provider.baseUrl, signal);
      return {
        keyId: key.id,
        status: result.status,
        error: result.error,
        responseTime: result.responseTime,
      };
    }),
  );

  // 确定整体状态
  const allHealthy = keyResults.every((r) => r.status === "healthy");
  const someHealthy = keyResults.some((r) => r.status === "healthy");

  let status: ProviderHealthCheck["status"] = "error";
  if (allHealthy && keyResults.length > 0) {
    status = "healthy";
  } else if (someHealthy) {
    status = "partial";
  }

  // 获取可用模型列表
  let availableModels: string[] | undefined;
  const primaryKey = provider.apiKeys.find((k) => k.isPrimary) || provider.apiKeys[0];
  if (primaryKey && keyResults.find((r) => r.keyId === primaryKey.id)?.status === "healthy") {
    const { models } = await fetchAvailableModels(primaryKey.value, provider.baseUrl, signal);
    availableModels = models.map((m) => m.id);
  }

  return {
    providerId: provider.id,
    status,
    keyResults,
    availableModels,
    checkedAt: Date.now(),
  };
}

/**
 * 模型分类显示名称
 */
export function getModelCategoryName(category: ModelConfig["category"]): string {
  const names: Record<string, string> = {
    chat: "对话",
    reasoning: "推理",
    vision: "视觉",
    embedding: "嵌入",
    tool: "工具",
    completion: "补全",
  };
  return names[category || "chat"] || "其他";
}

/**
 * 模型分类标签
 */
export const MODEL_CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "chat", label: "对话" },
  { value: "reasoning", label: "推理" },
  { value: "vision", label: "视觉" },
  { value: "embedding", label: "嵌入" },
  { value: "tool", label: "工具" },
] as const;

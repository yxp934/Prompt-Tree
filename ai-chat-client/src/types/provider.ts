/**
 * 提供商配置类型定义
 * 支持完全自定义的 OpenAI 兼容 API 提供商
 */

/**
 * 单个 API 密钥配置
 */
export interface ApiKey {
  id: string;
  /** 密钥值（存储时会被加密或掩码） */
  value: string;
  /** 密钥名称/备注 */
  name?: string;
  /** 是否为主密钥 */
  isPrimary?: boolean;
  /** 健康状态 */
  healthStatus?: "unknown" | "healthy" | "error" | "checking";
  /** 最后检测时间 */
  lastChecked?: number;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型 ID（如 gpt-4, claude-3-opus-20240229） */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 模型类型分类 */
  category?: "chat" | "completion" | "embedding" | "reasoning" | "vision" | "tool";
  /** 上下文窗口大小 */
  contextWindow?: number;
  /** 最大输出 token */
  maxOutputTokens?: number;
  /** 是否支持流式输出 */
  supportsStreaming?: boolean;
  /** 是否支持函数调用 */
  supportsFunctions?: boolean;
}

/**
 * 模型选择引用
 */
export interface ProviderModelSelection {
  providerId: string;
  modelId: string;
}

/**
 * API 提供商配置
 */
export interface Provider {
  /** 提供商唯一 ID */
  id: string;
  /** 提供商名称 */
  name: string;
  /** 提供商描述/备注 */
  description?: string;
  /** API 基础 URL */
  baseUrl: string;
  /** API 密钥列表 */
  apiKeys: ApiKey[];
  /** 已添加的模型列表 */
  models: ModelConfig[];
  /** 是否启用该提供商 */
  enabled: boolean;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 提供商连接检测结果
 */
export interface ProviderHealthCheck {
  providerId: string;
  /** 整体状态 */
  status: "unknown" | "healthy" | "partial" | "error" | "checking";
  /** 每个密钥的检测结果 */
  keyResults: Array<{
    keyId: string;
    status: "unknown" | "healthy" | "error" | "checking";
    error?: string;
    responseTime?: number;
  }>;
  /** 可用模型列表（从 API 获取） */
  availableModels?: string[];
  /** 检测时间 */
  checkedAt: number;
}

/**
 * 模型选择器状态
 */
export interface ModelSelectorState {
  /** 是否显示模型选择器 */
  open: boolean;
  /** 当前操作的提供商 ID */
  providerId: string | null;
  /** 搜索关键词 */
  searchQuery: string;
  /** 当前选中的分类标签 */
  activeTab: string;
  /** 已加载的可用模型（从 API 获取但未添加） */
  fetchedModels: ModelConfig[];
  /** 是否正在加载模型 */
  isLoading: boolean;
  /** 加载错误信息 */
  error: string | null;
}

/**
 * 设置页面状态
 */
export interface SettingsState {
  /** 提供商列表 */
  providers: Provider[];
  /** 当前选中的提供商 ID */
  selectedProviderId: string | null;
  /** 模型选择器状态 */
  modelSelector: ModelSelectorState;
  /** 健康检测结果 */
  healthChecks: Record<string, ProviderHealthCheck>;
}

/**
 * 获取提供商的默认配置
 */
export function createDefaultProvider(name: string): Provider {
  const now = Date.now();
  return {
    id: `provider_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    baseUrl: "https://api.openai.com/v1",
    apiKeys: [],
    models: [],
    enabled: true,
    timeout: 30000,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 创建 API 密钥配置
 */
export function createApiKey(value: string, name?: string): ApiKey {
  return {
    id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    value: value.trim(),
    name: name || `Key ${new Date().toLocaleDateString()}`,
    isPrimary: false,
    healthStatus: "unknown",
  };
}

/**
 * 创建模型配置
 */
export function createModelConfig(id: string, name?: string): ModelConfig {
  return {
    id,
    name: name || id,
    enabled: true,
  };
}

/**
 * 判断提供商是否可用配置
 */
export function isProviderConfigured(provider: Provider): boolean {
  return provider.apiKeys.length > 0 && provider.apiKeys.some((k) => k.value.length > 0);
}

/**
 * 获取提供商的主密钥
 */
export function getPrimaryApiKey(provider: Provider): ApiKey | null {
  const primary = provider.apiKeys.find((k) => k.isPrimary);
  if (primary) return primary;
  return provider.apiKeys[0] || null;
}

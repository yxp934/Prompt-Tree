/**
 * 提供商存储服务
 * 使用 localStorage 存储提供商配置
 */

import type { Provider } from "@/types/provider";

const PROVIDERS_STORAGE_KEY = "new-chat.providers";
const HEALTH_CHECKS_STORAGE_KEY = "new-chat.health_checks";

/**
 * 获取所有提供商
 */
export function getStoredProviders(): Provider[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(PROVIDERS_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as Provider[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 保存所有提供商
 */
export function setStoredProviders(providers: Provider[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROVIDERS_STORAGE_KEY, JSON.stringify(providers));
}

/**
 * 添加或更新提供商
 */
export function upsertProvider(provider: Provider): void {
  const providers = getStoredProviders();
  const index = providers.findIndex((p) => p.id === provider.id);
  const updated = { ...provider, updatedAt: Date.now() };

  if (index >= 0) {
    providers[index] = updated;
  } else {
    providers.push(updated);
  }

  setStoredProviders(providers);
}

/**
 * 删除提供商
 */
export function deleteProvider(providerId: string): void {
  const providers = getStoredProviders();
  const filtered = providers.filter((p) => p.id !== providerId);
  setStoredProviders(filtered);
}

/**
 * 获取单个提供商
 */
export function getProvider(providerId: string): Provider | null {
  const providers = getStoredProviders();
  return providers.find((p) => p.id === providerId) || null;
}

/**
 * 获取健康检测结果
 */
export function getStoredHealthChecks(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(HEALTH_CHECKS_STORAGE_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * 保存健康检测结果
 */
export function setStoredHealthChecks(checks: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HEALTH_CHECKS_STORAGE_KEY, JSON.stringify(checks));
}

/**
 * 提供商存储服务
 * 使用 localStorage 存储提供商配置
 */

import type { Provider } from "@/types/provider";

const PROVIDERS_STORAGE_KEY = "prompt-tree.providers.v1";
const HEALTH_CHECKS_STORAGE_KEY = "prompt-tree.health_checks.v1";

const LEGACY_PROVIDERS_KEYS = ["new-chat.providers"];
const LEGACY_HEALTH_CHECKS_KEYS = ["new-chat.health_checks"];

/**
 * 获取所有提供商
 */
export function getStoredProviders(): Provider[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(PROVIDERS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Provider[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Fall through to legacy keys.
    }
  }

  for (const legacyKey of LEGACY_PROVIDERS_KEYS) {
    const legacyStored = localStorage.getItem(legacyKey);
    if (!legacyStored) continue;
    try {
      const parsed = JSON.parse(legacyStored) as Provider[];
      if (!Array.isArray(parsed)) continue;
      localStorage.setItem(PROVIDERS_STORAGE_KEY, legacyStored);
      localStorage.removeItem(legacyKey);
      return parsed;
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * 保存所有提供商
 */
export function setStoredProviders(providers: Provider[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROVIDERS_STORAGE_KEY, JSON.stringify(providers));
  for (const legacyKey of LEGACY_PROVIDERS_KEYS) {
    localStorage.removeItem(legacyKey);
  }
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
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through to legacy keys.
    }
  }

  for (const legacyKey of LEGACY_HEALTH_CHECKS_KEYS) {
    const legacyStored = localStorage.getItem(legacyKey);
    if (!legacyStored) continue;
    try {
      const parsed = JSON.parse(legacyStored) as unknown;
      if (!parsed || typeof parsed !== "object") continue;
      localStorage.setItem(HEALTH_CHECKS_STORAGE_KEY, legacyStored);
      localStorage.removeItem(legacyKey);
      return parsed as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return {};
}

/**
 * 保存健康检测结果
 */
export function setStoredHealthChecks(checks: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HEALTH_CHECKS_STORAGE_KEY, JSON.stringify(checks));
  for (const legacyKey of LEGACY_HEALTH_CHECKS_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

export function clearStoredProviders(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROVIDERS_STORAGE_KEY);
  for (const legacyKey of LEGACY_PROVIDERS_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

export function clearStoredHealthChecks(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HEALTH_CHECKS_STORAGE_KEY);
  for (const legacyKey of LEGACY_HEALTH_CHECKS_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

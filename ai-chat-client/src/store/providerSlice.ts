/**
 * 提供商状态管理 Slice
 */

import type { StateCreator } from "zustand";

import type {
  Provider,
  ModelConfig,
  ProviderHealthCheck,
  ModelSelectorState,
  SettingsState,
  ApiKey,
} from "@/types/provider";
import {
  createDefaultProvider,
  createApiKey,
  createModelConfig,
  getPrimaryApiKey,
} from "@/types/provider";
import {
  getStoredProviders,
  setStoredProviders,
  upsertProvider,
  deleteProvider as deleteProviderFromStorage,
  getStoredHealthChecks,
  setStoredHealthChecks,
} from "@/lib/services/providerStorageService";
import {
  checkProviderHealth,
  fetchAvailableModels,
  maskApiKey,
} from "@/lib/services/providerApiService";

import type { AppStoreDeps, AppStoreState } from "./useStore";

export interface ProviderSlice {
  // ========== 状态 ==========
  providers: Provider[];
  selectedProviderId: string | null;
  modelSelector: ModelSelectorState;
  healthChecks: Record<string, ProviderHealthCheck>;

  // ========== 提供商操作 ==========
  loadProviders: () => void;
  addProvider: (name: string) => Provider;
  updateProvider: (providerId: string, updates: Partial<Provider>) => void;
  deleteProvider: (providerId: string) => void;
  selectProvider: (providerId: string | null) => void;
  toggleProviderEnabled: (providerId: string) => void;

  // ========== API 密钥操作 ==========
  addApiKey: (providerId: string, value: string, name?: string) => void;
  updateApiKey: (providerId: string, keyId: string, updates: Partial<ApiKey>) => void;
  deleteApiKey: (providerId: string, keyId: string) => void;
  setPrimaryApiKey: (providerId: string, keyId: string) => void;

  // ========== 模型操作 ==========
  addModel: (providerId: string, model: ModelConfig) => void;
  removeModel: (providerId: string, modelId: string) => void;
  toggleModelEnabled: (providerId: string, modelId: string) => void;
  updateModel: (providerId: string, modelId: string, updates: Partial<ModelConfig>) => void;

  // ========== 模型选择器操作 ==========
  openModelSelector: (providerId: string) => void;
  closeModelSelector: () => void;
  setModelSelectorSearch: (query: string) => void;
  setModelSelectorTab: (tab: string) => void;
  fetchModelsForSelector: (providerId: string) => Promise<void>;
  addFetchedModels: (modelIds: string[]) => void;

  // ========== 健康检测操作 ==========
  checkProviderHealth: (providerId: string, signal?: AbortSignal) => Promise<ProviderHealthCheck>;
  checkAllProviders: () => Promise<Record<string, ProviderHealthCheck>>;

  // ========== 获取器 ==========
  getProvider: (providerId: string) => Provider | null;
  getSelectedProvider: () => Provider | null;
}

export function createProviderSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], ProviderSlice> {
  // 初始化时加载存储的数据
  const storedProviders = getStoredProviders();
  const storedHealthChecks = getStoredHealthChecks() as Record<string, ProviderHealthCheck>;

  return (set, get) => ({
    // ========== 初始状态 ==========
    providers: storedProviders,
    selectedProviderId: storedProviders.length > 0 ? storedProviders[0].id : null,
    modelSelector: {
      open: false,
      providerId: null,
      searchQuery: "",
      activeTab: "all",
      fetchedModels: [],
      isLoading: false,
      error: null,
    },
    healthChecks: storedHealthChecks,

    // ========== 提供商操作 ==========
    loadProviders: () => {
      const providers = getStoredProviders();
      set({ providers });
    },

    addProvider: (name: string) => {
      const newProvider = createDefaultProvider(name);
      set((state) => ({
        providers: [...state.providers, newProvider],
        selectedProviderId: newProvider.id,
      }));
      upsertProvider(newProvider);
      return newProvider;
    },

    updateProvider: (providerId: string, updates: Partial<Provider>) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId ? { ...p, ...updates, updatedAt: Date.now() } : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    deleteProvider: (providerId: string) => {
      set((state) => {
        const providers = state.providers.filter((p) => p.id !== providerId);
        const selectedProviderId =
          state.selectedProviderId === providerId
            ? providers.length > 0
              ? providers[0].id
              : null
            : state.selectedProviderId;
        return { providers, selectedProviderId };
      });
      deleteProviderFromStorage(providerId);

      // 清理健康检测记录
      const healthChecks = { ...get().healthChecks };
      delete healthChecks[providerId];
      set({ healthChecks });
      setStoredHealthChecks(healthChecks);
    },

    selectProvider: (providerId: string | null) => {
      set({ selectedProviderId: providerId });
    },

    toggleProviderEnabled: (providerId: string) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId ? { ...p, enabled: !p.enabled, updatedAt: Date.now() } : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    // ========== API 密钥操作 ==========
    addApiKey: (providerId: string, value: string, name?: string) => {
      const newKey = createApiKey(value, name);
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                apiKeys: [...p.apiKeys, newKey],
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    updateApiKey: (providerId: string, keyId: string, updates: Partial<ApiKey>) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                apiKeys: p.apiKeys.map((k) => (k.id === keyId ? { ...k, ...updates } : k)),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    deleteApiKey: (providerId: string, keyId: string) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                apiKeys: p.apiKeys.filter((k) => k.id !== keyId),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    setPrimaryApiKey: (providerId: string, keyId: string) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                apiKeys: p.apiKeys.map((k) => ({
                  ...k,
                  isPrimary: k.id === keyId,
                })),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    // ========== 模型操作 ==========
    addModel: (providerId: string, model: ModelConfig) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                models: [...p.models, model],
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    removeModel: (providerId: string, modelId: string) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                models: p.models.filter((m) => m.id !== modelId),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    toggleModelEnabled: (providerId: string, modelId: string) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                models: p.models.map((m) =>
                  m.id === modelId ? { ...m, enabled: !m.enabled } : m,
                ),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    updateModel: (providerId: string, modelId: string, updates: Partial<ModelConfig>) => {
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                models: p.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });
      const provider = get().providers.find((p) => p.id === providerId);
      if (provider) {
        upsertProvider(provider);
      }
    },

    // ========== 模型选择器操作 ==========
    openModelSelector: (providerId: string) => {
      set({
        modelSelector: {
          open: true,
          providerId,
          searchQuery: "",
          activeTab: "all",
          fetchedModels: [],
          isLoading: false,
          error: null,
        },
      });
    },

    closeModelSelector: () => {
      set({
        modelSelector: {
          open: false,
          providerId: null,
          searchQuery: "",
          activeTab: "all",
          fetchedModels: [],
          isLoading: false,
          error: null,
        },
      });
    },

    setModelSelectorSearch: (query: string) => {
      set((state) => ({
        modelSelector: { ...state.modelSelector, searchQuery: query },
      }));
    },

    setModelSelectorTab: (tab: string) => {
      set((state) => ({
        modelSelector: { ...state.modelSelector, activeTab: tab },
      }));
    },

    fetchModelsForSelector: async (providerId: string) => {
      const provider = get().providers.find((p) => p.id === providerId);
      if (!provider) return;

      const primaryKey = getPrimaryApiKey(provider);
      if (!primaryKey) {
        set((state) => ({
          modelSelector: { ...state.modelSelector, error: "请先配置 API 密钥" },
        }));
        return;
      }

      set((state) => ({
        modelSelector: { ...state.modelSelector, isLoading: true, error: null },
      }));

      try {
        const result = await fetchAvailableModels(primaryKey.value, provider.baseUrl);
        set((state) => ({
          modelSelector: {
            ...state.modelSelector,
            fetchedModels: result.models,
            isLoading: false,
            error: result.error ?? null,
          },
        }));
      } catch (err) {
        const error = err instanceof Error ? err.message : "获取模型列表失败";
        set((state) => ({
          modelSelector: {
            ...state.modelSelector,
            isLoading: false,
            error,
          },
        }));
      }
    },

    addFetchedModels: (modelIds: string[]) => {
      const { modelSelector } = get();
      const providerId = modelSelector.providerId;
      if (!providerId) return;

      const provider = get().providers.find((p) => p.id === providerId);
      if (!provider) return;

      const existingIds = new Set(provider.models.map((m) => m.id));
      const newModels = modelSelector.fetchedModels.filter(
        (m) => modelIds.includes(m.id) && !existingIds.has(m.id),
      );

      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                models: [...p.models, ...newModels],
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });

      const updatedProvider = get().providers.find((p) => p.id === providerId);
      if (updatedProvider) {
        upsertProvider(updatedProvider);
      }
    },

    // ========== 健康检测操作 ==========
    checkProviderHealth: async (providerId: string, signal?: AbortSignal) => {
      const provider = get().providers.find((p) => p.id === providerId);
      if (!provider) {
        throw new Error("Provider not found");
      }

      const result = await checkProviderHealth(provider, signal);

      set((state) => ({
        healthChecks: {
          ...state.healthChecks,
          [providerId]: result,
        },
      }));

      // 更新密钥健康状态
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId
            ? {
                ...p,
                apiKeys: p.apiKeys.map((k) => {
                  const keyResult = result.keyResults.find((r) => r.keyId === k.id);
                  return keyResult
                    ? { ...k, healthStatus: keyResult.status, lastChecked: result.checkedAt }
                    : k;
                }),
                updatedAt: Date.now(),
              }
            : p,
        );
        return { providers };
      });

      const updatedProvider = get().providers.find((p) => p.id === providerId);
      if (updatedProvider) {
        upsertProvider(updatedProvider);
      }

      // 保存健康检测结果
      const healthChecks = { ...get().healthChecks, [providerId]: result };
      setStoredHealthChecks(healthChecks);

      return result;
    },

    checkAllProviders: async () => {
      const { providers } = get();
      const results: Record<string, ProviderHealthCheck> = {};

      for (const provider of providers) {
        if (provider.enabled && provider.apiKeys.length > 0) {
          results[provider.id] = await get().checkProviderHealth(provider.id);
        }
      }

      return results;
    },

    // ========== 获取器 ==========
    getProvider: (providerId: string) => {
      return get().providers.find((p) => p.id === providerId) || null;
    },

    getSelectedProvider: () => {
      const { selectedProviderId, providers } = get();
      if (!selectedProviderId) return null;
      return providers.find((p) => p.id === selectedProviderId) || null;
    },
  });
}

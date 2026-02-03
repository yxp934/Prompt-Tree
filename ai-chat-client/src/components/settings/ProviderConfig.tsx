/**
 * 提供商配置面板组件
 * 显示在右侧，包含 API 密钥、Base URL 和模型列表
 * 增加间距和呼吸感
 */

"use client";

import { useEffect, useState } from "react";

import { useAppStore } from "@/store/useStore";
import { useT } from "@/lib/i18n/useT";
import { normalizeBaseUrl } from "@/lib/services/providerApiService";
import type { ApiKey, ModelConfig } from "@/types/provider";

import {
  KeyIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  RefreshIcon,
  SearchIcon,
} from "./icons";

/**
 * API 密钥输入组件 - 宁静禅意风格
 */
function ApiKeyInput({
  apiKey,
  onUpdate,
  onDelete,
  onSetPrimary,
  isPrimary,
}: {
  apiKey: ApiKey;
  onUpdate: (updates: Partial<ApiKey>) => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  isPrimary: boolean;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.value);
    } catch {
      // 忽略复制错误
    }
  };

  const healthColor = {
    healthy: "text-matcha-green",
    error: "text-red-500",
    checking: "text-kintsugi-gold",
    unknown: "text-stone-gray",
  }[apiKey.healthStatus || "unknown"];

  return (
    <div className="group relative rounded-xl border border-parchment/10 bg-washi-cream p-5 transition-all duration-300 hover:border-matcha-green/20 hover:shadow-sm">
      {/* 顶部信息栏 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={apiKey.name || ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t("providerConfig.apiKeys.namePlaceholder")}
            className="w-32 bg-transparent font-zen-body text-sm font-normal text-ink-black outline-none placeholder:text-stone-gray/50"
          />
          {isPrimary && (
            <span className="rounded-lg bg-kintsugi-gold/10 px-2 py-1 font-zen-body text-xs text-kintsugi-gold font-light">
              {t("providerConfig.apiKeys.primary")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={`flex-shrink-0 ${healthColor}`}>
            {apiKey.healthStatus === "healthy" ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
            ) : apiKey.healthStatus === "error" ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6m0-6 6 6" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            )}
          </span>
        </div>
      </div>

      {/* 密钥值输入 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={apiKey.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="sk-..."
            className="w-full rounded-lg border border-parchment/20 bg-shoji-white px-4 py-3 pr-10 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-gray transition-colors hover:text-ink-black"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {!isPrimary && (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 font-zen-body text-xs text-stone-gray font-light transition-colors hover:text-matcha-green"
              onClick={onSetPrimary}
            >
              {t("providerConfig.apiKeys.setPrimary")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-stone-gray transition-colors hover:text-ink-black"
            onClick={handleCopy}
            title={t("common.copy")}
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-stone-gray transition-colors hover:text-red-500"
            onClick={onDelete}
            title={t("common.delete")}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 模型列表项组件 - 宁静禅意风格
 */
function ModelItem({
  model,
  onRemove,
  onToggleEnabled,
  onToggleStreaming,
}: {
  model: ModelConfig;
  onRemove: () => void;
  onToggleEnabled: () => void;
  onToggleStreaming: () => void;
}) {
  const t = useT();
  const streamingEnabled = model.supportsStreaming ?? false;
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-parchment/10 bg-washi-cream px-4 py-3 transition-all duration-300 hover:border-matcha-green/20">
      {/* 启用开关 */}
      <button
        type="button"
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border transition-all duration-300 ${
          model.enabled
            ? "border-matcha-green bg-matcha-green text-shoji-white"
            : "border-stone-gray/30 bg-transparent text-transparent hover:border-stone-gray/50"
        }`}
        onClick={onToggleEnabled}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l6 6 8-8" />
        </svg>
      </button>

      {/* 模型信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-ink-black truncate font-light">
          {model.id}
        </div>
        {model.name !== model.id && (
          <div className="font-zen-body text-xs text-stone-gray truncate font-light">
            {model.name}
          </div>
        )}
      </div>

      <button
        type="button"
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] transition-all ${
          streamingEnabled
            ? "border-copper/50 bg-copper/10 text-copper"
            : "border-parchment/40 text-sand hover:border-copper/40 hover:text-ink"
        }`}
        onClick={onToggleStreaming}
      >
        <span
          className={`h-2 w-2 rounded-full border ${
            streamingEnabled
              ? "border-copper bg-copper"
              : "border-parchment/60 bg-transparent"
          }`}
        />
        {t("providerConfig.models.streaming")}
      </button>

      {/* 删除按钮 */}
      <button
        type="button"
        className="flex-shrink-0 rounded-lg p-2 text-stone-gray opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
        onClick={onRemove}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

/**
 * 空状态组件 - 宁静禅意风格
 */
function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-1.5 border-dashed border-parchment/20 bg-washi-cream/50 p-10 text-center">
      <div className="mb-4 rounded-xl bg-shoji-white p-4 text-stone-gray">
        <Icon className="h-8 w-8" />
      </div>
      <p className="mb-2 font-zen-body text-sm text-stone-gray font-light">
        {title}
      </p>
      <p className="font-zen-body text-xs text-stone-gray/70 font-light">
        {description}
      </p>
    </div>
  );
}

/**
 * 添加 API 密钥对话框
 */
function AddApiKeyDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (value: string, name?: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setValue("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedValue = value.trim();
    const trimmedName = name.trim();
    if (!trimmedValue) return;
    onAdd(trimmedValue, trimmedName || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-ink-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-shoji-white p-8 shadow-lg border border-parchment/10">
        <h3 className="mb-6 font-zen-display text-2xl font-light text-ink-black tracking-wide">
          {t("providerConfig.addKey.title")}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="mb-2 block font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
              {t("providerConfig.addKey.nameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("providerConfig.addKey.namePlaceholder")}
              className="w-full rounded-xl border border-parchment/20 bg-washi-cream px-5 py-4 font-zen-body text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
              {t("providerConfig.addKey.valueLabel")}
            </label>
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="sk-..."
              className="w-full rounded-xl border border-parchment/20 bg-washi-cream px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-xl border border-parchment/20 px-6 py-3 font-zen-body text-sm text-stone-gray transition-all duration-200 hover:border-stone-gray/30 hover:text-ink-black"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-matcha-green px-6 py-3 font-zen-body text-sm text-shoji-white transition-all duration-200 hover:bg-bamboo-light"
            >
              {t("common.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 提供商配置面板主组件
 */
export function ProviderConfig() {
  const t = useT();
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const updateProvider = useAppStore((s) => s.updateProvider);
  const updateModel = useAppStore((s) => s.updateModel);
  const addApiKey = useAppStore((s) => s.addApiKey);
  const updateApiKey = useAppStore((s) => s.updateApiKey);
  const deleteApiKey = useAppStore((s) => s.deleteApiKey);
  const setPrimaryApiKey = useAppStore((s) => s.setPrimaryApiKey);
  const removeModel = useAppStore((s) => s.removeModel);
  const toggleModelEnabled = useAppStore((s) => s.toggleModelEnabled);
  const checkProviderHealth = useAppStore((s) => s.checkProviderHealth);
  const openModelSelector = useAppStore((s) => s.openModelSelector);

  const [providerName, setProviderName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId) || null;

  useEffect(() => {
    if (selectedProvider) {
      setProviderName(selectedProvider.name);
      setBaseUrl(selectedProvider.baseUrl);
    } else {
      setProviderName("");
      setBaseUrl("");
    }
    setCheckError(null);
  }, [selectedProviderId]);

  const handleUpdateName = (name: string) => {
    setProviderName(name);
    if (selectedProvider) {
      updateProvider(selectedProvider.id, { name });
    }
  };

  const handleUpdateBaseUrl = (url: string) => {
    setBaseUrl(url);
    if (selectedProvider) {
      updateProvider(selectedProvider.id, { baseUrl: normalizeBaseUrl(url) });
    }
  };

  const handleAddApiKey = () => {
    if (!selectedProvider) return;
    setShowAddKeyDialog(true);
  };

  const handleCheckConnection = async () => {
    if (!selectedProvider) return;
    setIsChecking(true);
    setCheckError(null);
    try {
      await checkProviderHealth(selectedProvider.id);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : t("errors.connectionFailed"));
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmAddKey = (value: string, name?: string) => {
    if (!selectedProvider) return;
    addApiKey(selectedProvider.id, value, name);
  };

  const enabledModels = selectedProvider?.models.filter((m) => m.enabled) ?? [];
  const disabledModels = selectedProvider?.models.filter((m) => !m.enabled) ?? [];

  if (!selectedProvider) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-shoji-white">
        <EmptyState
          icon={(props) => (
            <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M17.5 19c0-1.7-1.3-3-3-3h-11c-1.7 0-3 1.3-3 3s1.3 3 3 3h11c1.7 0 3-1.3 3-3z" />
              <path d="M19 16c2.8 0 5-2.2 5-5s-2.2-5-5-5c-.5 0-1 .1-1.4.2" />
              <path d="M6.5 6C8.4 3.7 11.5 2.5 14.5 3c2.3.4 4.3 1.9 5.5 4" />
            </svg>
          )}
          title={t("providerConfig.empty.title")}
          description={t("providerConfig.empty.description")}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-1 flex-col bg-shoji-white">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-parchment/10 px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-matcha-green text-xl font-medium text-shoji-white shadow-sm">
              {selectedProvider.name.charAt(0).toUpperCase()}
            </div>
            <input
              type="text"
              value={providerName}
              onChange={(e) => handleUpdateName(e.target.value)}
              className="bg-transparent font-zen-display text-2xl font-light text-ink-black outline-none tracking-wide"
            />
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              className={`flex items-center gap-2.5 rounded-lg px-5 py-3 font-zen-body text-sm transition-all duration-300 ${
                isChecking
                  ? "bg-washi-cream text-stone-gray cursor-wait"
                  : "bg-matcha-green/10 text-matcha-green hover:bg-matcha-green/20 font-light"
              }`}
              onClick={handleCheckConnection}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <RefreshIcon />
                  {t("providerConfig.check.running")}
                </>
              ) : (
                <>
                  <RefreshIcon />
                  {t("providerConfig.check.button")}
                </>
              )}
            </button>
            {checkError && (
              <p className="font-zen-body text-xs text-red-500 font-light">
                {checkError}
              </p>
            )}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl px-8 py-8">
            {/* API 密钥 */}
            <section className="mb-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-washi-cream p-2.5 text-stone-gray">
                  <KeyIcon />
                </div>
                <h3 className="font-zen-display text-xl font-light text-ink-black tracking-wide">
                  {t("providerConfig.apiKeys.title")}
                </h3>
              </div>

              <div className="space-y-3">
                {selectedProvider.apiKeys.map((apiKey) => (
                  <ApiKeyInput
                    key={apiKey.id}
                    apiKey={apiKey}
                    onUpdate={(updates) =>
                      updateApiKey(selectedProvider.id, apiKey.id, updates)
                    }
                    onDelete={() => deleteApiKey(selectedProvider.id, apiKey.id)}
                    onSetPrimary={() => setPrimaryApiKey(selectedProvider.id, apiKey.id)}
                    isPrimary={apiKey.isPrimary || selectedProvider.apiKeys.length === 1}
                  />
                ))}
              </div>

              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border-1.5 border-dashed border-parchment/30 bg-washi-cream/50 px-5 py-4 font-zen-body text-sm text-stone-gray transition-all duration-300 hover:border-matcha-green/50 hover:bg-matcha-green/5 hover:text-matcha-green font-light"
                onClick={handleAddApiKey}
              >
                <PlusIcon />
                {t("providerConfig.apiKeys.add")}
              </button>
            </section>

            {/* API 地址 */}
            <section className="mb-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-lg bg-washi-cream p-2.5 text-stone-gray">
                  <LinkIcon />
                </div>
                <h3 className="font-zen-display text-xl font-light text-ink-black tracking-wide">
                  {t("providerConfig.baseUrl.title")}
                </h3>
              </div>

              <div>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => handleUpdateBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-xl border border-parchment/20 bg-washi-cream px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
                />
                <p className="mt-3 font-zen-body text-xs text-stone-gray font-light">
                  {t("providerConfig.baseUrl.preview", {
                    url: `${normalizeBaseUrl(baseUrl)}/chat/completions`,
                  })}
                </p>
              </div>
            </section>

            {/* 模型列表 */}
            <section>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-washi-cream p-2.5 text-stone-gray">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <path d="M9 9h6v6H9z" />
                    </svg>
                  </div>
                  <h3 className="font-zen-display text-xl font-light text-ink-black tracking-wide">
                    {t("providerConfig.models.title")}
                  </h3>
                  <span className="rounded-full bg-washi-cream px-3 py-1 font-mono text-xs text-stone-gray font-light">
                    {selectedProvider.models.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-parchment/20 bg-washi-cream px-4 py-2.5 font-zen-body text-sm text-stone-gray transition-all duration-300 hover:border-matcha-green/50 hover:text-matcha-green font-light"
                  onClick={() => openModelSelector(selectedProvider.id)}
                >
                  <SearchIcon />
                  {t("providerConfig.models.select")}
                </button>
              </div>

              {selectedProvider.models.length === 0 ? (
                <EmptyState
                  icon={(props) => (
                    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <path d="M9 9h6v6H9z" />
                    </svg>
                  )}
                  title={t("providerConfig.models.empty.title")}
                  description={t("providerConfig.models.empty.description")}
                />
              ) : (
                <div className="space-y-6">
                  {/* 已启用的模型 */}
                  {enabledModels.length > 0 && (
                    <div>
                      <div className="mb-3 font-mono text-xs text-stone-gray font-light">
                        {t("providerConfig.models.enabled", { count: enabledModels.length })}
                      </div>
                      <div className="space-y-2">
                        {enabledModels.map((model) => (
                          <ModelItem
                            key={model.id}
                            model={model}
                            onRemove={() => removeModel(selectedProvider.id, model.id)}
                            onToggleEnabled={() =>
                              toggleModelEnabled(selectedProvider.id, model.id)
                            }
                            onToggleStreaming={() =>
                              updateModel(selectedProvider.id, model.id, {
                                supportsStreaming: !(model.supportsStreaming ?? false),
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 未启用的模型 */}
                  {disabledModels.length > 0 && (
                    <div>
                      <div className="mb-3 font-mono text-xs text-stone-gray font-light">
                        {t("providerConfig.models.disabled", { count: disabledModels.length })}
                      </div>
                      <div className="space-y-2">
                        {disabledModels.map((model) => (
                          <ModelItem
                            key={model.id}
                            model={model}
                            onRemove={() => removeModel(selectedProvider.id, model.id)}
                            onToggleEnabled={() =>
                              toggleModelEnabled(selectedProvider.id, model.id)
                            }
                            onToggleStreaming={() =>
                              updateModel(selectedProvider.id, model.id, {
                                supportsStreaming: !(model.supportsStreaming ?? false),
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <AddApiKeyDialog
        open={showAddKeyDialog}
        onClose={() => setShowAddKeyDialog(false)}
        onAdd={handleConfirmAddKey}
      />
    </>
  );
}

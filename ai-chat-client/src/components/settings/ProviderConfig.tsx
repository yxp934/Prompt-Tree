/**
 * 提供商配置面板组件
 * 显示在右侧，包含 API 密钥、Base URL 和模型列表
 */

"use client";

import { useState } from "react";

import { useAppStore } from "@/store/useStore";
import { maskApiKey, normalizeBaseUrl } from "@/lib/services/providerApiService";
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
  CheckIcon,
  SearchIcon,
} from "./icons";

/**
 * API 密钥输入组件
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
  const [visible, setVisible] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.value);
      // 可以添加复制成功提示
    } catch {
      // 忽略复制错误
    }
  };

  const healthColor = {
    healthy: "text-machine",
    error: "text-red-500",
    checking: "text-copper",
    unknown: "text-sand",
  }[apiKey.healthStatus || "unknown"];

  return (
    <div className="group relative rounded-xl border border-parchment bg-cream p-3 transition-colors hover:border-parchment/80">
      {/* 顶部信息栏 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={apiKey.name || ""}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="API 密钥"
            className="bg-transparent font-body text-[0.85rem] font-medium text-ink outline-none placeholder:text-sand"
          />
          {isPrimary && (
            <span className="rounded bg-copper/10 px-1.5 py-0.5 font-mono text-[0.65rem] text-copper">
              主密钥
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 健康状态指示器 */}
          <span className={`flex-shrink-0 ${healthColor}`}>
            {apiKey.healthStatus === "healthy" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
            ) : apiKey.healthStatus === "error" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6m0-6 6 6" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            )}
          </span>
        </div>
      </div>

      {/* 密钥值输入 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type={visible ? "text" : "password"}
            value={apiKey.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="sk-..."
            className="w-full rounded-lg border border-parchment bg-paper px-3 py-2 font-mono text-[0.8rem] text-ink outline-none transition-all duration-200 focus:border-copper"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sand transition-colors hover:text-ink"
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {!isPrimary && (
            <button
              type="button"
              className="rounded px-2 py-1 font-mono text-[0.7rem] text-sand transition-colors hover:text-copper"
              onClick={onSetPrimary}
            >
              设为主密钥
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-sand transition-colors hover:text-ink"
            onClick={handleCopy}
            title="复制"
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-sand transition-colors hover:text-red-500"
            onClick={onDelete}
            title="删除"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 模型列表项组件
 */
function ModelItem({
  model,
  onRemove,
  onToggleEnabled,
}: {
  model: ModelConfig;
  onRemove: () => void;
  onToggleEnabled: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-parchment bg-cream px-3 py-2.5 transition-colors hover:border-parchment/80">
      {/* 启用开关 */}
      <button
        type="button"
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all duration-150 ${
          model.enabled
            ? "border-copper bg-copper text-white"
            : "border-parchment bg-transparent text-transparent hover:border-sand"
        }`}
        onClick={onToggleEnabled}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l6 6 8-8" />
        </svg>
      </button>

      {/* 模型信息 */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[0.8rem] text-ink truncate">
          {model.id}
        </div>
        {model.name !== model.id && (
          <div className="font-body text-[0.75rem] text-sand truncate">
            {model.name}
          </div>
        )}
      </div>

      {/* 删除按钮 */}
      <button
        type="button"
        className="flex-shrink-0 rounded p-1 text-sand opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
        onClick={onRemove}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

/**
 * 提供商配置面板主组件
 */
export function ProviderConfig() {
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const updateProvider = useAppStore((s) => s.updateProvider);
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

  const selectedProvider = providers.find((p) => p.id === selectedProviderId) || null;

  // 同步当前选中的提供商数据到表单
  useState(() => {
    if (selectedProvider) {
      setProviderName(selectedProvider.name);
      setBaseUrl(selectedProvider.baseUrl);
    }
  });

  if (!selectedProvider) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-paper">
        <div className="text-center">
          <div className="mb-4 text-sand">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="mx-auto"
            >
              <path d="M17.5 19c0-1.7-1.3-3-3-3h-11c-1.7 0-3 1.3-3 3s1.3 3 3 3h11c1.7 0 3-1.3 3-3z" />
              <path d="M19 16c2.8 0 5-2.2 5-5s-2.2-5-5-5c-.5 0-1 .1-1.4.2" />
              <path d="M6.5 6C8.4 3.7 11.5 2.5 14.5 3c2.3.4 4.3 1.9 5.5 4" />
            </svg>
          </div>
          <p className="font-body text-[0.9rem] text-clay">
            请选择或添加一个提供商
          </p>
        </div>
      </div>
    );
  }

  const handleUpdateName = (name: string) => {
    setProviderName(name);
    updateProvider(selectedProvider.id, { name });
  };

  const handleUpdateBaseUrl = (url: string) => {
    setBaseUrl(url);
    updateProvider(selectedProvider.id, { baseUrl: normalizeBaseUrl(url) });
  };

  const handleAddApiKey = () => {
    const value = prompt("请输入 API 密钥：");
    if (value?.trim()) {
      addApiKey(selectedProvider.id, value.trim());
    }
  };

  const handleCheckConnection = async () => {
    setIsChecking(true);
    try {
      await checkProviderHealth(selectedProvider.id);
    } finally {
      setIsChecking(false);
    }
  };

  const enabledModels = selectedProvider.models.filter((m) => m.enabled);
  const disabledModels = selectedProvider.models.filter((m) => !m.enabled);

  return (
    <div className="flex h-full flex-1 flex-col bg-paper">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-parchment px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-machine text-lg font-medium text-paper">
            {selectedProvider.name.charAt(0).toUpperCase()}
          </div>
          <input
            type="text"
            value={providerName}
            onChange={(e) => handleUpdateName(e.target.value)}
            className="bg-transparent font-display text-xl text-ink outline-none"
          />
        </div>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-[0.85rem] transition-all duration-150 ${
            isChecking
              ? "bg-parchment text-clay cursor-wait"
              : "bg-copper/10 text-copper hover:bg-copper/20"
          }`}
          onClick={handleCheckConnection}
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <RefreshIcon />
              检测中...
            </>
          ) : (
            <>
              <RefreshIcon />
              检测连接
            </>
          )}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-6 py-6">
          {/* API 密钥 */}
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <KeyIcon />
              <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                API 密钥
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
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-parchment px-4 py-3 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-copper hover:text-copper"
              onClick={handleAddApiKey}
            >
              <PlusIcon />
              添加密钥
            </button>
          </section>

          {/* API 地址 */}
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <LinkIcon />
              <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                API 地址
              </h3>
            </div>

            <div>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => handleUpdateBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full rounded-xl border border-parchment bg-cream px-4 py-3 font-mono text-[0.85rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
              />
              <p className="mt-2 font-body text-[0.75rem] text-sand">
                预览: {normalizeBaseUrl(baseUrl)}/chat/completions
              </p>
            </div>
          </section>

          {/* 模型列表 */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                <h3 className="font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                  模型
                </h3>
                <span className="rounded-full bg-parchment px-2 py-0.5 font-mono text-[0.7rem] text-clay">
                  {selectedProvider.models.length}
                </span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-parchment bg-cream px-3 py-2 font-body text-[0.8rem] text-clay transition-all duration-150 hover:border-copper hover:text-copper"
                onClick={() => openModelSelector(selectedProvider.id)}
              >
                <SearchIcon />
                选择模型
              </button>
            </div>

            {selectedProvider.models.length === 0 ? (
              <div className="rounded-xl border border-dashed border-parchment bg-cream p-8 text-center">
                <p className="mb-2 font-body text-[0.9rem] text-clay">
                  暂无模型
                </p>
                <p className="font-body text-[0.8rem] text-sand">
                  点击「选择模型」添加
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 已启用的模型 */}
                {enabledModels.length > 0 && (
                  <div>
                    <div className="mb-2 font-mono text-[0.7rem] text-sand">
                      已启用
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
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 未启用的模型 */}
                {disabledModels.length > 0 && (
                  <div>
                    <div className="mb-2 font-mono text-[0.7rem] text-sand">
                      未启用
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
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { deleteDB } from "@/lib/db/indexedDB";
import { getOpenAIApiKey, setOpenAIApiKey } from "@/lib/services/apiKeyService";
import {
  DEFAULT_OPENAI_BASE_URL,
  getOpenAIBaseUrlOrDefault,
  setOpenAIBaseUrl,
} from "@/lib/services/apiUrlService";
import {
  DEFAULT_LLM_SETTINGS,
  type LLMSettings,
} from "@/lib/services/llmSettingsService";
import { testProviderModel } from "@/lib/services/providerApiService";
import {
  clearStoredHealthChecks,
  clearStoredProviders,
} from "@/lib/services/providerStorageService";
import { getPrimaryApiKey, type ModelConfig } from "@/types/provider";
import { useAppStore } from "@/store/useStore";

import { CheckIcon, EyeIcon, EyeOffIcon, RefreshIcon, SearchIcon } from "./icons";

type PanelShellProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

function PanelShell({ title, description, action, children }: PanelShellProps) {
  return (
    <div className="flex h-full flex-1 flex-col bg-shoji-white">
      <div className="border-b border-parchment/10 px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-zen-display text-2xl font-light text-ink-black tracking-wide">
              {title}
            </h2>
            {description && (
              <p className="mt-2 max-w-xl font-zen-body text-sm text-stone-gray font-light">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl px-8 py-8">{children}</div>
      </div>
    </div>
  );
}

function PanelEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-1.5 border-dashed border-parchment/20 bg-washi-cream/50 p-10 text-center">
      <div className="mb-4 rounded-xl bg-shoji-white p-4 text-stone-gray">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </div>
      <p className="mb-2 font-zen-body text-sm text-stone-gray font-light">{title}</p>
      <p className="font-zen-body text-xs text-stone-gray/70 font-light">
        {description}
      </p>
    </div>
  );
}

export function DefaultModelPanel() {
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const model = useAppStore((s) => s.model);
  const setLLMSettings = useAppStore((s) => s.setLLMSettings);
  const openModelSelector = useAppStore((s) => s.openModelSelector);

  const [modelValue, setModelValue] = useState(model);
  const [testStatus, setTestStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId) ?? null;

  const availableModels = useMemo(() => {
    if (!selectedProvider) return [];
    const enabled = selectedProvider.models.filter((m) => m.enabled);
    const models = enabled.length > 0 ? enabled : selectedProvider.models;
    return [...models].sort((a, b) => a.id.localeCompare(b.id));
  }, [selectedProvider]);

  useEffect(() => {
    setModelValue(model);
  }, [model]);

  const handleModelChange = (value: string) => {
    setModelValue(value);
    setLLMSettings({ model: value });
  };

  const handleTestModel = async () => {
    if (!selectedProvider) return;
    const primaryKey = getPrimaryApiKey(selectedProvider);
    if (!primaryKey) {
      setTestStatus("error");
      setTestMessage("请先配置 API 密钥");
      return;
    }

    const modelToTest = modelValue.trim() || model;
    if (!modelToTest) {
      setTestStatus("error");
      setTestMessage("请先选择模型");
      return;
    }

    setTestStatus("running");
    setTestMessage(null);
    setTestLatency(null);

    const result = await testProviderModel(primaryKey.value, selectedProvider.baseUrl, modelToTest, {
      headers: selectedProvider.headers,
      timeout: selectedProvider.timeout,
      prompt: "ping",
    });

    setTestLatency(result.responseTime ?? null);
    if (result.status === "healthy") {
      setTestStatus("success");
      setTestMessage(result.content || "连接成功");
      return;
    }

    setTestStatus("error");
    setTestMessage(result.error || "测试失败");
  };

  const statusColor = {
    idle: "text-stone-gray",
    running: "text-kintsugi-gold",
    success: "text-matcha-green",
    error: "text-red-500",
  }[testStatus];

  if (!selectedProvider) {
    return (
      <PanelShell title="默认模型" description="为对话选择默认的推理模型。">
        <PanelEmptyState title="尚未选择提供商" description="请先在模型服务中添加并选择一个提供商。" />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="默认模型"
      description="选择对话默认使用的模型，并进行连接测试。"
      action={
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-parchment/20 bg-washi-cream px-4 py-2.5 font-zen-body text-sm text-stone-gray transition-all duration-300 hover:border-matcha-green/50 hover:text-matcha-green font-light"
          onClick={() => openModelSelector(selectedProvider.id)}
        >
          <SearchIcon />
          选择模型
        </button>
      }
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-3 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            当前提供商
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-zen-display text-xl font-light text-ink-black">
                {selectedProvider.name}
              </p>
              <p className="mt-1 font-mono text-xs text-stone-gray">
                {selectedProvider.baseUrl}
              </p>
            </div>
            <div className="rounded-full bg-shoji-white px-3 py-1 font-mono text-xs text-stone-gray">
              {selectedProvider.models.length} models
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-3 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            默认模型
          </div>
          <input
            list="default-model-options"
            value={modelValue}
            onChange={(event) => handleModelChange(event.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
          />
          <datalist id="default-model-options">
            {availableModels.map((m: ModelConfig) => (
              <option key={m.id} value={m.id} />
            ))}
          </datalist>
          <p className="mt-3 font-zen-body text-xs text-stone-gray font-light">
            {availableModels.length > 0
              ? "支持手动输入自定义模型 ID"
              : "尚未添加模型，可通过“选择模型”从 API 获取"}
          </p>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
                模型测试
              </div>
              {testLatency !== null && (
                <div className="mt-2 font-mono text-xs text-stone-gray">
                  响应时间 {testLatency}ms
                </div>
              )}
            </div>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-zen-body text-sm transition-all duration-300 ${
                testStatus === "running"
                  ? "bg-washi-cream text-stone-gray cursor-wait"
                  : "bg-matcha-green/10 text-matcha-green hover:bg-matcha-green/20 font-light"
              }`}
              onClick={handleTestModel}
              disabled={testStatus === "running"}
            >
              {testStatus === "running" ? (
                <>
                  <RefreshIcon />
                  测试中...
                </>
              ) : (
                <>
                  <CheckIcon />
                  测试模型
                </>
              )}
            </button>
          </div>
          {testMessage && (
            <p className={`mt-3 font-zen-body text-xs font-light ${statusColor}`}>
              {testMessage}
            </p>
          )}
        </section>
      </div>
    </PanelShell>
  );
}

export function GeneralSettingsPanel() {
  const temperature = useAppStore((s) => s.temperature);
  const maxTokens = useAppStore((s) => s.maxTokens);
  const setLLMSettings = useAppStore((s) => s.setLLMSettings);

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OPENAI_BASE_URL);
  const [temperatureValue, setTemperatureValue] = useState(temperature.toString());
  const [maxTokensValue, setMaxTokensValue] = useState(maxTokens.toString());
  const [showKey, setShowKey] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(getOpenAIApiKey() ?? "");
    setBaseUrl(getOpenAIBaseUrlOrDefault());
  }, []);

  useEffect(() => {
    setTemperatureValue(temperature.toString());
  }, [temperature]);

  useEffect(() => {
    setMaxTokensValue(maxTokens.toString());
  }, [maxTokens]);

  const handleSave = () => {
    const parsedTemperature = Number.parseFloat(temperatureValue);
    const parsedMaxTokens = Number.parseInt(maxTokensValue, 10);
    const nextSettings: Partial<LLMSettings> = {
      temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : temperature,
      maxTokens: Number.isFinite(parsedMaxTokens) ? parsedMaxTokens : maxTokens,
    };

    setOpenAIApiKey(apiKey);
    setOpenAIBaseUrl(baseUrl);
    setLLMSettings(nextSettings);

    setSaveMessage("设置已保存");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  return (
    <PanelShell title="常规设置" description="管理默认 API 连接和基础生成参数。">
      <div className="space-y-8">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-4 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            API 连接
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block font-zen-body text-xs text-stone-gray font-light">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 pr-10 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-gray transition-colors hover:text-ink-black"
                  onClick={() => setShowKey((prev) => !prev)}
                >
                  {showKey ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block font-zen-body text-xs text-stone-gray font-light">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={DEFAULT_OPENAI_BASE_URL}
                className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-4 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            生成参数
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-zen-body text-xs text-stone-gray font-light">
                Temperature
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperatureValue}
                onChange={(event) => setTemperatureValue(event.target.value)}
                className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-zen-body text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
              />
            </div>
            <div>
              <label className="mb-2 block font-zen-body text-xs text-stone-gray font-light">
                Max Tokens
              </label>
              <input
                type="number"
                min="1"
                value={maxTokensValue}
                onChange={(event) => setMaxTokensValue(event.target.value)}
                className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-zen-body text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-zen-body text-xs text-stone-gray font-light">
            {saveMessage ?? "修改将保存到本地浏览器"}
          </div>
          <button
            type="button"
            className="rounded-lg bg-matcha-green px-6 py-3 font-zen-body text-sm text-shoji-white transition-all duration-200 hover:bg-bamboo-light"
            onClick={handleSave}
          >
            保存设置
          </button>
        </div>
      </div>
    </PanelShell>
  );
}

export function DisplaySettingsPanel() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const options = [
    { id: "light", label: "浅色", description: "适合白天或自然光环境" },
    { id: "dark", label: "深色", description: "适合夜间或弱光环境" },
  ] as const;

  return (
    <PanelShell title="显示设置" description="切换应用整体主题。">
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`rounded-2xl border px-6 py-5 text-left transition-all duration-300 ${
              theme === option.id
                ? "border-matcha-green/40 bg-matcha-green/10"
                : "border-parchment/20 bg-washi-cream/50 hover:border-matcha-green/40"
            }`}
            onClick={() => setTheme(option.id)}
          >
            <div className="font-zen-display text-lg font-light text-ink-black">
              {option.label}
            </div>
            <div className="mt-2 font-zen-body text-xs text-stone-gray font-light">
              {option.description}
            </div>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

export function DataSettingsPanel() {
  const setLLMSettings = useAppStore((s) => s.setLLMSettings);
  const setTheme = useAppStore((s) => s.setTheme);

  const [clearingData, setClearingData] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleClearData = async () => {
    setClearingData(true);
    setStatusMessage(null);
    try {
      await deleteDB();
      setStatusMessage("对话数据已清除，正在刷新...");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "清除失败");
      setClearingData(false);
    }
  };

  const handleResetSettings = async () => {
    setResetting(true);
    setStatusMessage(null);
    try {
      setOpenAIApiKey("");
      setOpenAIBaseUrl("");
      clearStoredProviders();
      clearStoredHealthChecks();
      setLLMSettings(DEFAULT_LLM_SETTINGS);
      setTheme("light");
      setStatusMessage("设置已重置，正在刷新...");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "重置失败");
      setResetting(false);
    }
  };

  return (
    <PanelShell title="数据设置" description="管理本地存储的对话数据与设置。">
      <div className="space-y-6">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-display text-lg font-light text-ink-black">
                清除对话数据
              </div>
              <p className="mt-2 font-zen-body text-xs text-stone-gray font-light">
                删除 IndexedDB 中保存的全部对话记录。
              </p>
            </div>
            {!confirmClear ? (
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 font-zen-body text-sm text-red-600 transition-all duration-200 hover:bg-red-100"
                onClick={() => setConfirmClear(true)}
              >
                清除数据
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white"
                  onClick={handleClearData}
                  disabled={clearingData}
                >
                  {clearingData ? "清除中..." : "确认清除"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-parchment/30 px-4 py-2 text-sm text-stone-gray"
                  onClick={() => setConfirmClear(false)}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-display text-lg font-light text-ink-black">
                重置设置
              </div>
              <p className="mt-2 font-zen-body text-xs text-stone-gray font-light">
                清空提供商配置、API Key 与主题设置。
              </p>
            </div>
            {!confirmReset ? (
              <button
                type="button"
                className="rounded-lg border border-parchment/30 bg-shoji-white px-5 py-2.5 font-zen-body text-sm text-stone-gray transition-all duration-200 hover:border-matcha-green/50 hover:text-matcha-green"
                onClick={() => setConfirmReset(true)}
              >
                重置设置
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-matcha-green px-4 py-2 text-sm text-shoji-white"
                  onClick={handleResetSettings}
                  disabled={resetting}
                >
                  {resetting ? "重置中..." : "确认重置"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-parchment/30 px-4 py-2 text-sm text-stone-gray"
                  onClick={() => setConfirmReset(false)}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </section>

        {statusMessage && (
          <p className="font-zen-body text-xs text-stone-gray font-light">
            {statusMessage}
          </p>
        )}
      </div>
    </PanelShell>
  );
}

export function AboutPanel() {
  const items = [
    { label: "版本", value: "Cortex v1.0.0" },
    { label: "框架", value: "Next.js 14 + React 18" },
    { label: "数据存储", value: "IndexedDB + LocalStorage" },
    { label: "界面风格", value: "Zen Serenity" },
  ];

  return (
    <PanelShell title="关于" description="了解 Cortex 的技术与版本信息。">
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-parchment/20 bg-washi-cream/50 px-6 py-4"
          >
            <span className="font-zen-body text-sm text-stone-gray font-light">
              {item.label}
            </span>
            <span className="font-zen-display text-lg font-light text-ink-black">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

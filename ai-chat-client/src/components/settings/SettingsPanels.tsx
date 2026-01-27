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
import {
  buildModelSelectionKey,
  getEnabledModelOptions,
  type EnabledModelOption,
} from "@/lib/services/providerModelService";
import { testProviderModel } from "@/lib/services/providerApiService";
import {
  clearStoredHealthChecks,
  clearStoredProviders,
} from "@/lib/services/providerStorageService";
import { getPrimaryApiKey, type ProviderModelSelection } from "@/types/provider";
import { useAppStore } from "@/store/useStore";

import { CheckIcon, EyeIcon, EyeOffIcon, RefreshIcon } from "./icons";

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
  const compressionModel = useAppStore((s) => s.compressionModel);
  const summaryModel = useAppStore((s) => s.summaryModel);
  const setLLMSettings = useAppStore((s) => s.setLLMSettings);
  const selectedModels = useAppStore((s) => s.selectedModels);
  const setSelectedModels = useAppStore((s) => s.setSelectedModels);

  const [testStatus, setTestStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const enabledOptions = useMemo(
    () => getEnabledModelOptions(providers),
    [providers],
  );
  const selectedKeys = useMemo(
    () => new Set(selectedModels.map(buildModelSelectionKey)),
    [selectedModels],
  );

  const groupedOptions = useMemo(() => {
    const grouped = new Map<
      string,
      { providerId: string; providerName: string; models: EnabledModelOption[] }
    >();
    for (const option of enabledOptions) {
      if (!grouped.has(option.providerId)) {
        grouped.set(option.providerId, {
          providerId: option.providerId,
          providerName: option.providerName,
          models: [],
        });
      }
      grouped.get(option.providerId)!.models.push(option);
    }
    return Array.from(grouped.values()).sort((a, b) =>
      a.providerName.localeCompare(b.providerName),
    );
  }, [enabledOptions]);

  useEffect(() => {
    const availableKeys = new Set(enabledOptions.map(buildModelSelectionKey));
    const next = selectedModels.filter((selection) =>
      availableKeys.has(buildModelSelectionKey(selection)),
    );
    if (next.length !== selectedModels.length) {
      setSelectedModels(next);
    }
  }, [enabledOptions, selectedModels, setSelectedModels]);

  useEffect(() => {
    const availableKeys = new Set(enabledOptions.map(buildModelSelectionKey));
    const compressionKey = compressionModel
      ? buildModelSelectionKey(compressionModel)
      : null;
    if (compressionKey && !availableKeys.has(compressionKey)) {
      setLLMSettings({ compressionModel: null });
    }
    const summaryKey = summaryModel ? buildModelSelectionKey(summaryModel) : null;
    if (summaryKey && !availableKeys.has(summaryKey)) {
      setLLMSettings({ summaryModel: null });
    }
  }, [compressionModel, enabledOptions, setLLMSettings, summaryModel]);

  const toSelection = (option: EnabledModelOption): ProviderModelSelection => ({
    providerId: option.providerId,
    modelId: option.modelId,
  });

  const handleToggleSelection = (option: EnabledModelOption) => {
    const key = buildModelSelectionKey(option);
    const exists = selectedKeys.has(key);
    const next = exists
      ? selectedModels.filter((selection) => buildModelSelectionKey(selection) !== key)
      : [...selectedModels, toSelection(option)];
    setSelectedModels(next);
  };

  const handleSelectAll = () => {
    setSelectedModels(enabledOptions.map((option) => toSelection(option)));
  };

  const handleClearAll = () => {
    setSelectedModels([]);
  };

  const handleTestModel = async () => {
    const selection = selectedModels[0];
    if (!selection) {
      setTestStatus("error");
      setTestMessage("请先选择模型");
      return;
    }

    const provider = providers.find((item) => item.id === selection.providerId) ?? null;
    if (!provider) {
      setTestStatus("error");
      setTestMessage("模型服务商不存在");
      return;
    }

    const primaryKey = getPrimaryApiKey(provider);
    if (!primaryKey) {
      setTestStatus("error");
      setTestMessage("请先配置 API 密钥");
      return;
    }

    setTestStatus("running");
    setTestMessage(null);
    setTestLatency(null);

    const result = await testProviderModel(primaryKey.value, provider.baseUrl, selection.modelId, {
      headers: provider.headers,
      timeout: provider.timeout,
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

  const compressionKey = compressionModel
    ? buildModelSelectionKey(compressionModel)
    : "";
  const summaryKey = summaryModel ? buildModelSelectionKey(summaryModel) : "";

  const handleCompressionChange = (value: string) => {
    const option = enabledOptions.find(
      (item) => buildModelSelectionKey(item) === value,
    );
    setLLMSettings({
      compressionModel: option ? toSelection(option) : null,
      ...(option ? { model: option.modelId } : {}),
    });
  };

  const handleSummaryChange = (value: string) => {
    const option = enabledOptions.find(
      (item) => buildModelSelectionKey(item) === value,
    );
    setLLMSettings({ summaryModel: option ? toSelection(option) : null });
  };

  return (
    <PanelShell
      title="模型设置"
      description="选择对话分支模型，并配置压缩与标题总结模型。"
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
                已启用模型
              </div>
              <p className="mt-2 font-zen-body text-sm text-stone-gray font-light">
                选择多个模型后，发送消息将并行生成多个分支回复。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-parchment/20 bg-shoji-white px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                onClick={handleSelectAll}
                disabled={enabledOptions.length === 0}
              >
                全选
              </button>
              <button
                type="button"
                className="rounded-lg border border-parchment/20 bg-shoji-white px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                onClick={handleClearAll}
                disabled={selectedModels.length === 0}
              >
                清空
              </button>
            </div>
          </div>

          {enabledOptions.length === 0 ? (
            <div className="mt-6">
              <PanelEmptyState
                title="暂无启用模型"
                description="请先在模型服务中启用模型。"
              />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {groupedOptions.map((group) => (
                <div key={group.providerId}>
                  <div className="mb-3 font-zen-body text-xs text-stone-gray font-light">
                    {group.providerName}
                  </div>
                  <div className="space-y-2">
                    {group.models.map((option) => {
                      const isSelected = selectedKeys.has(buildModelSelectionKey(option));
                      return (
                        <button
                          key={option.modelId}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                            isSelected
                              ? "border-matcha-green/40 bg-matcha-green/10"
                              : "border-parchment/20 bg-shoji-white hover:border-matcha-green/30"
                          }`}
                          onClick={() => handleToggleSelection(option)}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border text-[0.7rem] ${
                              isSelected
                                ? "border-matcha-green bg-matcha-green text-shoji-white"
                                : "border-parchment bg-transparent text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <div className="flex-1">
                            <div className="font-mono text-sm text-ink-black">
                              {option.modelId}
                            </div>
                            <div className="text-xs text-stone-gray font-light">
                              {option.label}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-3 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            压缩模型
          </div>
          <select
            value={compressionKey}
            onChange={(event) => handleCompressionChange(event.target.value)}
            disabled={enabledOptions.length === 0}
            className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50 disabled:opacity-60"
          >
            <option value="">请选择压缩模型</option>
            {enabledOptions.map((option) => (
              <option
                key={`${option.providerId}-${option.modelId}`}
                value={buildModelSelectionKey(option)}
              >
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-3 font-zen-body text-xs text-stone-gray font-light">
            用于生成压缩节点的摘要与元指令建议。
          </p>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-3 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            总结模型
          </div>
          <select
            value={summaryKey}
            onChange={(event) => handleSummaryChange(event.target.value)}
            disabled={enabledOptions.length === 0}
            className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50 disabled:opacity-60"
          >
            <option value="">请选择总结模型</option>
            {enabledOptions.map((option) => (
              <option
                key={`${option.providerId}-${option.modelId}`}
                value={buildModelSelectionKey(option)}
              >
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-3 font-zen-body text-xs text-stone-gray font-light">
            用于首条消息后生成不超过 6 个字的对话标题。
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
              disabled={testStatus === "running" || selectedModels.length === 0}
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

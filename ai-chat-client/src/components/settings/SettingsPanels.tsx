"use client";

import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/common/Modal";
import { deleteDB } from "@/lib/db/indexedDB";
import { setOpenAIApiKey } from "@/lib/services/apiKeyService";
import { setOpenAIBaseUrl } from "@/lib/services/apiUrlService";
import {
  DEFAULT_LLM_SETTINGS,
  type LLMSettings,
} from "@/lib/services/llmSettingsService";
import {
  buildModelSelectionKey,
  getEnabledModelOptions,
  type EnabledModelOption,
} from "@/lib/services/providerModelService";
import { useT } from "@/lib/i18n/useT";
import { testProviderModel } from "@/lib/services/providerApiService";
import {
  clearStoredHealthChecks,
  clearStoredProviders,
} from "@/lib/services/providerStorageService";
import { getPrimaryApiKey, type ProviderModelSelection } from "@/types/provider";
import { useAppStore } from "@/store/useStore";

import { CheckIcon, EyeIcon, EyeOffIcon, RefreshIcon } from "./icons";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
  const t = useT();
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
      setTestMessage(t("settings.defaultModel.test.selectModelFirst"));
      return;
    }

    const provider = providers.find((item) => item.id === selection.providerId) ?? null;
    if (!provider) {
      setTestStatus("error");
      setTestMessage(t("settings.defaultModel.test.providerMissing"));
      return;
    }

    const primaryKey = getPrimaryApiKey(provider);
    if (!primaryKey) {
      setTestStatus("error");
      setTestMessage(t("errors.missingApiKey"));
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
      setTestMessage(result.content || t("settings.defaultModel.test.success"));
      return;
    }

    setTestStatus("error");
    setTestMessage(result.error || t("settings.defaultModel.test.failed"));
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
      title={t("settings.defaultModel.title")}
      description={t("settings.defaultModel.description")}
    >
      <div className="space-y-8">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
                {t("settings.defaultModel.enabledModels.title")}
              </div>
              <p className="mt-2 font-zen-body text-sm text-stone-gray font-light">
                {t("settings.defaultModel.enabledModels.description")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-parchment/20 bg-shoji-white px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                onClick={handleSelectAll}
                disabled={enabledOptions.length === 0}
              >
                {t("common.selectAll")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-parchment/20 bg-shoji-white px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                onClick={handleClearAll}
                disabled={selectedModels.length === 0}
              >
                {t("common.clear")}
              </button>
            </div>
          </div>

          {enabledOptions.length === 0 ? (
            <div className="mt-6">
              <PanelEmptyState
                title={t("settings.defaultModel.enabledModels.emptyTitle")}
                description={t("settings.defaultModel.enabledModels.emptyDescription")}
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
            {t("settings.defaultModel.compressionModel.title")}
          </div>
          <select
            value={compressionKey}
            onChange={(event) => handleCompressionChange(event.target.value)}
            disabled={enabledOptions.length === 0}
            className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50 disabled:opacity-60"
          >
            <option value="">{t("settings.defaultModel.compressionModel.placeholder")}</option>
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
            {t("settings.defaultModel.compressionModel.description")}
          </p>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-3 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            {t("settings.defaultModel.summaryModel.title")}
          </div>
          <select
            value={summaryKey}
            onChange={(event) => handleSummaryChange(event.target.value)}
            disabled={enabledOptions.length === 0}
            className="w-full rounded-xl border border-parchment/20 bg-shoji-white px-5 py-4 font-mono text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50 disabled:opacity-60"
          >
            <option value="">{t("settings.defaultModel.summaryModel.placeholder")}</option>
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
            {t("settings.defaultModel.summaryModel.description")}
          </p>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
                {t("settings.defaultModel.test.title")}
              </div>
              {testLatency !== null && (
                <div className="mt-2 font-mono text-xs text-stone-gray">
                  {t("settings.defaultModel.test.latency", { ms: testLatency })}
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
                  {t("settings.defaultModel.test.running")}
                </>
              ) : (
                <>
                  <CheckIcon />
                  {t("settings.defaultModel.test.button")}
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
  const t = useT();
  const temperature = useAppStore((s) => s.temperature);
  const maxTokens = useAppStore((s) => s.maxTokens);
  const setLLMSettings = useAppStore((s) => s.setLLMSettings);

  const [temperatureValue, setTemperatureValue] = useState(temperature.toString());
  const [maxTokensValue, setMaxTokensValue] = useState(maxTokens.toString());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

    setLLMSettings(nextSettings);

    setSaveMessage(t("settings.general.saved"));
    setTimeout(() => setSaveMessage(null), 2000);
  };

  return (
    <PanelShell title={t("settings.general.title")} description={t("settings.general.description")}>
      <div className="space-y-8">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-4 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            {t("settings.general.generation.title")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-zen-body text-xs text-stone-gray font-light">
                {t("settings.general.generation.temperature")}
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
                {t("settings.general.generation.maxTokens")}
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
            {saveMessage ?? t("settings.general.saveHint")}
          </div>
          <button
            type="button"
            className="rounded-lg bg-matcha-green px-6 py-3 font-zen-body text-sm text-shoji-white transition-all duration-200 hover:bg-bamboo-light"
            onClick={handleSave}
          >
            {t("settings.general.saveButton")}
          </button>
        </div>
      </div>
    </PanelShell>
  );
}

export function DisplaySettingsPanel() {
  const t = useT();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const themeOptions = [
    {
      id: "light",
      label: t("settings.display.theme.light"),
      description: t("settings.display.theme.lightDesc"),
    },
    {
      id: "dark",
      label: t("settings.display.theme.dark"),
      description: t("settings.display.theme.darkDesc"),
    },
  ] as const;

  const languageOptions = [
    {
      id: "en",
      label: t("settings.display.language.en"),
      description: t("settings.display.language.enDesc"),
    },
    {
      id: "zh-CN",
      label: t("settings.display.language.zhCN"),
      description: t("settings.display.language.zhCNDesc"),
    },
  ] as const;

  return (
    <PanelShell title={t("settings.display.title")} description={t("settings.display.description")}>
      <div className="space-y-8">
        <section>
          <div className="mb-4 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            {t("settings.display.theme")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {themeOptions.map((option) => (
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
        </section>

        <section>
          <div className="mb-4 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            {t("settings.display.language")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {languageOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`rounded-2xl border px-6 py-5 text-left transition-all duration-300 ${
                  locale === option.id
                    ? "border-matcha-green/40 bg-matcha-green/10"
                    : "border-parchment/20 bg-washi-cream/50 hover:border-matcha-green/40"
                }`}
                onClick={() => setLocale(option.id)}
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
        </section>
      </div>
    </PanelShell>
  );
}

export function DataSettingsPanel() {
  const t = useT();
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
      setStatusMessage(t("settings.data.clear.success"));
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : t("settings.data.clear.failed"));
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
      setStatusMessage(t("settings.data.reset.success"));
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : t("settings.data.reset.failed"));
      setResetting(false);
    }
  };

  return (
    <PanelShell title={t("settings.data.title")} description={t("settings.data.description")}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-display text-lg font-light text-ink-black">
                {t("settings.data.clear.title")}
              </div>
              <p className="mt-2 font-zen-body text-xs text-stone-gray font-light">
                {t("settings.data.clear.description")}
              </p>
            </div>
            {!confirmClear ? (
              <button
                type="button"
                className="rounded-lg border border-red-200 bg-red-50 px-5 py-2.5 font-zen-body text-sm text-red-600 transition-all duration-200 hover:bg-red-100"
                onClick={() => setConfirmClear(true)}
              >
                {t("settings.data.clear.button")}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white"
                  onClick={handleClearData}
                  disabled={clearingData}
                >
                  {clearingData ? t("settings.data.clear.running") : t("settings.data.clear.confirm")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-parchment/30 px-4 py-2 text-sm text-stone-gray"
                  onClick={() => setConfirmClear(false)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-display text-lg font-light text-ink-black">
                {t("settings.data.reset.title")}
              </div>
              <p className="mt-2 font-zen-body text-xs text-stone-gray font-light">
                {t("settings.data.reset.description")}
              </p>
            </div>
            {!confirmReset ? (
              <button
                type="button"
                className="rounded-lg border border-parchment/30 bg-shoji-white px-5 py-2.5 font-zen-body text-sm text-stone-gray transition-all duration-200 hover:border-matcha-green/50 hover:text-matcha-green"
                onClick={() => setConfirmReset(true)}
              >
                {t("settings.data.reset.button")}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-matcha-green px-4 py-2 text-sm text-shoji-white"
                  onClick={handleResetSettings}
                  disabled={resetting}
                >
                  {resetting ? t("settings.data.reset.running") : t("settings.data.reset.confirm")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-parchment/30 px-4 py-2 text-sm text-stone-gray"
                  onClick={() => setConfirmReset(false)}
                >
                  {t("common.cancel")}
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
  const t = useT();
  const items = [
    { label: t("settings.about.version.label"), value: t("settings.about.version.value") },
    { label: t("settings.about.framework.label"), value: t("settings.about.framework.value") },
    { label: t("settings.about.storage.label"), value: t("settings.about.storage.value") },
    { label: t("settings.about.contact.email"), value: "yxp934@outlook.com" },
    { label: t("settings.about.contact.wechat"), value: "WanguA8" },
  ];

  return (
    <PanelShell title={t("settings.about.title")} description={t("settings.about.description")}>
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

export function ToolSettingsPanel() {
  const t = useT();
  const toolSettings = useAppStore((s) => s.toolSettings);
  const setToolSettings = useAppStore((s) => s.setToolSettings);
  const upsertMcpServer = useAppStore((s) => s.upsertMcpServer);
  const deleteMcpServer = useAppStore((s) => s.deleteMcpServer);

  const [showTavilyKey, setShowTavilyKey] = useState(false);
  const [showExaKey, setShowExaKey] = useState(false);

  type SearchTestStatus = "idle" | "running" | "success" | "error";
  type SearchTestState = {
    status: SearchTestStatus;
    message?: string;
    latencyMs?: number;
  };

  const [searchTest, setSearchTest] = useState<SearchTestState>({ status: "idle" });

  const testWebSearch = async () => {
    const provider = toolSettings.search.provider;
    const providerLabel = provider === "exa" ? "Exa" : "Tavily";
    const apiKey =
      provider === "exa" ? toolSettings.search.exaApiKey : toolSettings.search.tavilyApiKey;

    if (!apiKey.trim()) {
      setSearchTest({
        status: "error",
        message: t("settings.tools.search.missingApiKey", { provider: providerLabel }),
      });
      return;
    }

    setSearchTest({ status: "running", message: undefined, latencyMs: undefined });
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/tools/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          query: "OpenAI",
          maxResults: 1,
          searchDepth: toolSettings.search.searchDepth,
        }),
      });

      const latencyMs = Math.max(0, Date.now() - startedAt);
      const json = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const error =
          isRecord(json) && "error" in json ? String(json.error ?? "") : "";
        throw new Error(
          error || t("errors.requestFailedWithStatus", { status: response.status }),
        );
      }

      const firstTitle =
        isRecord(json) &&
        Array.isArray(json.results) &&
        json.results[0] &&
        isRecord(json.results[0]) &&
        typeof json.results[0].title === "string"
          ? json.results[0].title
          : "";

      setSearchTest({
        status: "success",
        latencyMs,
        message: firstTitle
          ? t("settings.tools.search.test.successWithTitle", { title: firstTitle })
          : t("settings.tools.search.test.success"),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("settings.tools.search.test.failed");
      setSearchTest({ status: "error", message });
    }
  };

  const searchStatusColor = {
    idle: "text-stone-gray",
    running: "text-kintsugi-gold",
    success: "text-matcha-green",
    error: "text-red-500",
  }[searchTest.status];

  type McpTestStatus = "idle" | "running" | "success" | "error";
  type McpToolInfo = { name: string; description?: string; inputSchema?: unknown };
  type McpTestState = {
    status: McpTestStatus;
    message?: string;
    latencyMs?: number;
    tools?: McpToolInfo[];
    logs?: string[];
    testedAt?: number;
  };

  const [mcpTests, setMcpTests] = useState<Record<string, McpTestState>>({});
  const [mcpToolsOpen, setMcpToolsOpen] = useState<Record<string, boolean>>({});
  const [mcpLogsOpen, setMcpLogsOpen] = useState<Record<string, boolean>>({});

  const stripAnsi = (input: string): string =>
    input.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

  const pushMcpLogs = (serverId: string, text: string) => {
    const cleaned = stripAnsi(text).replace(/\r/g, "");
    const lines = cleaned.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    if (lines.length === 0) return;

    setMcpTests((prev) => {
      const existing = prev[serverId];
      const nextLogs = [...(existing?.logs ?? []), ...lines];
      const capped = nextLogs.slice(Math.max(0, nextLogs.length - 200));
      return {
        ...prev,
        [serverId]: {
          ...(existing ?? { status: "running" as const }),
          logs: capped,
        },
      };
    });
  };

  const testMcpServer = async (serverId: string) => {
    const server = toolSettings.mcp.servers.find((s) => s.id === serverId) ?? null;
    if (!server) {
      setMcpTests((prev) => ({
        ...prev,
        [serverId]: { status: "error", message: t("settings.tools.mcp.serverNotFound") },
      }));
      return;
    }

    setMcpTests((prev) => ({
      ...prev,
      [serverId]: { status: "running", message: undefined, tools: undefined, logs: [] },
    }));
    setMcpLogsOpen((prev) => ({ ...prev, [serverId]: true }));

    const startedAt = Date.now();
    try {
      const response = await fetch("/api/tools/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as unknown;
        const error =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error?: unknown }).error ?? "")
            : "";
        throw new Error(
          error || t("errors.requestFailedWithStatus", { status: response.status }),
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.body || !contentType.includes("text/event-stream")) {
        throw new Error(t("settings.tools.mcp.invalidTestResponse"));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let done = false;
      let sawResult = false;

      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.replace(/^data:\s*/, "");
            if (!data) continue;
            if (data === "[DONE]") {
              done = true;
              break;
            }
            try {
              const event = JSON.parse(data) as
                | { type: "status"; phase: string }
                | { type: "log"; stream: "stdout" | "stderr"; text: string }
                | { type: "result"; latencyMs: number; tools: McpToolInfo[] }
                | { type: "error"; message: string };

              if (event.type === "log") {
                pushMcpLogs(serverId, event.text);
              } else if (event.type === "status") {
                setMcpTests((prev) => ({
                  ...prev,
                  [serverId]: {
                    ...(prev[serverId] ?? { status: "running" as const }),
                    message: event.phase,
                  },
                }));
              } else if (event.type === "result") {
                sawResult = true;
                setMcpTests((prev) => ({
                  ...prev,
                  [serverId]: {
                    ...(prev[serverId] ?? { status: "success" as const }),
                    status: "success",
                    message: t("settings.tools.mcp.test.success", { count: event.tools.length }),
                    latencyMs: event.latencyMs ?? Math.max(0, Date.now() - startedAt),
                    tools: event.tools,
                    testedAt: Date.now(),
                  },
                }));
                setMcpToolsOpen((prev) => ({ ...prev, [serverId]: true }));
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch (e) {
              const message =
                e instanceof Error ? e.message : t("settings.tools.mcp.test.failed");
              pushMcpLogs(serverId, message);
            }
          }
          if (done) break;
        }
      }

      if (!sawResult) {
        throw new Error(t("settings.tools.mcp.test.noResult"));
      }
    } catch (err) {
      const latencyMs = Math.max(0, Date.now() - startedAt);
      const message = err instanceof Error ? err.message : t("settings.tools.mcp.test.failed");
      setMcpTests((prev) => ({
        ...prev,
        [serverId]: {
          ...(prev[serverId] ?? { status: "error" as const }),
          status: "error",
          message,
          latencyMs,
          tools: prev[serverId]?.tools ?? [],
          testedAt: Date.now(),
        },
      }));
    }
  };

  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState<{
    id: string;
    name: string;
    transport: "http" | "sse" | "stdio";
    token: string;
    configJson: string;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const startNewServer = () => {
    setServerError(null);
    setServerDraft({
      id: `mcp_${Date.now().toString(36)}`,
      name: t("settings.tools.mcp.newServerName"),
      transport: "http",
      token: "",
      configJson: JSON.stringify(
        { url: "http://localhost:3000/mcp", protocolVersion: "2024-11-05" },
        null,
        2,
      ),
    });
    setServerModalOpen(true);
  };

  const startEditServer = (id: string) => {
    const entry = toolSettings.mcp.servers.find((s) => s.id === id);
    if (!entry) return;
    setServerError(null);
    setServerDraft({
      id: entry.id,
      name: entry.name,
      transport: entry.transport,
      token: entry.token,
      configJson: entry.configJson,
    });
    setServerModalOpen(true);
  };

  const saveServer = () => {
    if (!serverDraft) return;
    const id = serverDraft.id.trim();
    const name = serverDraft.name.trim();
    if (!id) {
      setServerError(t("settings.tools.mcp.editor.idRequired"));
      return;
    }
    if (!name) {
      setServerError(t("settings.tools.mcp.editor.nameRequired"));
      return;
    }

    upsertMcpServer({
      id,
      name,
      transport: serverDraft.transport,
      token: serverDraft.token,
      configJson: serverDraft.configJson,
    });
    setServerModalOpen(false);
  };

  return (
    <PanelShell
      title={t("settings.tools.title")}
      description={t("settings.tools.description")}
      action={
        <button
          type="button"
          className="rounded-lg bg-matcha-green px-4 py-2 text-sm text-shoji-white transition-all duration-200 hover:bg-matcha-green/90"
          onClick={startNewServer}
        >
          {t("settings.tools.mcp.add")}
        </button>
      }
    >
      <div className="space-y-10">
        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-5 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            {t("settings.tools.search.title")}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <div className="font-zen-body text-xs text-stone-gray font-light">
                {t("settings.tools.search.defaultProvider")}
              </div>
              <select
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.search.provider}
                onChange={(e) =>
                  setToolSettings({
                    ...toolSettings,
                    search: { ...toolSettings.search, provider: e.target.value === "exa" ? "exa" : "tavily" },
                  })
                }
              >
                <option value="tavily">Tavily</option>
                <option value="exa">Exa</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="font-zen-body text-xs text-stone-gray font-light">
                {t("settings.tools.search.searchDepth")}
              </div>
              <select
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.search.searchDepth}
                onChange={(e) =>
                  setToolSettings({
                    ...toolSettings,
                    search: {
                      ...toolSettings.search,
                      searchDepth: e.target.value === "advanced" ? "advanced" : "basic",
                    },
                  })
                }
              >
                <option value="basic">{t("settings.tools.search.depth.basic")}</option>
                <option value="advanced">{t("settings.tools.search.depth.advanced")}</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="font-zen-body text-xs text-stone-gray font-light">
                {t("settings.tools.search.maxResults")}
              </div>
              <input
                type="number"
                min={1}
                max={20}
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.search.maxResults}
                onChange={(e) =>
                  setToolSettings({
                    ...toolSettings,
                    search: {
                      ...toolSettings.search,
                      maxResults: Math.max(1, Math.min(20, Number(e.target.value || 0))),
                    },
                  })
                }
              />
            </label>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="font-zen-body text-xs text-stone-gray font-light">
                  Tavily API Key
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-parchment/20 bg-shoji-white px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                  onClick={() => setShowTavilyKey((v) => !v)}
                >
                  {showTavilyKey ? <EyeOffIcon /> : <EyeIcon />}
                  {showTavilyKey ? t("common.hide") : t("common.show")}
                </button>
              </div>
              <input
                type={showTavilyKey ? "text" : "password"}
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.search.tavilyApiKey}
                onChange={(e) =>
                  setToolSettings({
                    ...toolSettings,
                    search: { ...toolSettings.search, tavilyApiKey: e.target.value },
                  })
                }
                placeholder="tvly-..."
              />
            </label>

            <label className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="font-zen-body text-xs text-stone-gray font-light">
                  Exa API Key
                </div>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-parchment/20 bg-shoji-white px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                  onClick={() => setShowExaKey((v) => !v)}
                >
                  {showExaKey ? <EyeOffIcon /> : <EyeIcon />}
                  {showExaKey ? t("common.hide") : t("common.show")}
                </button>
              </div>
              <input
                type={showExaKey ? "text" : "password"}
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.search.exaApiKey}
                onChange={(e) =>
                  setToolSettings({
                    ...toolSettings,
                    search: { ...toolSettings.search, exaApiKey: e.target.value },
                  })
                }
                placeholder="exa_..."
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
                {t("settings.tools.search.test.title")}
              </div>
              {searchTest.latencyMs !== undefined ? (
                <div className="mt-2 font-mono text-xs text-stone-gray">
                  {t("settings.tools.search.test.latency", { ms: searchTest.latencyMs })}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-zen-body text-sm transition-all duration-300 ${
                searchTest.status === "running"
                  ? "bg-washi-cream text-stone-gray cursor-wait"
                  : "bg-matcha-green/10 text-matcha-green hover:bg-matcha-green/20 font-light"
              }`}
              onClick={() => void testWebSearch()}
              disabled={searchTest.status === "running"}
            >
              {searchTest.status === "running" ? (
                <>
                  <RefreshIcon />
                  {t("settings.tools.search.test.running")}
                </>
              ) : (
                <>
                  <CheckIcon />
                  {t("settings.tools.search.test.button")}
                </>
              )}
            </button>
          </div>
          {searchTest.message ? (
            <p className={`mt-3 font-zen-body text-xs font-light ${searchStatusColor}`}>
              {searchTest.message}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
                MCP Servers
              </div>
              <p className="mt-2 font-zen-body text-sm text-stone-gray font-light">
                {t("settings.tools.mcp.description")}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-parchment/30 bg-shoji-white px-4 py-2 text-sm text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
              onClick={startNewServer}
            >
              {t("common.new")}
            </button>
          </div>

          {toolSettings.mcp.servers.length === 0 ? (
            <PanelEmptyState
              title={t("settings.tools.mcp.empty.title")}
              description={t("settings.tools.mcp.empty.description")}
            />
          ) : (
            <div className="space-y-3">
              {toolSettings.mcp.servers.map((server) => (
                <div
                  key={server.id}
                  className="rounded-2xl border border-parchment/20 bg-shoji-white px-6 py-4"
                >
	                  {(() => {
	                    const test = mcpTests[server.id] ?? { status: "idle" as const };
	                    const toolsOpen = mcpToolsOpen[server.id] ?? false;
	                    const logsOpen = mcpLogsOpen[server.id] ?? false;
	                    const statusColor =
	                      test.status === "success"
	                        ? "text-matcha-green"
	                        : test.status === "error"
	                          ? "text-red-500"
                          : test.status === "running"
                            ? "text-kintsugi-gold"
                            : "text-stone-gray";

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-zen-display text-lg font-light text-ink-black">
                              {server.name}
                            </div>
                            <div className="mt-1 font-mono text-[0.7rem] text-stone-gray">
                              {server.id} · {server.transport.toUpperCase()}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-parchment/20 bg-washi-cream px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green disabled:opacity-60"
                              onClick={() => void testMcpServer(server.id)}
                              disabled={test.status === "running"}
                            >
                              {test.status === "running"
                                ? t("settings.tools.mcp.test.running")
                                : t("settings.tools.mcp.test.button")}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-parchment/20 bg-washi-cream px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                              onClick={() => startEditServer(server.id)}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-parchment/20 bg-washi-cream px-3 py-2 text-xs text-stone-gray transition-all duration-200 hover:border-red-300 hover:text-red-500"
                              onClick={() => deleteMcpServer(server.id)}
                            >
                              {t("common.delete")}
                            </button>
                          </div>
                        </div>

	                        {test.status !== "idle" ? (
	                          <div className="mt-3">
	                            <div className={`font-mono text-[0.75rem] ${statusColor}`}>
	                              {test.message ?? (test.status === "running" ? t("settings.tools.mcp.test.running") : "")}
	                              {typeof test.latencyMs === "number" ? (
	                                <span className="ml-2 text-stone-gray">
	                                  {test.latencyMs}ms
	                                </span>
	                              ) : null}
	                            </div>

	                            {test.logs && test.logs.length > 0 ? (
	                              <div className="mt-2 rounded-xl border border-parchment/20 bg-washi-cream/60 px-4 py-3">
	                                <div className="flex flex-wrap items-center justify-between gap-2">
	                                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-stone-gray">
	                                    {t("settings.tools.mcp.logs")}
	                                  </div>
	                                  <button
	                                    type="button"
	                                    className="rounded-lg border border-parchment/30 bg-shoji-white px-3 py-1.5 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
	                                    onClick={() =>
	                                      setMcpLogsOpen((prev) => ({
	                                        ...prev,
	                                        [server.id]: !logsOpen,
	                                      }))
	                                    }
	                                  >
	                                    {logsOpen ? t("settings.tools.mcp.collapse") : t("settings.tools.mcp.expand")} ({test.logs.length})
	                                  </button>
	                                </div>
	                                {logsOpen ? (
	                                  <pre className="mt-3 max-h-[260px] overflow-auto rounded-lg bg-shoji-white px-3 py-2 font-mono text-[0.7rem] text-ink-black">
	                                    {test.logs.join("\n")}
	                                  </pre>
	                                ) : null}
	                              </div>
	                            ) : null}

	                            {test.status === "success" && test.tools && (
	                              <div className="mt-2 rounded-xl border border-parchment/20 bg-washi-cream/60 px-4 py-3">
	                                <div className="flex flex-wrap items-center justify-between gap-2">
	                                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-stone-gray">
                                    {t("settings.tools.mcp.tools")}
                                  </div>
                                  <button
                                    type="button"
                                    className="rounded-lg border border-parchment/30 bg-shoji-white px-3 py-1.5 text-xs text-stone-gray transition-all duration-200 hover:border-matcha-green/40 hover:text-matcha-green"
                                    onClick={() =>
                                      setMcpToolsOpen((prev) => ({
                                        ...prev,
                                        [server.id]: !toolsOpen,
                                      }))
                                    }
                                    >
                                    {toolsOpen ? t("settings.tools.mcp.collapse") : t("settings.tools.mcp.expand")} ({test.tools.length})
                                  </button>
                                </div>

                                {toolsOpen ? (
                                  <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1">
                                    {test.tools.length === 0 ? (
                                      <div className="rounded-lg bg-shoji-white px-3 py-2 text-xs text-stone-gray">
                                        {t("settings.tools.mcp.noTools")}
                                      </div>
                                    ) : (
                                      test.tools.map((tool) => (
                                        <div
                                          key={tool.name}
                                          className="rounded-lg bg-shoji-white px-3 py-2"
                                        >
                                          <div className="font-mono text-[0.75rem] text-ink-black">
                                            {tool.name}
                                          </div>
                                          {tool.description ? (
                                            <div className="mt-1 text-xs text-stone-gray">
                                              {tool.description}
                                            </div>
                                          ) : null}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-parchment/20 bg-washi-cream/50 p-6">
          <div className="mb-5 font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
            {t("settings.tools.python.title")}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <div className="font-zen-body text-xs text-stone-gray font-light">
                {t("settings.tools.python.timeoutSeconds")}
              </div>
              <input
                type="number"
                min={1}
                max={120}
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={Math.round(toolSettings.python.timeoutMs / 1000)}
                onChange={(e) => {
                  const seconds = Math.max(1, Math.min(120, Number(e.target.value || 0)));
                  setToolSettings({
                    ...toolSettings,
                    python: { ...toolSettings.python, timeoutMs: seconds * 1000 },
                  });
                }}
              />
            </label>

            <label className="space-y-2">
              <div className="font-zen-body text-xs text-stone-gray font-light">
                {t("settings.tools.python.maxOutputChars")}
              </div>
              <input
                type="number"
                min={1000}
                max={200000}
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.python.maxOutputChars}
                onChange={(e) => {
                  const maxChars = Math.max(1000, Math.min(200000, Number(e.target.value || 0)));
                  setToolSettings({
                    ...toolSettings,
                    python: { ...toolSettings.python, maxOutputChars: maxChars },
                  });
                }}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <div className="font-zen-body text-xs text-stone-gray font-light">
                {t("settings.tools.python.command")}
              </div>
              <input
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={toolSettings.python.pythonCommand}
                onChange={(e) =>
                  setToolSettings({
                    ...toolSettings,
                    python: { ...toolSettings.python, pythonCommand: e.target.value },
                  })
                }
                placeholder="python3"
              />
              <p className="font-zen-body text-xs text-stone-gray/70 font-light">
                {t("settings.tools.python.note")}
              </p>
            </label>
          </div>
        </section>
      </div>

      <Modal
        open={serverModalOpen}
        title={
          serverDraft
            ? t("settings.tools.mcp.modal.titleWithName", { name: serverDraft.name })
            : t("settings.tools.mcp.modal.title")
        }
        onClose={() => setServerModalOpen(false)}
      >
        {serverDraft ? (
          <div className="space-y-4">
            {serverError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            ) : null}

            <label className="space-y-2">
              <div className="text-xs text-sand">{t("settings.tools.mcp.editor.serverId")}</div>
              <input
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-mono text-[0.85rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={serverDraft.id}
                onChange={(e) =>
                  setServerDraft({ ...serverDraft, id: e.target.value })
                }
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs text-sand">{t("settings.tools.mcp.editor.name")}</div>
              <input
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={serverDraft.name}
                onChange={(e) =>
                  setServerDraft({ ...serverDraft, name: e.target.value })
                }
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs text-sand">{t("settings.tools.mcp.editor.transport")}</div>
              <select
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={serverDraft.transport}
                onChange={(e) => {
                  const transport =
                    e.target.value === "stdio"
                      ? "stdio"
                      : e.target.value === "sse"
                        ? "sse"
                        : "http";
                  const nextConfigJson =
                    transport === "http"
                      ? JSON.stringify(
                          { url: "http://localhost:3000/mcp", protocolVersion: "2024-11-05" },
                          null,
                          2,
                        )
                      : transport === "sse"
                        ? JSON.stringify(
                            {
                              sseUrl: "http://localhost:3000/mcp",
                              messagesUrl: "http://localhost:3000/messages",
                              protocolVersion: "2024-11-05",
                            },
                            null,
                            2,
                          )
                        : JSON.stringify(
                            {
                              command: "node",
                              args: ["server.js"],
                              protocolVersion: "2024-11-05",
                              stdioFraming: "content-length",
                            },
                            null,
                            2,
                          );

                  setServerDraft({
                    ...serverDraft,
                    transport,
                    configJson:
                      serverDraft.configJson.trim() ? serverDraft.configJson : nextConfigJson,
                  });
                }}
              >
                <option value="http">streamable http</option>
                <option value="sse">legacy sse</option>
                <option value="stdio">stdio</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="text-xs text-sand">{t("settings.tools.mcp.editor.token")}</div>
              <input
                type="password"
                className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-mono text-[0.85rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={serverDraft.token}
                onChange={(e) =>
                  setServerDraft({ ...serverDraft, token: e.target.value })
                }
                placeholder={t("settings.tools.mcp.editor.tokenPlaceholder")}
              />
            </label>

            <label className="space-y-2">
              <div className="text-xs text-sand">{t("settings.tools.mcp.editor.configJson")}</div>
              <textarea
                className="h-[220px] w-full resize-none rounded-xl border border-parchment bg-paper px-4 py-3 font-mono text-[0.8rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                value={serverDraft.configJson}
                onChange={(e) =>
                  setServerDraft({ ...serverDraft, configJson: e.target.value })
                }
                spellCheck={false}
              />
              <p className="font-zen-body text-xs text-stone-gray/70 font-light">
                {t("settings.tools.mcp.editor.configNote")}
              </p>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-parchment/30 bg-shoji-white px-4 py-2 text-sm text-stone-gray"
                onClick={() => setServerModalOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-matcha-green px-4 py-2 text-sm text-shoji-white"
                onClick={saveServer}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PanelShell>
  );
}

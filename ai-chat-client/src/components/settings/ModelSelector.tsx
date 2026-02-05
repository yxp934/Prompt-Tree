/**
 * 模型选择器对话框
 * 从 API 获取可用模型列表并选择添加
 */

"use client";

import { useEffect, useState } from "react";

import { useAppStore } from "@/store/useStore";
import { useT } from "@/lib/i18n/useT";
import { isMessageKey } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";
import { createModelConfig, type ModelConfig } from "@/types/provider";

import { CloseIcon, SearchIcon, RefreshIcon, PlusIcon, CheckIcon } from "./icons";

interface ModelSelectorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 模型分组组件
 */
function ModelGroup({
  category,
  models,
  selectedIds,
  onToggle,
  onAddSelected,
}: {
  category: string;
  models: ModelConfig[];
  selectedIds: Set<string>;
  onToggle: (modelId: string) => void;
  onAddSelected: () => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);

  if (models.length === 0) return null;

  const selectedInGroup = models.filter((m) => selectedIds.has(m.id));
  const categoryLabel =
    category === "chat"
      ? t("modelCategory.chat")
      : category === "reasoning"
        ? t("modelCategory.reasoning")
        : category === "vision"
          ? t("modelCategory.vision")
          : category === "embedding"
            ? t("modelCategory.embedding")
            : category === "tool"
              ? t("modelCategory.tool")
              : t("modelCategory.other");

  return (
    <div className="mb-3 rounded-xl border border-parchment bg-cream overflow-hidden">
      {/* 分组标题 */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper/50"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className={`transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <span className="flex-1 font-body text-[0.9rem] font-medium text-ink">
          {categoryLabel}
        </span>
        <span className="rounded-full bg-parchment px-2 py-0.5 font-mono text-[0.7rem] text-clay">
          {models.length}
        </span>
        {selectedInGroup.length > 0 && (
          <button
            type="button"
            className="rounded-lg bg-copper px-2.5 py-1 font-body text-[0.8rem] text-white transition-colors hover:bg-copper/90"
            onClick={(e) => {
              e.stopPropagation();
              onAddSelected();
            }}
          >
            {t("modelSelector.addCount", { count: selectedInGroup.length })}
          </button>
        )}
      </button>

      {/* 模型列表 */}
      {expanded && (
        <div className="border-t border-parchment px-4 pb-3">
          <div className="space-y-1 pt-2">
            {models.map((model) => {
              const isSelected = selectedIds.has(model.id);
              return (
                <div
                  key={model.id}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                    isSelected
                      ? "bg-copper/10"
                      : "hover:bg-paper/50"
                  }`}
                >
                  {/* 选择复选框 */}
                  <button
                    type="button"
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all ${
                      isSelected
                        ? "border-copper bg-copper text-white"
                        : "border-parchment bg-transparent hover:border-sand"
                    }`}
                    onClick={() => onToggle(model.id)}
                  >
                    {isSelected && <CheckIcon />}
                  </button>

                  {/* 模型信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[0.85rem] text-ink truncate">
                      {model.id}
                    </div>
                    {model.name !== model.id && (
                      <div className="font-body text-[0.75rem] text-sand truncate">
                        {model.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 模型选择器对话框
 */
export function ModelSelector({ open, onClose }: ModelSelectorProps) {
  const t = useT();
  const providers = useAppStore((s) => s.providers);
  const modelSelector = useAppStore((s) => s.modelSelector);
  const setModelSelectorSearch = useAppStore((s) => s.setModelSelectorSearch);
  const setModelSelectorTab = useAppStore((s) => s.setModelSelectorTab);
  const fetchModelsForSelector = useAppStore((s) => s.fetchModelsForSelector);
  const addFetchedModels = useAppStore((s) => s.addFetchedModels);
  const addModel = useAppStore((s) => s.addModel);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualModelInput, setManualModelInput] = useState("");
  const [manualModelError, setManualModelError] = useState<MessageKey | null>(null);

  const provider = providers.find((p) => p.id === modelSelector.providerId);
  const providerId = provider?.id ?? null;
  const existingIds = new Set(provider?.models.map((m) => m.id) || []);

  // 过滤已存在的模型
  const availableModels = modelSelector.fetchedModels.filter(
    (m) => !existingIds.has(m.id),
  );

  // 根据搜索关键词和分类过滤
  const filteredModels = availableModels.filter((model) => {
    const matchesSearch =
      !modelSelector.searchQuery ||
      model.id.toLowerCase().includes(modelSelector.searchQuery.toLowerCase()) ||
      model.name.toLowerCase().includes(modelSelector.searchQuery.toLowerCase());

    const matchesCategory =
      modelSelector.activeTab === "all" ||
      model.category === modelSelector.activeTab;

    return matchesSearch && matchesCategory;
  });

  // 按分类分组
  const groupedModels: Record<string, ModelConfig[]> = {};
  for (const model of filteredModels) {
    const category = model.category || "chat";
    if (!groupedModels[category]) {
      groupedModels[category] = [];
    }
    groupedModels[category].push(model);
  }

  const handleToggle = (modelId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (selectedIds.size > 0) {
      addFetchedModels(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleRefresh = () => {
    if (provider) {
      fetchModelsForSelector(provider.id);
    }
  };

  const handleAddManual = () => {
    if (!provider) return;

    const raw = manualModelInput.trim();
    if (!raw) {
      setManualModelError("modelSelector.manual.error.empty");
      return;
    }

    const ids = Array.from(
      new Set(
        raw
          .split(/[,\n]/)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    );

    const newIds = ids.filter((id) => !existingIds.has(id));
    if (newIds.length === 0) {
      setManualModelError("modelSelector.manual.error.exists");
      return;
    }

    newIds.forEach((id) => addModel(provider.id, createModelConfig(id)));
    setManualModelInput("");
    setManualModelError(null);
  };

  // 打开时自动加载模型
  useEffect(() => {
    if (open && providerId && modelSelector.fetchedModels.length === 0) {
      void fetchModelsForSelector(providerId);
    }
  }, [fetchModelsForSelector, modelSelector.fetchedModels.length, open, providerId]);

  // 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setManualModelInput("");
      setManualModelError(null);
    }
  }, [open]);

  if (!open) return null;

  const categories = ["all", "chat", "reasoning", "vision", "embedding", "tool"] as const;

  const categoryLabel = (value: string) => {
    switch (value) {
      case "all":
        return t("modelCategory.all");
      case "chat":
        return t("modelCategory.chat");
      case "reasoning":
        return t("modelCategory.reasoning");
      case "vision":
        return t("modelCategory.vision");
      case "embedding":
        return t("modelCategory.embedding");
      case "tool":
        return t("modelCategory.tool");
      default:
        return t("modelCategory.other");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative mx-auto my-8 flex h-full w-full max-w-xl flex-col rounded-2xl bg-paper shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-parchment px-6 py-4">
          <h3 className="font-display text-xl text-ink">
            {provider?.name || t("modelSelector.providerFallback")} - {t("modelSelector.models")}
          </h3>
          <button
            type="button"
            className="rounded-lg p-2 text-clay transition-colors hover:text-ink"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="border-b border-parchment px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <SearchIcon />
              <input
                type="text"
                value={modelSelector.searchQuery}
                onChange={(e) => setModelSelectorSearch(e.target.value)}
                placeholder={t("modelSelector.searchPlaceholder")}
                className="w-full rounded-xl border border-parchment bg-cream pl-10 pr-4 py-2.5 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
              />
            </div>
            <button
              type="button"
              className={`flex-shrink-0 rounded-xl border border-parchment p-2.5 text-clay transition-all hover:border-copper hover:text-copper ${
                modelSelector.isLoading ? "animate-spin" : ""
              }`}
              onClick={handleRefresh}
              disabled={modelSelector.isLoading}
            >
              <RefreshIcon />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <input
              type="text"
              value={manualModelInput}
              onChange={(e) => {
                setManualModelInput(e.target.value);
                setManualModelError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddManual();
                }
              }}
              placeholder={t("modelSelector.manual.placeholder")}
              className="flex-1 rounded-xl border border-parchment bg-cream px-4 py-2.5 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
            />
            <button
              type="button"
              className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-copper px-4 py-2.5 font-body text-[0.9rem] text-white transition-colors hover:bg-copper/90 disabled:opacity-50 disabled:hover:bg-copper"
              onClick={handleAddManual}
              disabled={!manualModelInput.trim() || !provider}
            >
              <PlusIcon />
              {t("modelSelector.manual.add")}
            </button>
          </div>

          {manualModelError && (
            <p className="mt-2 font-body text-[0.8rem] text-red-500">
              {t(manualModelError)}
            </p>
          )}
        </div>

        {/* 分类标签 */}
        <div className="flex items-center gap-1 border-b border-parchment px-6 py-3 overflow-x-auto">
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-body text-[0.8rem] transition-all ${
                modelSelector.activeTab === value
                  ? "bg-copper text-white"
                  : "text-clay hover:bg-cream hover:text-ink"
              }`}
              onClick={() => setModelSelectorTab(value)}
            >
              {categoryLabel(value)}
            </button>
          ))}
        </div>

        {/* 模型列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {modelSelector.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-copper border-t-transparent" />
              <p className="font-body text-[0.9rem] text-sand">
                {t("modelSelector.fetching")}
              </p>
            </div>
          ) : modelSelector.error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-red-400">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6m0-6 6 6" />
                </svg>
              </div>
              <p className="mb-1 font-body text-[0.9rem] text-clay">
                {t("modelSelector.fetchFailed")}
              </p>
              <p className="font-body text-[0.8rem] text-sand">
                {isMessageKey(modelSelector.error) ? t(modelSelector.error) : modelSelector.error}
              </p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-sand">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M9 9h6v6H9z" />
                </svg>
              </div>
              <p className="mb-1 font-body text-[0.9rem] text-clay">
                {modelSelector.searchQuery ? t("modelSelector.noMatches") : t("modelSelector.noModels")}
              </p>
              <p className="font-body text-[0.8rem] text-sand">
                {modelSelector.searchQuery
                  ? t("modelSelector.tryOtherQuery")
                  : t("modelSelector.configureApiKey")}
              </p>
            </div>
          ) : (
            <div>
              {Object.entries(groupedModels).map(([category, models]) => (
                <ModelGroup
                  key={category}
                  category={category}
                  models={models}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  onAddSelected={() => {
                    const groupIds = models
                      .filter((m) => selectedIds.has(m.id))
                      .map((m) => m.id);
                    if (groupIds.length > 0) {
                      addFetchedModels(groupIds);
                      groupIds.forEach((id) => selectedIds.delete(id));
                      setSelectedIds(new Set(selectedIds));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between border-t border-parchment px-6 py-4">
            <span className="font-body text-[0.85rem] text-sand">
              {t("modelSelector.selectedCount", { count: selectedIds.size })}
            </span>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-copper px-4 py-2.5 font-body text-[0.9rem] text-white transition-colors hover:bg-copper/90"
              onClick={handleAddSelected}
            >
              <PlusIcon />
              {t("modelSelector.addSelected")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 模型选择器导出 - 连接到 store 的状态
 */
export function ConnectedModelSelector() {
  const modelSelector = useAppStore((s) => s.modelSelector);
  const closeModelSelector = useAppStore((s) => s.closeModelSelector);

  return (
    <ModelSelector
      open={modelSelector.open}
      onClose={closeModelSelector}
    />
  );
}

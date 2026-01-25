/**
 * 模型选择器对话框
 * 从 API 获取可用模型列表并选择添加
 */

"use client";

import { useEffect, useState } from "react";

import { useAppStore } from "@/store/useStore";
import { MODEL_CATEGORIES, getModelCategoryName } from "@/lib/services/providerApiService";
import type { ModelConfig } from "@/types/provider";

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
  const [expanded, setExpanded] = useState(true);

  if (models.length === 0) return null;

  const selectedInGroup = models.filter((m) => selectedIds.has(m.id));

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
          {getModelCategoryName(category as ModelConfig["category"])}
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
            添加 {selectedInGroup.length}
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
  const providers = useAppStore((s) => s.providers);
  const modelSelector = useAppStore((s) => s.modelSelector);
  const closeModelSelector = useAppStore((s) => s.closeModelSelector);
  const setModelSelectorSearch = useAppStore((s) => s.setModelSelectorSearch);
  const setModelSelectorTab = useAppStore((s) => s.setModelSelectorTab);
  const fetchModelsForSelector = useAppStore((s) => s.fetchModelsForSelector);
  const addFetchedModels = useAppStore((s) => s.addFetchedModels);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const provider = providers.find((p) => p.id === modelSelector.providerId);
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

  // 打开时自动加载模型
  useEffect(() => {
    if (open && provider && modelSelector.fetchedModels.length === 0) {
      fetchModelsForSelector(provider.id);
    }
  }, [open]);

  // 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  if (!open) return null;

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
            {provider?.name || "提供商"} - 模型
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
                placeholder="搜索模型 ID 或名称"
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
        </div>

        {/* 分类标签 */}
        <div className="flex items-center gap-1 border-b border-parchment px-6 py-3 overflow-x-auto">
          {MODEL_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-body text-[0.8rem] transition-all ${
                modelSelector.activeTab === cat.value
                  ? "bg-copper text-white"
                  : "text-clay hover:bg-cream hover:text-ink"
              }`}
              onClick={() => setModelSelectorTab(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 模型列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {modelSelector.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-copper border-t-transparent" />
              <p className="font-body text-[0.9rem] text-sand">
                正在获取模型列表...
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
                获取模型列表失败
              </p>
              <p className="font-body text-[0.8rem] text-sand">
                {modelSelector.error}
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
                {modelSelector.searchQuery ? "未找到匹配的模型" : "暂无可用模型"}
              </p>
              <p className="font-body text-[0.8rem] text-sand">
                {modelSelector.searchQuery
                  ? "尝试其他搜索关键词"
                  : "请先配置 API 密钥并刷新"}
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
              已选择 {selectedIds.size} 个模型
            </span>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-copper px-4 py-2.5 font-body text-[0.9rem] text-white transition-colors hover:bg-copper/90"
              onClick={handleAddSelected}
            >
              <PlusIcon />
              添加选中
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

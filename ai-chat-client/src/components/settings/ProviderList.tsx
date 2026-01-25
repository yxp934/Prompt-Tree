/**
 * 提供商列表组件
 * 显示在中间栏，包含提供商列表和添加按钮
 */

"use client";

import { useState } from "react";

import { useAppStore } from "@/store/useStore";

import { PlusIcon, TrashIcon } from "./icons";

/**
 * 提供商图标生成器 - 根据名称生成首字母图标
 */
function ProviderIcon({ name }: { name: string }) {
  // 提取首字母或首字符
  const initial = name.trim().charAt(0).toUpperCase();

  // 根据名称生成一致的颜色
  const colors = [
    "bg-machine",
    "bg-human",
    "bg-system",
    "bg-copper",
  ];
  const index = name.charCodeAt(0) % colors.length;
  const colorClass = colors[index];

  return (
    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colorClass} text-sm font-medium text-paper`}>
      {initial}
    </div>
  );
}

/**
 * 开关组件
 */
function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`relative flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
        enabled ? "bg-copper" : "bg-parchment"
      }`}
      onClick={onToggle}
    >
      <span
        className={`block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/**
 * 提供商列表项
 */
function ProviderListItem({
  provider,
  isActive,
  onSelect,
  onToggle,
  onDelete,
}: {
  provider: { id: string; name: string; enabled: boolean; apiKeys: Array<{ value: string }> };
  isActive: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      className={`group relative mb-1.5 cursor-pointer rounded-lg transition-all duration-150 ${
        isActive
          ? "bg-paper shadow-sm"
          : "hover:bg-paper/50"
      }`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
        onClick={onSelect}
      >
        <ProviderIcon name={provider.name} />

        <span className="flex-1 truncate font-body text-[0.9rem] text-ink">
          {provider.name}
        </span>

        <Toggle enabled={provider.enabled} onToggle={onToggle} />

        {showDelete && (
          <button
            type="button"
            className="ml-2 flex-shrink-0 rounded p-1 text-clay transition-colors hover:bg-cream hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon />
          </button>
        )}
      </button>
    </div>
  );
}

/**
 * 添加提供商对话框
 */
function AddProviderDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onAdd(trimmed);
      setName("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-xl">
        <h3 className="mb-4 font-display text-xl text-ink">
          添加提供商
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block font-mono text-[0.7rem] uppercase tracking-widest text-sand">
              提供商名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：OpenAI, Anthropic, DeepSeek"
              className="w-full rounded-xl border border-parchment bg-cream px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-parchment px-4 py-2 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-sand hover:text-ink"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-ink px-4 py-2 font-body text-[0.85rem] text-cream transition-all duration-150 hover:bg-charcoal"
            >
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 提供商列表主组件
 */
export function ProviderList() {
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const selectProvider = useAppStore((s) => s.selectProvider);
  const toggleProviderEnabled = useAppStore((s) => s.toggleProviderEnabled);
  const deleteProvider = useAppStore((s) => s.deleteProvider);
  const addProvider = useAppStore((s) => s.addProvider);

  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="flex h-full w-[280px] flex-shrink-0 flex-col border-r border-parchment bg-cream">
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-parchment px-5 py-4">
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
            提供商列表
          </div>
          <div className="font-mono text-[0.7rem] text-clay">
            {providers.length}
          </div>
        </div>

        {/* 提供商列表 */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-sand">
                <svg
                  width="48"
                  height="48"
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
              <p className="mb-1 font-body text-[0.9rem] text-clay">
                暂无提供商
              </p>
              <p className="font-body text-[0.8rem] text-sand">
                点击下方按钮添加
              </p>
            </div>
          ) : (
            providers.map((provider) => (
              <ProviderListItem
                key={provider.id}
                provider={provider}
                isActive={selectedProviderId === provider.id}
                onSelect={() => selectProvider(provider.id)}
                onToggle={() => toggleProviderEnabled(provider.id)}
                onDelete={() => deleteProvider(provider.id)}
              />
            ))
          )}
        </div>

        {/* 添加按钮 */}
        <div className="border-t border-parchment p-4">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-parchment px-4 py-3 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-copper hover:text-copper"
            onClick={() => setShowAddDialog(true)}
          >
            <PlusIcon />
            添加提供商
          </button>
        </div>
      </div>

      <AddProviderDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={(name) => addProvider(name)}
      />
    </>
  );
}

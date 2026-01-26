/**
 * 提供商列表组件 - 宁静禅意风格
 */

"use client";

import { useState, useEffect } from "react";

import { useAppStore } from "@/store/useStore";

import { PlusIcon, TrashIcon } from "./icons";

/**
 * 提供商图标生成器 - 根据名称生成首字母图标
 */
function ProviderIcon({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();

  // 使用宁静禅意色彩
  const colors = [
    "bg-matcha-green",
    "bg-kintsugi-gold",
    "bg-stone-gray",
  ];
  const index = name.charCodeAt(0) % colors.length;
  const colorClass = colors[index];

  return (
    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${colorClass} text-shoji-white text-lg font-medium shadow-sm`}>
      {initial}
    </div>
  );
}

/**
 * 开关组件 - 宁静禅意风格
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
      className={`relative flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300 ${
        enabled ? "bg-matcha-green" : "bg-stone-gray/30"
      }`}
      onClick={onToggle}
    >
      <span
        className={`block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-all duration-300 ${
          enabled ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/**
 * 提供商列表项 - 宁静禅意风格
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
      className={`group relative mb-2 cursor-pointer rounded-xl p-4 transition-all duration-300 ${
        isActive
          ? "bg-washi-cream/70 border border-matcha-green/20 shadow-sm"
          : "hover:bg-washi-cream/30 border border-transparent"
      }`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className="flex w-full items-center gap-4 text-left">
        <ProviderIcon name={provider.name} />

        <span className="flex-1 truncate font-zen-body text-sm font-normal text-ink-black">
          {provider.name}
        </span>

        <div onClick={(e) => { e.stopPropagation(); onToggle(); }} role="button" tabIndex={0}>
          <Toggle enabled={provider.enabled} onToggle={onToggle} />
        </div>

        {showDelete && (
          <button
            type="button"
            className="ml-2 flex-shrink-0 rounded-lg p-2 text-stone-gray transition-colors hover:bg-sakura-pink/30 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 添加提供商对话框 - 宁静禅意风格
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-shoji-white p-8 shadow-lg border border-parchment/10">
        <h3 className="mb-6 font-zen-display text-2xl font-light text-ink-black tracking-wide">
          添加提供商
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="mb-3 block font-zen-body text-[0.7rem] uppercase tracking-[0.15em] text-stone-gray font-light">
              Provider Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="OpenAI, Anthropic, DeepSeek..."
              className="w-full rounded-xl border border-parchment/20 bg-washi-cream px-5 py-4 font-zen-body text-sm text-ink-black outline-none transition-all duration-300 focus:border-matcha-green/50 focus:shadow-sm"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-xl border border-parchment/20 px-6 py-3 font-zen-body text-sm text-stone-gray transition-all duration-200 hover:border-stone-gray/30 hover:text-ink-black"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-xl bg-matcha-green px-6 py-3 font-zen-body text-sm text-shoji-white transition-all duration-200 hover:bg-bamboo-light"
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
 * 提供商列表主组件 - 宁静禅意风格
 */
export function ProviderList() {
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const selectProvider = useAppStore((s) => s.selectProvider);
  const toggleProviderEnabled = useAppStore((s) => s.toggleProviderEnabled);
  const deleteProvider = useAppStore((s) => s.deleteProvider);
  const addProvider = useAppStore((s) => s.addProvider);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 避免hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="flex h-full w-[320px] flex-shrink-0 flex-col border-r border-parchment/10 bg-washi-cream/50">
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-parchment/10 px-6 py-6">
          <div className="font-zen-display text-xl font-normal text-ink-black tracking-wide">
            服务提供商
          </div>
          <div className="flex h-7 min-h-7 w-7 min-w-7 items-center justify-center rounded-full bg-washi-cream font-zen-body text-xs text-stone-gray font-light">
            {mounted ? providers.length : '-'}
          </div>
        </div>

        {/* 提供商列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {providers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-2xl bg-washi-cream/50 p-6 text-stone-gray">
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
              <p className="mb-2 font-zen-body text-sm text-stone-gray font-light">
                暂无提供商
              </p>
              <p className="font-zen-body text-xs text-stone-gray/70 font-light">
                点击下方按钮添加
              </p>
            </div>
          ) : (
            providers.map((provider, index) => (
              <div
                key={provider.id}
                style={{ animation: `slideInUp 0.5s ease-out ${index * 0.05}s backwards` }}
              >
                <ProviderListItem
                  provider={provider}
                  isActive={selectedProviderId === provider.id}
                  onSelect={() => selectProvider(provider.id)}
                  onToggle={() => toggleProviderEnabled(provider.id)}
                  onDelete={() => deleteProvider(provider.id)}
                />
              </div>
            ))
          )}
        </div>

        {/* 添加按钮 */}
        <div className="border-t border-parchment/10 p-5">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border-1.5 border-dashed border-parchment/30 px-5 py-4 font-zen-body text-sm text-stone-gray font-light transition-all duration-300 hover:border-matcha-green/50 hover:bg-matcha-green/5 hover:text-matcha-green"
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

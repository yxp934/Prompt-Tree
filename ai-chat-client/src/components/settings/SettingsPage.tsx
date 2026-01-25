/**
 * 设置页面 - 主组件
 * 三栏布局：导航菜单 | 提供商列表 | 配置面板
 */

"use client";

import Link from "next/link";
import { useEffect } from "react";

import { appStore, useAppStore } from "@/store/useStore";

import { ProviderList } from "./ProviderList";
import { ProviderConfig } from "./ProviderConfig";
import { SettingsSidebar } from "./SettingsSidebar";
import { ConnectedModelSelector } from "./ModelSelector";

/**
 * 返回按钮
 */
function BackButton() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-lg border border-parchment bg-cream px-3 py-2 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-copper hover:text-copper"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      返回
    </Link>
  );
}

/**
 * 设置页面容器
 */
export function SettingsPage() {
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const loadProviders = useAppStore((s) => s.loadProviders);

  // 初始化时加载提供商列表
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // 如果没有选中的提供商，默认选中第一个
  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      appStore.getState().selectProvider(providers[0].id);
    }
  }, [selectedProviderId, providers]);

  return (
    <div className="flex h-screen w-full bg-paper">
      {/* 左侧导航菜单 */}
      <SettingsSidebar />

      {/* 中间提供商列表 */}
      <ProviderList />

      {/* 右侧配置面板 */}
      <ProviderConfig />

      {/* 模型选择器对话框 */}
      <ConnectedModelSelector />

      {/* 浮动返回按钮 */}
      <div className="fixed bottom-6 left-6 z-10">
        <BackButton />
      </div>
    </div>
  );
}

export default SettingsPage;

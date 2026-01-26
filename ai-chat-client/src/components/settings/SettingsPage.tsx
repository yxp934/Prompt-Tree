/**
 * 设置页面 - 主组件
 * 三栏布局：导航菜单 | 提供商列表 | 配置面板
 * 使用 100dvh 确保全屏布局，添加 flex-1 确保内容正确填充
 */

"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

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
      className="fixed bottom-8 left-8 z-50 flex items-center gap-3 rounded-2xl border border-parchment bg-cream/95 backdrop-blur-sm px-5 py-3 font-body text-sm text-clay shadow-lg transition-all duration-200 hover:border-copper hover:text-copper hover:shadow-xl"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      返回主页
    </Link>
  );
}

/**
 * 设置页面容器
 * 使用固定定位确保独立于主布局
 */
export function SettingsPage() {
  const providers = useAppStore((s) => s.providers);
  const selectedProviderId = useAppStore((s) => s.selectedProviderId);
  const loadProviders = useAppStore((s) => s.loadProviders);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex bg-shoji-white"
      style={{ height: '100vh', maxHeight: '100vh' }}
    >
      {/* 左侧导航菜单 */}
      <SettingsSidebar />

      {/* 中间提供商列表 */}
      <ProviderList />

      {/* 右侧配置面板 */}
      <ProviderConfig />

      {/* 模型选择器对话框 */}
      <ConnectedModelSelector />

      {/* 浮动返回按钮 */}
      <BackButton />
    </div>
  );
}

export default SettingsPage;

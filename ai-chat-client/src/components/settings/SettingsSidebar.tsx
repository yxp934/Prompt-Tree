/**
 * 设置页左侧导航菜单 - 宁静禅意风格
 */

"use client";

import { useState } from "react";

import {
  CloudIcon,
  CpuIcon,
  PaletteIcon,
  MonitorIcon,
  DatabaseIcon,
  InfoIcon,
} from "./icons";

type NavItem = {
  id: string;
  label: string;
  labelEn?: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { id: "providers", label: "模型服务", labelEn: "Configuration", icon: <CloudIcon /> },
  { id: "models", label: "默认模型", labelEn: "Default Model", icon: <CpuIcon /> },
  { id: "general", label: "常规设置", labelEn: "General", icon: <MonitorIcon /> },
  { id: "display", label: "显示设置", labelEn: "Display", icon: <PaletteIcon /> },
  { id: "data", label: "数据设置", labelEn: "Data", icon: <DatabaseIcon /> },
  { id: "about", label: "关于", labelEn: "About", icon: <InfoIcon /> },
];

export function SettingsSidebar() {
  const [activeId, setActiveId] = useState("providers");

  return (
    <nav className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-parchment/10 bg-shoji-white">
      {/* 头部区域 */}
      <div className="border-b border-parchment/10 px-8 py-12">
        <div className="font-zen-display text-2xl font-light tracking-[0.15em] text-ink-black">
          設定
        </div>
        <div className="mt-1 font-zen-body text-[0.6rem] tracking-[0.2em] text-stone-gray font-light uppercase">
          Settings
        </div>
      </div>

      {/* 导航菜单 */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mb-5 px-3 font-zen-body text-[0.65rem] tracking-[0.25em] text-stone-gray uppercase font-light">
          Configuration
        </div>

        <div className="space-y-1">
          {navItems.map((item, index) => (
            <button
              key={item.id}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-5 py-3 font-zen-body text-sm font-light transition-all duration-300 ${
                activeId === item.id
                  ? "bg-washi-cream text-matcha-green border border-matcha-green/15 shadow-sm"
                  : "text-stone-gray hover:bg-washi-cream/50 hover:text-ink-black"
              }`}
              style={{ animation: `fadeIn 0.8s ease-out ${index * 0.05}s backwards` }}
              onClick={() => setActiveId(item.id)}
            >
              {/* 左侧指示条 */}
              <div className={`absolute left-0 top-0 h-full w-0.5 bg-matcha-green transition-transform duration-300 ${
                activeId === item.id ? "scale-y-100" : "scale-y-0"
              }`} />

              <span className="flex-shrink-0 text-base opacity-70 group-hover:opacity-100 transition-opacity">
                {item.icon}
              </span>
              <span className="font-light tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 底部版本信息 */}
      <div className="border-t border-parchment/10 px-8 py-7">
        <div className="font-zen-display text-sm text-stone-gray font-light tracking-[0.1em]">
          Cortex v1.0.0
        </div>
      </div>
    </nav>
  );
}

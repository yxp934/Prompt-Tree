/**
 * 设置页左侧导航菜单
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
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { id: "providers", label: "模型服务", icon: <CloudIcon /> },
  { id: "models", label: "默认模型", icon: <CpuIcon /> },
  { id: "general", label: "常规设置", icon: <MonitorIcon /> },
  { id: "display", label: "显示设置", icon: <PaletteIcon /> },
  { id: "data", label: "数据设置", icon: <DatabaseIcon /> },
  { id: "about", label: "关于", icon: <InfoIcon /> },
];

export function SettingsSidebar() {
  const [activeId, setActiveId] = useState("providers");

  return (
    <nav className="flex h-full w-[180px] flex-shrink-0 flex-col border-r border-parchment bg-cream">
      {/* 导航菜单 */}
      <div className="flex-1 overflow-y-auto px-3 py-6">
        <div className="mb-4 px-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          设置
        </div>

        <div className="space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-body text-[0.85rem] transition-all duration-150 ${
                activeId === item.id
                  ? "bg-paper text-ink shadow-sm"
                  : "text-clay hover:bg-paper/50 hover:text-ink"
              }`}
              onClick={() => setActiveId(item.id)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 底部版本信息 */}
      <div className="border-t border-parchment px-4 py-3">
        <div className="font-mono text-[0.65rem] text-sand">
          Cortex v1.0.0
        </div>
      </div>
    </nav>
  );
}

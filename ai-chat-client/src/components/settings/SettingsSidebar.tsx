/**
 * 设置页左侧导航菜单 - 宁静禅意风格
 */

"use client";

import { useT } from "@/lib/i18n/useT";

import {
  CloudIcon,
  CpuIcon,
  WrenchIcon,
  PaletteIcon,
  MonitorIcon,
  DatabaseIcon,
  InfoIcon,
} from "./icons";

type NavItem = {
  id: string;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  icon: React.ReactNode;
};

const configurationItems: NavItem[] = [
  { id: "providers", labelKey: "settings.nav.providers", icon: <CloudIcon /> },
  { id: "models", labelKey: "settings.nav.defaultModel", icon: <CpuIcon /> },
  { id: "tools", labelKey: "settings.nav.tools", icon: <WrenchIcon /> },
  { id: "memory", labelKey: "settings.nav.memory", icon: <DatabaseIcon /> },
  { id: "general", labelKey: "settings.nav.general", icon: <MonitorIcon /> },
  { id: "display", labelKey: "settings.nav.display", icon: <PaletteIcon /> },
];

const dataItems: NavItem[] = [
  { id: "data", labelKey: "settings.nav.data", icon: <DatabaseIcon /> },
  { id: "about", labelKey: "settings.nav.about", icon: <InfoIcon /> },
];

type SettingsSidebarProps = {
  activeId: string;
  onSelect: (id: string) => void;
};

export function SettingsSidebar({ activeId, onSelect }: SettingsSidebarProps) {
  const t = useT();

  const sections = [
    { label: t("settings.nav.configuration"), items: configurationItems },
    { label: t("settings.nav.data"), items: dataItems },
  ];

  return (
    <nav className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-parchment/10 bg-shoji-white">
      {/* 头部区域 */}
      <div className="border-b border-parchment/10 px-8 py-12">
        <div className="font-zen-display text-2xl font-light tracking-[0.15em] text-ink-black">
          {t("common.settings")}
        </div>
        <div className="mt-1 font-zen-body text-[0.6rem] tracking-[0.2em] text-stone-gray font-light uppercase">
          {t("common.appName")}
        </div>
      </div>

      {/* 导航菜单 */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {sections.map((section, sectionIndex) => (
          <div key={section.label} className={sectionIndex === 0 ? "mb-8" : ""}>
            <div className="mb-5 px-3 font-zen-body text-[0.65rem] tracking-[0.25em] text-stone-gray uppercase font-light">
              {section.label}
            </div>

            <div className="space-y-1">
              {section.items.map((item, index) => (
                <button
                  key={item.id}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-5 py-3 font-zen-body text-sm font-light transition-all duration-300 ${
                    activeId === item.id
                      ? "bg-washi-cream text-matcha-green border border-matcha-green/15 shadow-sm"
                      : "text-stone-gray hover:bg-washi-cream/50 hover:text-ink-black"
                  }`}
                  style={{ animation: `fadeIn 0.8s ease-out ${index * 0.05}s backwards` }}
                  onClick={() => onSelect(item.id)}
                >
                  {/* 左侧指示条 */}
                  <div className={`absolute left-0 top-0 h-full w-0.5 bg-matcha-green transition-transform duration-300 ${
                    activeId === item.id ? "scale-y-100" : "scale-y-0"
                  }`} />

                  <span className="flex-shrink-0 text-base opacity-70 group-hover:opacity-100 transition-opacity">
                    {item.icon}
                  </span>
                  <span className="font-light tracking-wide">{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 底部版本信息 */}
      <div className="border-t border-parchment/10 px-8 py-7">
        <div className="font-zen-display text-sm text-stone-gray font-light tracking-[0.1em]">
          {t("common.appName")} v0.4.0
        </div>
      </div>
    </nav>
  );
}

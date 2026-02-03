"use client";

import { useMemo } from "react";
import Link from "next/link";

import { countLeafBranches } from "@/lib/services/dagService";
import { useAppStore } from "@/store/useStore";
import { useT } from "@/lib/i18n/useT";

function SettingsIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
    </svg>
  );
}

export default function Header() {
  const t = useT();
  const currentView = useAppStore((s) => s.currentView);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const currentFolder = useAppStore((s) => s.getCurrentFolder());
  const currentFolderId = useAppStore((s) => s.currentFolderId);
  const trees = useAppStore((s) => s.trees);
  const nodesCount = useAppStore((s) => s.nodes.size);
  const nodes = useAppStore((s) => s.nodes);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleContextPanel = useAppStore((s) => s.toggleContextPanel);

  const branchCount = useMemo(() => {
    if (currentView !== "tree" || !currentTree) return 0;
    return countLeafBranches(nodes.values(), currentTree.rootId);
  }, [currentTree, currentView, nodes]);

  const folderThreadCount = useMemo(() => {
    if (currentView !== "folder" || !currentFolderId) return 0;
    let total = 0;
    for (const tree of trees.values()) {
      if ((tree.folderId ?? null) === currentFolderId) total += 1;
    }
    return total;
  }, [currentFolderId, currentView, trees]);

  const title =
    currentView === "folder"
      ? currentFolder?.name ?? t("header.fallback.folder")
      : currentTree?.title ?? t("header.fallback.loading");

  return (
    <header className="flex flex-col gap-4 border-b border-parchment bg-paper px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-parchment px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-clay transition-all duration-150 hover:border-copper hover:text-ink lg:hidden"
            onClick={() => toggleSidebar()}
            aria-label={t("header.menu")}
          >
            {t("header.menu")}
          </button>
          <h2 className="font-display text-[1.35rem] font-normal text-ink">
            {title}
          </h2>
        </div>
        <button
          type="button"
          className="rounded-full border border-parchment px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-clay transition-all duration-150 hover:border-copper hover:text-ink lg:hidden"
          onClick={() => toggleContextPanel()}
          aria-label={t("header.context")}
        >
          {t("header.context")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4 lg:gap-6">
        {currentView === "folder" ? (
          <div className="flex flex-wrap gap-4 font-mono text-[0.75rem] text-sand">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{folderThreadCount}</span>{" "}
              {t("header.threads")}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 font-mono text-[0.75rem] text-sand">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{nodesCount}</span>{" "}
              {t("header.nodes")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{branchCount}</span>{" "}
              {t("header.branches")}
            </div>
          </div>
        )}
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-full border border-parchment px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-clay transition-all duration-150 hover:border-copper hover:text-ink"
        >
          <SettingsIcon />
          {t("common.settings")}
        </Link>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-parchment px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-clay transition-all duration-150 hover:border-copper hover:text-ink"
          onClick={() => toggleTheme()}
          aria-label={t("header.toggleTheme")}
        >
          {theme === "light" ? t("header.theme.light") : t("header.theme.dark")}
        </button>
      </div>
    </header>
  );
}

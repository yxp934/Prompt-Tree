"use client";

import { useReactFlow } from "reactflow";

import { useT } from "@/lib/i18n/useT";

function MinusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M20 12H4"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
      />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M4 6h16M4 12h10M4 18h16"
      />
    </svg>
  );
}

export interface TreeControlsProps {
  onAutoLayout: () => void;
}

export function TreeControls({ onAutoLayout }: TreeControlsProps) {
  const t = useT();
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <div
      data-tree-controls
      className="pointer-events-none absolute bottom-5 left-8 z-20 flex gap-2"
    >
      <button
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper"
        onClick={() => void zoomOut?.()}
        aria-label={t("tree.controls.zoomOut")}
        type="button"
      >
        <div className="h-[18px] w-[18px]">
          <MinusIcon />
        </div>
      </button>
      <button
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper"
        onClick={() => void zoomIn?.()}
        aria-label={t("tree.controls.zoomIn")}
        type="button"
      >
        <div className="h-[18px] w-[18px]">
          <PlusIcon />
        </div>
      </button>
      <button
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper"
        onClick={() => void fitView?.({ padding: 0.25 })}
        aria-label={t("tree.controls.fitView")}
        type="button"
      >
        <div className="h-[18px] w-[18px]">
          <FitIcon />
        </div>
      </button>
      <button
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper"
        onClick={onAutoLayout}
        aria-label={t("tree.controls.autoLayout")}
        type="button"
      >
        <div className="h-[18px] w-[18px]">
          <LayoutIcon />
        </div>
      </button>
    </div>
  );
}

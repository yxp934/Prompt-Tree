"use client";

import { useEffect, type CSSProperties } from "react";

import { ChatView } from "@/components/chat/ChatView";
import { useAppStore } from "@/store/useStore";

import ContextPanel from "./ContextPanel";
import Sidebar from "./Sidebar";

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

function ExpandIcon() {
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

interface NodeProps {
  type: "system" | "human" | "machine" | "add";
  label?: string;
  text: string;
  style: CSSProperties;
  isActive?: boolean;
  opacity?: number;
}

function Node({ type, label, text, style, isActive, opacity = 1 }: NodeProps) {
  const baseClasses =
    "node-transition absolute z-[2] cursor-pointer rounded-[20px] px-5 py-3.5";

  if (type === "add") {
    return (
      <div
        className={`${baseClasses} flex items-center gap-2 border-2 border-dashed border-parchment bg-paper text-[0.8rem] text-sand hover:border-copper hover:text-copper`}
        style={{ ...style, opacity }}
      >
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
            strokeWidth="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        {text}
      </div>
    );
  }

  const typeClasses = {
    system:
      "bg-gradient-to-br from-system to-[#3d4a5c] text-cream shadow-[0_4px_20px_rgba(79,91,107,0.25),inset_0_0_0_1px_rgba(255,255,255,0.1)]",
    human:
      "bg-gradient-to-br from-human to-[#5a4a3f] text-cream shadow-[0_4px_20px_rgba(107,91,79,0.25),inset_0_0_0_1px_rgba(255,255,255,0.1)]",
    machine:
      "bg-gradient-to-br from-machine to-[#3a5432] text-cream shadow-[0_4px_20px_rgba(74,103,65,0.25),inset_0_0_0_1px_rgba(255,255,255,0.1)]",
  };

  const activeClasses = isActive
    ? "shadow-[0_8px_32px_rgba(184,115,51,0.3),0_0_0_2px_var(--copper)]"
    : "";

  return (
    <div
      className={`${baseClasses} ${typeClasses[type]} ${activeClasses} hover:z-10`}
      style={{ ...style, opacity }}
    >
      <div className="mb-1 font-mono text-[0.65rem] uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="max-w-[140px] truncate text-[0.85rem] font-normal leading-tight">
        {text}
      </div>
    </div>
  );
}

export default function MainLayout() {
  const initialize = useAppStore((s) => s.initialize);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const nodesCount = useAppStore((s) => s.nodes.size);
  const model = useAppStore((s) => s.model);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_340px]">
      <Sidebar />

      <main className="relative flex flex-col bg-paper">
        <header className="flex items-center justify-between border-b border-parchment bg-paper px-8 py-5">
          <h2 className="font-display text-[1.35rem] font-normal text-ink">
            {currentTree?.title ?? "Loading..."}
          </h2>
          <div className="flex gap-6 font-mono text-[0.75rem] text-sand">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{nodesCount}</span> nodes
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">1</span> branch
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{model}</span>
            </div>
          </div>
        </header>

        <div className="tree-canvas-bg tree-canvas-grid relative h-[45%] overflow-hidden border-b border-parchment">
          <svg
            className="pointer-events-none absolute inset-0 z-[1]"
            width="100%"
            height="100%"
          >
            <path
              className="fill-none stroke-copper"
              strokeWidth="2.5"
              strokeLinecap="round"
              d="M 200 90 C 280 90, 280 90, 360 90"
            />
            <path
              className="fill-none stroke-copper"
              strokeWidth="2.5"
              strokeLinecap="round"
              d="M 520 90 C 600 90, 600 90, 680 90"
            />
            <path
              className="fill-none stroke-parchment"
              strokeWidth="2"
              strokeLinecap="round"
              d="M 200 90 C 240 90, 240 180, 360 180"
            />
          </svg>

          <Node
            type="system"
            label="System"
            text="System prompt (Stage 4: React Flow tree)"
            style={{ left: 80, top: 60 }}
          />
          <Node
            type="human"
            label="Human"
            text="Single-branch chat MVP"
            style={{ left: 300, top: 60 }}
          />
          <Node
            type="machine"
            label="Machine"
            text="Tree visualization coming next"
            style={{ left: 540, top: 60 }}
            isActive
          />
          <Node
            type="human"
            label="Human"
            text="(placeholder)"
            style={{ left: 300, top: 150 }}
            opacity={0.5}
          />
          <Node type="add" text="Continue" style={{ left: 760, top: 60 }} />

          <div className="absolute bottom-5 left-8 z-20 flex gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper">
              <div className="h-[18px] w-[18px]">
                <MinusIcon />
              </div>
            </button>
            <div className="flex h-10 items-center rounded-[10px] border border-parchment bg-paper px-4 font-mono text-[0.75rem] text-clay">
              100%
            </div>
            <button className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper">
              <div className="h-[18px] w-[18px]">
                <PlusIcon />
              </div>
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-parchment bg-paper text-clay transition-all duration-150 hover:border-copper hover:text-copper">
              <div className="h-[18px] w-[18px]">
                <ExpandIcon />
              </div>
            </button>
          </div>
        </div>

        <ChatView />
      </main>

      <ContextPanel />
    </div>
  );
}

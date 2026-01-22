"use client";

import { useState } from "react";

// 线程数据类型
interface Thread {
  id: string;
  title: string;
  timeAgo: string;
  nodeCount: number;
}

// 模拟线程数据
const recentThreads: Thread[] = [
  {
    id: "1",
    title: "React Flow Integration",
    timeAgo: "2m ago",
    nodeCount: 12,
  },
  {
    id: "2",
    title: "IndexedDB Schema Design",
    timeAgo: "1h ago",
    nodeCount: 8,
  },
  {
    id: "3",
    title: "Token Optimization Strategy",
    timeAgo: "3h ago",
    nodeCount: 15,
  },
];

const yesterdayThreads: Thread[] = [
  { id: "4", title: "Zustand State Architecture", timeAgo: "Yesterday", nodeCount: 6 },
  { id: "5", title: "Project Initialization", timeAgo: "Yesterday", nodeCount: 4 },
];

// 时钟图标组件
function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeWidth="2" d="M12 6v6l4 2" />
    </svg>
  );
}

// 加号图标组件
function PlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

// 设置图标组件
function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
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

// 线程项组件
interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}

function ThreadItem({ thread, isActive, onClick }: ThreadItemProps) {
  return (
    <div
      className={`relative mb-1 cursor-pointer rounded-[10px] p-4 transition-all duration-150 ${
        isActive ? "bg-paper" : "hover:bg-paper"
      }`}
      onClick={onClick}
    >
      {/* 左侧激活指示器 */}
      <div
        className={`absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-copper transition-all duration-200 ${
          isActive ? "h-6" : "h-0"
        }`}
      />

      {/* 标题 */}
      <div className="mb-1.5 text-[0.9rem] font-medium leading-tight text-ink">
        {thread.title}
      </div>

      {/* 元信息 */}
      <div className="flex items-center gap-3 font-mono text-[0.7rem] text-sand">
        <span className="flex items-center gap-1">
          <ClockIcon />
          {thread.timeAgo}
        </span>
        <span>{thread.nodeCount} nodes</span>
      </div>
    </div>
  );
}

// 侧边栏主组件
export default function Sidebar() {
  const [activeThreadId, setActiveThreadId] = useState("1");

  return (
    <aside className="flex h-full flex-col border-r border-parchment bg-cream">
      {/* 品牌区域 */}
      <div className="border-b border-parchment px-7 pb-6 pt-8">
        <h1 className="brand-dot flex items-baseline gap-2 font-display text-[1.75rem] font-normal tracking-tight text-ink">
          Cortex
        </h1>
        <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
          Dialogue Topology
        </div>
      </div>

      {/* 新建线程按钮 */}
      <button className="mx-5 mt-5 flex items-center gap-2.5 rounded-lg bg-ink px-5 py-3.5 font-body text-[0.9rem] font-medium text-cream transition-all duration-200 hover:-translate-y-px hover:bg-charcoal">
        <PlusIcon />
        New Thread
      </button>

      {/* 线程列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        {/* 最近 */}
        <div className="mb-3 px-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          Recent
        </div>
        {recentThreads.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            isActive={activeThreadId === thread.id}
            onClick={() => setActiveThreadId(thread.id)}
          />
        ))}

        {/* 昨天 */}
        <div className="mb-3 mt-6 px-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          Yesterday
        </div>
        {yesterdayThreads.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            isActive={activeThreadId === thread.id}
            onClick={() => setActiveThreadId(thread.id)}
          />
        ))}
      </div>

      {/* 底部设置 */}
      <div className="border-t border-parchment p-5">
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-parchment bg-transparent px-4 py-3 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-sand hover:text-ink">
          <SettingsIcon />
          Settings
        </button>
      </div>
    </aside>
  );
}

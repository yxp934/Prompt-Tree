"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "./Sidebar";
import ContextPanel from "./ContextPanel";

// 消息类型
interface Message {
  id: string;
  role: "human" | "machine";
  author: string;
  avatar: string;
  time: string;
  content: React.ReactNode;
}

// 模拟消息数据
const messages: Message[] = [
  {
    id: "1",
    role: "human",
    author: "You",
    avatar: "Y",
    time: "14:32",
    content: (
      <p>
        How do I integrate React Flow into a Next.js project? I need to build a
        visual dialogue tree structure.
      </p>
    ),
  },
  {
    id: "2",
    role: "machine",
    author: "Cortex",
    avatar: "C",
    time: "14:32",
    content: (
      <>
        <p>Here&apos;s how to integrate React Flow with Next.js:</p>
        <p>
          <strong>1. Install the package</strong>
        </p>
        <pre>
          <code>npm install reactflow</code>
        </pre>
        <p>
          <strong>2. Create a dynamic import</strong>
        </p>
        <p>
          Since React Flow uses browser APIs, you&apos;ll need dynamic imports:
        </p>
        <pre>
          <code>{`import dynamic from 'next/dynamic';

const Flow = dynamic(
  () => import('./FlowComponent'),
  { ssr: false }
);`}</code>
        </pre>
      </>
    ),
  },
];

// 图标组件
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

function AttachIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 12h14M12 5l7 7-7 7"
      />
    </svg>
  );
}

// 消息组件
interface MessageItemProps {
  message: Message;
}

function MessageItem({ message }: MessageItemProps) {
  return (
    <div className="animate-message-in mb-8 max-w-[680px]">
      {/* 头部 */}
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-[0.9rem] italic text-cream ${
            message.role === "human" ? "bg-human" : "bg-machine"
          }`}
        >
          {message.avatar}
        </div>
        <span className="text-[0.9rem] font-medium text-ink">
          {message.author}
        </span>
        <span className="font-mono text-[0.7rem] text-sand">{message.time}</span>
      </div>

      {/* 内容 */}
      <div className="prose-cortex pl-11 text-[0.95rem] leading-relaxed text-charcoal [&_p]:mb-4 [&_strong]:font-medium [&_strong]:text-ink">
        {message.content}
      </div>
    </div>
  );
}

// 打字指示器
function TypingIndicator() {
  return (
    <div className="mb-8 max-w-[680px]">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-machine font-display text-[0.9rem] italic text-cream">
          C
        </div>
      </div>
      <div className="flex items-center gap-3 pl-11 text-[0.85rem] text-sand">
        <div className="flex gap-1">
          <span className="animate-typing h-1.5 w-1.5 rounded-full bg-copper" />
          <span className="animate-typing animate-typing-delay-1 h-1.5 w-1.5 rounded-full bg-copper" />
          <span className="animate-typing animate-typing-delay-2 h-1.5 w-1.5 rounded-full bg-copper" />
        </div>
        <span>Thinking...</span>
      </div>
    </div>
  );
}

// 节点组件
interface NodeProps {
  type: "system" | "human" | "machine" | "add";
  label?: string;
  text: string;
  style: React.CSSProperties;
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

// 主布局组件
export default function MainLayout() {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputValue]);

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_340px]">
      {/* 左侧边栏 */}
      <Sidebar />

      {/* 主区域 */}
      <main className="relative flex flex-col bg-paper">
        {/* 头部 */}
        <header className="flex items-center justify-between border-b border-parchment bg-paper px-8 py-5">
          <h2 className="font-display text-[1.35rem] font-normal text-ink">
            React Flow Integration
          </h2>
          <div className="flex gap-6 font-mono text-[0.75rem] text-sand">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">12</span> nodes
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">3</span> branches
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">GPT-4</span>
            </div>
          </div>
        </header>

        {/* 树形画布 */}
        <div className="tree-canvas-bg tree-canvas-grid relative h-[45%] overflow-hidden border-b border-parchment">
          {/* SVG 连接线 */}
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

          {/* 节点 */}
          <Node
            type="system"
            label="System"
            text="Frontend expert prompt"
            style={{ left: 80, top: 60 }}
          />
          <Node
            type="human"
            label="Human"
            text="How to integrate React Flow?"
            style={{ left: 300, top: 60 }}
          />
          <Node
            type="machine"
            label="Machine"
            text="Install dependencies first..."
            style={{ left: 540, top: 60 }}
            isActive
          />
          <Node
            type="human"
            label="Human"
            text="Alternative approach?"
            style={{ left: 300, top: 150 }}
            opacity={0.5}
          />
          <Node type="add" text="Continue" style={{ left: 760, top: 60 }} />

          {/* 控制按钮 */}
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

        {/* 聊天区域 */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-8">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            <TypingIndicator />
          </div>

          {/* 输入区域 */}
          <div className="input-area-gradient px-8 pb-8 pt-6">
            <div className="relative max-w-[680px]">
              <textarea
                ref={textareaRef}
                className="min-h-[60px] max-h-[180px] w-full resize-none rounded-2xl border border-parchment bg-paper px-6 py-[18px] pr-[100px] font-body text-[0.95rem] text-ink outline-none transition-all duration-200 placeholder:text-sand focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                placeholder="Type your message..."
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-transparent text-sand transition-all duration-150 hover:bg-cream hover:text-ink">
                  <div className="h-[18px] w-[18px]">
                    <AttachIcon />
                  </div>
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-copper text-cream transition-all duration-150 hover:scale-105 hover:bg-copper-light">
                  <div className="h-[18px] w-[18px]">
                    <SendIcon />
                  </div>
                </button>
              </div>
            </div>
            <div className="mt-3 flex max-w-[680px] justify-between px-1 font-mono text-[0.7rem] text-sand">
              <span>Model: GPT-4 - Temp: 0.7</span>
              <span>Context: 2,847 / 8,192</span>
            </div>
          </div>
        </div>
      </main>

      {/* 右侧上下文面板 */}
      <ContextPanel />
    </div>
  );
}

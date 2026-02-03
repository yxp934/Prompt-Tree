"use client";

import { useEffect, useRef } from "react";

import { useT } from "@/lib/i18n/useT";
import { isMessageKey } from "@/lib/i18n/translate";
import { NodeType, type Node } from "@/types";

import { MessageItem } from "./MessageItem";

function TypingIndicator() {
  const t = useT();
  return (
    <div className="mb-8 max-w-[680px]">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-machine font-display text-[0.9rem] italic text-cream">
          …
        </div>
      </div>
      <div className="flex items-center gap-3 pl-11 text-[0.85rem] text-sand">
        <div className="flex gap-1">
          <span className="animate-typing h-1.5 w-1.5 rounded-full bg-copper" />
          <span className="animate-typing animate-typing-delay-1 h-1.5 w-1.5 rounded-full bg-copper" />
          <span className="animate-typing animate-typing-delay-2 h-1.5 w-1.5 rounded-full bg-copper" />
        </div>
        <span>{t("chat.thinking")}</span>
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: Node[];
  isSending: boolean;
  error?: string | null;
}

export function MessageList({ messages, isSending, error }: MessageListProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const lastUserIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.type === NodeType.USER) return index;
    }
    return -1;
  })();
  const hasAssistantAfterLastUser =
    lastUserIndex >= 0
      ? messages.slice(lastUserIndex + 1).some((node) => node.type === NodeType.ASSISTANT)
      : messages.some((node) => node.type === NodeType.ASSISTANT);
  const showTypingIndicator = isSending && !hasAssistantAfterLastUser;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const threshold = 96;
    const onScroll = () => {
      const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
      stickToBottomRef.current = distanceToBottom < threshold;
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!stickToBottomRef.current) return;

    const id = window.requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: isSending ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [messages, isSending]);

  return (
    <div ref={listRef} className="min-h-0 overflow-y-auto p-8">
      {messages.map((node) => (
        <MessageItem key={node.id} node={node} />
      ))}

      {error ? (
        <div className="mb-6 max-w-[680px] rounded-xl border border-[#e74c3c]/30 bg-[#e74c3c]/10 p-4 font-body text-[0.85rem] text-[#b1382c]">
          {isMessageKey(error) ? t(error) : error}
        </div>
      ) : null}

      {showTypingIndicator ? <TypingIndicator /> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

import type { Node } from "@/types";

import { MessageItem } from "./MessageItem";

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

interface MessageListProps {
  messages: Node[];
  isSending: boolean;
  error?: string | null;
}

export function MessageList({ messages, isSending, error }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSending]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {messages.map((node) => (
        <MessageItem key={node.id} node={node} />
      ))}

      {error ? (
        <div className="mb-6 max-w-[680px] rounded-xl border border-[#e74c3c]/30 bg-[#e74c3c]/10 p-4 font-body text-[0.85rem] text-[#b1382c]">
          {error}
        </div>
      ) : null}

      {isSending ? <TypingIndicator /> : null}
      <div ref={endRef} />
    </div>
  );
}


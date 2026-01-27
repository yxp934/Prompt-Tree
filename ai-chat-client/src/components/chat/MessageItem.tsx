"use client";

import { format } from "date-fns";

import { NodeType, type Node } from "@/types";
import { getNodeAvatarLetter, getNodeDisplayName } from "@/lib/utils/nodeDisplay";
import { useAppStore } from "@/store/useStore";

import { MarkdownContent } from "./MarkdownContent";

interface MessageItemProps {
  node: Node;
}

function CopyIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M8 8h9a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-9a2 2 0 012-2z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6 16H5a2 2 0 01-2-2V5a2 2 0 012-2h9a2 2 0 012 2v1"
      />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3 12a9 9 0 0115.3-6.36M21 12a9 9 0 01-15.3 6.36"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3 4v6h6M21 20v-6h-6"
      />
    </svg>
  );
}

function getMessageMeta(node: Node): {
  role: "human" | "machine" | "system";
  author: string;
  avatar: string;
} {
  const author = getNodeDisplayName(node);
  const avatar = getNodeAvatarLetter(node);

  switch (node.type) {
    case NodeType.USER:
      return { role: "human", author, avatar };
    case NodeType.ASSISTANT:
      return { role: "machine", author, avatar };
    case NodeType.SYSTEM:
      return { role: "system", author, avatar };
    case NodeType.COMPRESSED:
      return { role: "system", author, avatar };
  }
}

export function MessageItem({ node }: MessageItemProps) {
  const meta = getMessageMeta(node);
  const time = format(new Date(node.createdAt), "HH:mm");
  const body =
    node.type === NodeType.COMPRESSED ? node.summary ?? node.content : node.content;
  const isAssistant = node.type === NodeType.ASSISTANT;
  const isSending = useAppStore((s) => s.isSending);
  const retryAssistant = useAppStore((s) => s.retryAssistant);

  return (
    <div className="animate-message-in mb-8 max-w-[680px]">
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-[0.9rem] italic text-cream ${
            meta.role === "human"
              ? "bg-human"
              : meta.role === "machine"
                ? "bg-machine"
                : "bg-system"
          }`}
        >
          {meta.avatar}
        </div>
        <span className="text-[0.9rem] font-medium text-ink">
          {meta.author}
        </span>
        <span className="font-mono text-[0.7rem] text-sand">{time}</span>
      </div>

      <div className="prose-cortex pl-11 text-[0.95rem] leading-relaxed text-charcoal">
        <MarkdownContent content={body} />
      </div>

      {isAssistant ? (
        <div className="mt-3 flex justify-end gap-2 pl-11">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-parchment px-3 py-1 text-[0.65rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink disabled:opacity-50"
            onClick={() => void navigator.clipboard.writeText(body)}
            disabled={isSending}
            aria-label="Copy response"
          >
            <div className="h-3.5 w-3.5">
              <CopyIcon />
            </div>
            复制
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-parchment px-3 py-1 text-[0.65rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink disabled:opacity-50"
            onClick={() => void retryAssistant(node.id)}
            disabled={isSending}
            aria-label="Retry response"
          >
            <div className="h-3.5 w-3.5">
              <RetryIcon />
            </div>
            重试
          </button>
        </div>
      ) : null}
    </div>
  );
}

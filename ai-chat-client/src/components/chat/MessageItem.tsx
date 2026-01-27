"use client";

import { format } from "date-fns";

import { NodeType, type Node } from "@/types";
import { getNodeAvatarLetter, getNodeDisplayName } from "@/lib/utils/nodeDisplay";

import { MarkdownContent } from "./MarkdownContent";
interface MessageItemProps {
  node: Node;
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
    </div>
  );
}

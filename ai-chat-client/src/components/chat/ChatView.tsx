"use client";

import { useMemo } from "react";

import { useAppStore } from "@/store/useStore";
import { NodeType, type Node } from "@/types";

import { InputArea } from "./InputArea";
import { MessageList } from "./MessageList";

function buildPath(nodes: Map<string, Node>, activeNodeId: string | null): Node[] {
  if (!activeNodeId) return [];

  const seen = new Set<string>();
  const path: Node[] = [];

  let current = nodes.get(activeNodeId) ?? null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    if (!current.parentId) break;
    current = nodes.get(current.parentId) ?? null;
  }

  return path;
}

export function ChatView() {
  const nodes = useAppStore((s) => s.nodes);
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const currentTree = useAppStore((s) => s.getCurrentTree());

  const isLoading = useAppStore((s) => s.isLoading);
  const isSending = useAppStore((s) => s.isSending);
  const error = useAppStore((s) => s.llmError ?? s.error);

  const model = useAppStore((s) => s.model);
  const temperature = useAppStore((s) => s.temperature);
  const contextBox = useAppStore((s) => s.contextBox);

  const sendMessage = useAppStore((s) => s.sendMessage);

  const messages = useMemo(() => {
    const path = buildPath(nodes, activeNodeId);
    return path.filter((n) => n.type !== NodeType.SYSTEM);
  }, [nodes, activeNodeId]);

  const tokenLabel =
    contextBox && contextBox.maxTokens
      ? `Context: ${contextBox.totalTokens.toLocaleString()} / ${contextBox.maxTokens.toLocaleString()}`
      : "";

  if (!currentTree) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sand">
        {isLoading ? "Loading..." : "No conversation loaded."}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} isSending={isSending} error={error} />
      <InputArea
        onSend={async (content) => {
          await sendMessage(content);
        }}
        disabled={isLoading || isSending}
        modelLabel={model}
        temperatureLabel={temperature.toFixed(1)}
        tokenLabel={tokenLabel}
      />
    </div>
  );
}

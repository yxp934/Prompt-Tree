"use client";

import { useMemo } from "react";

import { getEnabledModelOptions, buildModelSelectionKey } from "@/lib/services/providerModelService";
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

  const providers = useAppStore((s) => s.providers);
  const model = useAppStore((s) => s.model);
  const temperature = useAppStore((s) => s.temperature);
  const contextBox = useAppStore((s) => s.contextBox);
  const selectedModels = useAppStore((s) => s.selectedModels);
  const setSelectedModels = useAppStore((s) => s.setSelectedModels);

  const sendMessage = useAppStore((s) => s.sendMessage);

  const messages = useMemo(() => {
    const path = buildPath(nodes, activeNodeId);
    return path.filter((n) => n.type !== NodeType.SYSTEM);
  }, [nodes, activeNodeId]);

  const enabledModelOptions = useMemo(
    () => getEnabledModelOptions(providers),
    [providers],
  );

  const modelLabel = useMemo(() => {
    if (selectedModels.length === 0) return model;
    const optionMap = new Map(
      enabledModelOptions.map((option) => [buildModelSelectionKey(option), option]),
    );
    const labels = selectedModels.map((selection) => {
      const option = optionMap.get(buildModelSelectionKey(selection));
      return option?.modelId ?? selection.modelId;
    });
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.length} models`;
  }, [selectedModels, enabledModelOptions, model]);

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
        modelLabel={modelLabel}
        temperatureLabel={temperature.toFixed(1)}
        tokenLabel={tokenLabel}
        modelOptions={enabledModelOptions}
        selectedModels={selectedModels}
        onSelectedModelsChange={setSelectedModels}
      />
    </div>
  );
}

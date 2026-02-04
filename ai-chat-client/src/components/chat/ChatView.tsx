"use client";

import { useEffect, useMemo } from "react";

import { useT } from "@/lib/i18n/useT";
import {
  buildModelSelectionKey,
  getEnabledModelOptions,
} from "@/lib/services/providerModelService";
import { estimateTokens } from "@/lib/services/tokenService";
import { buildToolInstructionBlocks } from "@/lib/services/tools/toolInstructions";
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

function buildConversation(nodes: Map<string, Node>, activeNodeId: string | null): Node[] {
  const path = buildPath(nodes, activeNodeId);
  if (path.length === 0) return [];

  const lastUserIndex = [...path]
    .reverse()
    .findIndex((node) => node.type === NodeType.USER);

  if (lastUserIndex === -1) return path;

  const index = path.length - 1 - lastUserIndex;
  const lastUserNode = path[index];
  const siblings = Array.from(nodes.values())
    .filter((node) => node.parentId === lastUserNode.id && node.type === NodeType.ASSISTANT)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (siblings.length <= 1) return path;

  return [...path.slice(0, index + 1), ...siblings];
}

export function ChatView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const nodes = useAppStore((s) => s.nodes);
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const folders = useAppStore((s) => s.folders);

  const isLoading = useAppStore((s) => s.isLoading);
  const isSending = useAppStore((s) => s.isSending);
  const error = useAppStore((s) => s.llmError ?? s.error);

  const providers = useAppStore((s) => s.providers);
  const model = useAppStore((s) => s.model);
  const temperature = useAppStore((s) => s.temperature);
  const contextBox = useAppStore((s) => s.contextBox);
  const selectedModels = useAppStore((s) => s.selectedModels);
  const setSelectedModels = useAppStore((s) => s.setSelectedModels);
  const toolSettings = useAppStore((s) => s.toolSettings);
  const draftToolUses = useAppStore((s) => s.draftToolUses);
  const setDraftToolUses = useAppStore((s) => s.setDraftToolUses);
  const addFilesToContext = useAppStore((s) => s.addFilesToContext);

  const sendMessage = useAppStore((s) => s.sendMessage);

  const messages = useMemo(() => {
    const conversation = buildConversation(nodes, activeNodeId);
    return conversation.filter((n) => n.type !== NodeType.SYSTEM);
  }, [nodes, activeNodeId]);

  const enabledModelOptions = useMemo(
    () => getEnabledModelOptions(providers),
    [providers],
  );

  const folderEnabledOptions = useMemo(() => {
    const folderId = currentTree?.folderId ?? null;
    if (!folderId) return enabledModelOptions;
    const folder = folders.get(folderId) ?? null;
    const enabled = folder?.enabledModels;
    if (enabled == null) return enabledModelOptions;
    const allowedKeys = new Set(enabled.map(buildModelSelectionKey));
    return enabledModelOptions.filter((option) => allowedKeys.has(buildModelSelectionKey(option)));
  }, [currentTree?.folderId, enabledModelOptions, folders]);

  useEffect(() => {
    const folderId = currentTree?.folderId ?? null;
    if (!folderId) return;
    const folder = folders.get(folderId) ?? null;
    const enabled = folder?.enabledModels;
    if (enabled == null) return;

    const allowedKeys = new Set(folderEnabledOptions.map(buildModelSelectionKey));
    const pruned = selectedModels.filter((selection) =>
      allowedKeys.has(buildModelSelectionKey(selection)),
    );
    if (pruned.length === selectedModels.length) return;
    setSelectedModels(pruned);
  }, [currentTree?.folderId, folderEnabledOptions, folders, selectedModels, setSelectedModels]);

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
    return t("chat.modelLabel.count", { count: labels.length });
  }, [selectedModels, enabledModelOptions, model, t]);

  const toolTokens = useMemo(() => {
    const blocks = buildToolInstructionBlocks(draftToolUses, toolSettings);
    return blocks.reduce((sum, block) => sum + estimateTokens(block.content), 0);
  }, [draftToolUses, toolSettings]);

  const tokenLabel =
    contextBox && contextBox.maxTokens
      ? t("chat.contextTokens", {
          used: (contextBox.totalTokens + toolTokens).toLocaleString(locale),
          max: contextBox.maxTokens.toLocaleString(locale),
        })
      : "";

  if (!currentTree) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sand">
        {isLoading ? t("common.loading") : t("chat.noConversationLoaded")}
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <MessageList messages={messages} isSending={isSending} error={error} />
      <InputArea
        onSend={async (content) => {
          await sendMessage(content);
        }}
        onAttachFiles={async (files) => {
          await addFilesToContext(files);
        }}
        disabled={isLoading || isSending}
        modelLabel={modelLabel}
        temperatureLabel={temperature.toFixed(1)}
        tokenLabel={tokenLabel}
        modelOptions={folderEnabledOptions}
        selectedModels={selectedModels}
        onSelectedModelsChange={setSelectedModels}
        selectedTools={draftToolUses}
        onSelectedToolsChange={setDraftToolUses}
        toolSettings={toolSettings}
      />
    </div>
  );
}

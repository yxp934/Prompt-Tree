"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { useT } from "@/lib/i18n/useT";
import { isMessageKey } from "@/lib/i18n/translate";
import { computePathIds } from "@/lib/services/dagService";
import { getSupportedFileAcceptAttribute } from "@/lib/services/fileImportService";
import { stripModelThinkingTags } from "@/lib/services/messageContentService";
import { estimateTokens } from "@/lib/services/tokenService";
import { buildToolInstructionBlocks } from "@/lib/services/tools/toolInstructions";
import { DND_NODE_ID } from "@/lib/utils/dnd";
import { useAppStore } from "@/store/useStore";
import { NodeType, type ContextBlock, type Node, type NodeMetaInstructions } from "@/types";
import type { ToolUseId } from "@/types";

type ContextType = "system" | "human" | "machine" | "compressed" | "tool" | "file";

interface ContextCard {
  id: string;
  type: ContextType;
  title: string;
  preview: string;
  tokens: number;
}

function SystemIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function HumanIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function MachineIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function CompressedIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M14.7 6.3a4 4 0 0 1-5.65 5.65L3 18v3h3l6.05-6.05a4 4 0 0 1 5.65-5.65l-2.1 2.1 1.4 1.4 2.1-2.1Z"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M14 2v6h6"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function getIcon(type: ContextType) {
  switch (type) {
    case "system":
      return <SystemIcon />;
    case "human":
      return <HumanIcon />;
    case "machine":
      return <MachineIcon />;
    case "compressed":
      return <CompressedIcon />;
    case "tool":
      return <ToolIcon />;
    case "file":
      return <FileIcon />;
  }
}

function getIconBgClass(type: ContextType) {
  switch (type) {
    case "system":
      return "bg-system";
    case "human":
      return "bg-human";
    case "machine":
      return "bg-machine";
    case "compressed":
      return "bg-copper";
    case "tool":
      return "bg-copper";
    case "file":
      return "bg-copper";
  }
}

function isToolUseId(value: string): value is ToolUseId {
  if (value === "web_search" || value === "python" || value === "mcp") return true;
  if (value.startsWith("mcp:")) return Boolean(value.slice("mcp:".length).trim());
  return false;
}

function buildCompressionChainIds(
  nodeIds: string[],
  nodes: Map<string, Node>,
  rootId: string | null,
  tailId?: string | null,
): string[] {
  const unique = Array.from(new Set(nodeIds)).filter((id) => nodes.has(id));
  if (unique.length < 2) {
    throw new Error("context.compress.errors.minTwoNodes");
  }

  const candidateSet = new Set(unique);
  let tailPath: string[] | null = null;

  if (tailId && nodes.has(tailId)) {
    const path = computePathIds(nodes, tailId);
    const coversAll = unique.every((candidate) => path.includes(candidate));
    if (!coversAll) {
      throw new Error("context.compress.errors.noGaps");
    }
    tailPath = path;
  } else {
    for (const id of unique) {
      const path = computePathIds(nodes, id);
      const coversAll = unique.every((candidate) => path.includes(candidate));
      if (!coversAll) continue;
      if (tailPath) {
        throw new Error("context.compress.errors.noBranches");
      }
      tailPath = path;
    }
  }

  if (!tailPath) {
    throw new Error("context.compress.errors.noGaps");
  }

  const entryIndex = tailPath.findIndex((id) => candidateSet.has(id));
  if (entryIndex === -1) {
    throw new Error("context.compress.errors.noGaps");
  }

  let chain = tailPath.slice(entryIndex);
  if (rootId) {
    chain = chain.filter((id) => id !== rootId);
  }

  if (chain.length < 2) {
    throw new Error("context.compress.errors.minTwoNodes");
  }

  return chain;
}

interface ContextCardItemProps {
  card: ContextCard;
  onRemove: (id: string) => void;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
}

function ContextCardItem({
  card,
  onRemove,
  onClick,
  draggable,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: ContextCardItemProps) {
  const t = useT();
  const isCompressed = card.type === "compressed";

  return (
    <div
      className={`context-card-hover relative mb-2.5 rounded-xl border p-3.5 transition-all duration-200 ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      } ${
        isCompressed
          ? "border-copper bg-copper-glow"
          : "border-parchment bg-paper"
      }`}
      data-context-card-id={card.id}
      draggable={draggable}
      onClick={onClick}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnter={() => onDragEnter?.()}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <button
        className="context-card-remove absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-cream opacity-0 text-sand transition-all duration-150 hover:bg-[#e74c3c] hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(card.id);
        }}
        aria-label={t("context.removeFromContextAria")}
      >
        <CloseIcon />
      </button>

      <div className="mb-2 flex items-center gap-2.5">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md text-cream ${getIconBgClass(card.type)}`}
        >
          <div className="h-3 w-3">{getIcon(card.type)}</div>
        </div>
        <span className="flex-1 text-[0.8rem] font-medium text-ink">
          {card.title}
        </span>
        <span className="font-mono text-[0.7rem] text-sand">{card.tokens}</span>
      </div>

      <div className="line-clamp-2 text-[0.8rem] leading-snug text-clay">
        {card.preview}
      </div>
    </div>
  );
}

export default function ContextPanel() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const nodes = useAppStore((s) => s.nodes);
  const contextBox = useAppStore((s) => s.contextBox);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const addToContext = useAppStore((s) => s.addToContext);
  const addFilesToContext = useAppStore((s) => s.addFilesToContext);
  const removeFromContext = useAppStore((s) => s.removeFromContext);
  const clearContext = useAppStore((s) => s.clearContext);
  const reorderContext = useAppStore((s) => s.reorderContext);
  const buildContextContent = useAppStore((s) => s.buildContextContent);
  const toolSettings = useAppStore((s) => s.toolSettings);
  const draftToolUses = useAppStore((s) => s.draftToolUses);
  const toggleDraftToolUse = useAppStore((s) => s.toggleDraftToolUse);

  const compressionOpen = useAppStore((s) => s.compressionOpen);
  const openCompression = useAppStore((s) => s.openCompression);
  const closeCompression = useAppStore((s) => s.closeCompression);
  const compressNodes = useAppStore((s) => s.compressNodes);
  const generateCompressionSuggestion = useAppStore(
    (s) => s.generateCompressionSuggestion,
  );
  const isCompressing = useAppStore((s) => s.isCompressing);
  const compressionError = useAppStore((s) => s.compressionError);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const orderedIds = useMemo(
    () => localOrder ?? contextBox?.blocks?.map((b) => b.id) ?? [],
    [localOrder, contextBox?.blocks],
  );

  const blockById = useMemo(() => {
    const entries = contextBox?.blocks?.map((block) => [block.id, block] as const) ?? [];
    return new Map(entries);
  }, [contextBox?.blocks]);

  const cards = useMemo(() => {
    if (!contextBox) return [];
    const out: ContextCard[] = [];

    for (const id of orderedIds) {
      const block = blockById.get(id);
      if (!block) continue;

      if (block.kind === "file") {
        const preview =
          block.fileKind === "image"
            ? `${block.mimeType} · ${(block.size / 1024).toFixed(1)} KB`
            : block.content.trim().slice(0, 160) + (block.truncated ? "…" : "");
        out.push({
          id: block.id,
          type: "file",
          title: block.filename,
          preview:
            preview ||
            (block.fileKind === "image"
              ? t("common.data")
              : t("tree.node.emptyContent")),
          tokens: block.tokenCount,
        });
        continue;
      }

      const node = nodes.get(block.nodeId);
      if (!node) continue;

      const type: ContextType =
        node.type === NodeType.SYSTEM
          ? "system"
          : node.type === NodeType.USER
            ? "human"
            : node.type === NodeType.ASSISTANT
              ? "machine"
              : "compressed";

      const title =
        type === "system"
          ? t("context.card.system")
          : type === "human"
            ? t("context.card.user")
            : type === "machine"
              ? node.metadata.modelName ?? t("node.author.assistant")
              : t("context.card.compressed");

      const rawPreview =
        node.type === NodeType.COMPRESSED ? node.summary ?? node.content : node.content;
      const preview =
        node.type === NodeType.ASSISTANT
          ? stripModelThinkingTags(rawPreview).visible
          : rawPreview;

      out.push({
        id: block.id,
        type,
        title,
        preview,
        tokens: node.tokenCount,
      });
    }

    return out;
  }, [contextBox, orderedIds, blockById, nodes, t]);

  const toolBlocks = useMemo(
    () => buildToolInstructionBlocks(draftToolUses, toolSettings),
    [draftToolUses, toolSettings],
  );
  const toolCards = useMemo(() => {
    return toolBlocks.map((block) => ({
      id: block.id,
      type: "tool" as const,
      title: block.title,
      preview: block.content,
      tokens: estimateTokens(block.content),
    }));
  }, [toolBlocks]);

  const toolTokens = toolCards.reduce((sum, card) => sum + card.tokens, 0);
  const baseTokens = contextBox?.totalTokens ?? 0;
  const totalTokens = baseTokens + toolTokens;
  const maxTokens = contextBox?.maxTokens ?? 8192;
  const usagePercent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;

  const contextCardsRef = useRef<HTMLDivElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [blockPreview, setBlockPreview] = useState<ContextBlock | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const contextCandidateIds = useMemo(() => {
    const rootId = currentTree?.rootId ?? null;
    const ids =
      contextBox?.blocks?.filter((block) => block.kind === "node").map((block) => block.nodeId) ??
      [];
    if (!rootId) return ids;
    return ids.filter((id) => id !== rootId);
  }, [contextBox?.blocks, currentTree?.rootId]);

  const contextTailId =
    activeNodeId ?? contextCandidateIds[contextCandidateIds.length - 1] ?? null;
  const selectionEligible =
    selectedNodeIds.length >= 2 &&
    Boolean(contextTailId && selectedNodeIds.includes(contextTailId)) &&
    selectedNodeIds.every((id) => contextCandidateIds.includes(id));
  const compressionTargetIds = useMemo(
    () => (selectionEligible ? selectedNodeIds : contextCandidateIds),
    [selectionEligible, selectedNodeIds, contextCandidateIds],
  );
  const canCompress = compressionTargetIds.length >= 2;
  const compressButtonLabel = selectionEligible
    ? t("context.compress.selected", { count: selectedNodeIds.length })
    : t("context.compress.context", { count: contextCandidateIds.length });

  const { compressionNodeIds, compressionSelectionError } = useMemo(() => {
    if (!compressionOpen) {
      return { compressionNodeIds: [] as string[], compressionSelectionError: null as string | null };
    }

    try {
      return {
        compressionNodeIds: buildCompressionChainIds(
          compressionTargetIds,
          nodes,
          currentTree?.rootId ?? null,
          selectionEligible ? null : contextTailId,
        ),
        compressionSelectionError: null,
      };
    } catch (err) {
      return {
        compressionNodeIds: [] as string[],
        compressionSelectionError:
          err instanceof Error ? err.message : "context.compress.errors.invalidSelection",
      };
    }
  }, [
    compressionOpen,
    compressionTargetIds,
    nodes,
    contextTailId,
    currentTree?.rootId,
    selectionEligible,
  ]);
  const [compressionSummary, setCompressionSummary] = useState("");
  const [compressionLanguage, setCompressionLanguage] = useState("");
  const [compressionFormat, setCompressionFormat] = useState("");
  const [compressionRole, setCompressionRole] = useState("");

  const moveCard = (ids: string[], from: number, to: number) => {
    if (from === to) return ids;
    const next = ids.slice();
    const [item] = next.splice(from, 1);
    if (!item) return ids;
    next.splice(to, 0, item);
    return next;
  };

  const openPreview = async () => {
    setPreviewOpen(true);
    setPreviewText(null);
    try {
      const text = await buildContextContent();
      setPreviewText(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "context.preview.failed";
      setPreviewText(isMessageKey(message) ? t(message) : message);
    }
  };

  const selectionErrorText =
    compressionSelectionError && isMessageKey(compressionSelectionError)
      ? t(compressionSelectionError)
      : compressionSelectionError;

  const compressionErrorText =
    compressionError && isMessageKey(compressionError)
      ? t(compressionError)
      : compressionError;

  const nodeTypeLabel = (type: NodeType) => {
    switch (type) {
      case NodeType.SYSTEM:
        return t("node.type.system");
      case NodeType.USER:
        return t("node.type.user");
      case NodeType.ASSISTANT:
        return t("node.type.assistant");
      case NodeType.COMPRESSED:
        return t("node.type.compressed");
    }
  };

  const getDropInsertIndex = (clientY: number) => {
    const container = contextCardsRef.current;
    if (!container) return cards.length;

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-context-card-id]"),
    );
    if (elements.length === 0) return 0;

    for (let index = 0; index < elements.length; index += 1) {
      const rect = elements[index]?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.top + rect.height / 2) return index;
    }

    return elements.length;
  };

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-parchment bg-cream">
      <div className="border-b border-parchment px-6 pb-5 pt-7">
        <div className="font-display text-[1.1rem] text-ink">
          {t("context.title")}
        </div>
        <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
          {t("context.subtitle")}
        </div>
      </div>

      <div className="border-b border-parchment p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[0.7rem] uppercase tracking-widest text-sand">
            {t("context.tokenUsage")}
          </span>
          <span className="font-mono text-[0.85rem] text-ink">
            <strong className="font-medium text-copper">
              {totalTokens.toLocaleString(locale)}
            </strong>{" "}
            / {maxTokens.toLocaleString(locale)}
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-sm bg-paper">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-copper to-copper-light transition-all duration-500"
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-sand">
          <span>0</span>
          <span>4K</span>
          <span>8K</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col p-5">
        <div className="mb-3 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          <span>{t("context.activeNodes")}</span>
          <div className="flex items-center gap-3">
            <button
              className="border-none bg-transparent font-body text-[0.75rem] normal-case tracking-normal text-copper hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("chat.input.attach")}
            </button>
            <button
              className="border-none bg-transparent font-body text-[0.75rem] normal-case tracking-normal text-copper hover:underline"
              onClick={clearContext}
            >
              {t("context.clearAll")}
            </button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              multiple
              accept={getSupportedFileAcceptAttribute()}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                if (selected.length > 0) {
                  void addFilesToContext(selected);
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {toolCards.length > 0 ? (
          <div className="mb-4">
            <div className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
              {t("context.toolBlocks")}
            </div>
            <div className="max-h-[140px] overflow-y-auto pr-1">
              {toolCards.map((card) => (
                <ContextCardItem
                  key={card.id}
                  card={card}
                  onRemove={(id) => {
                    if (isToolUseId(id)) toggleDraftToolUse(id);
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div
          ref={contextCardsRef}
          className={`flex-1 min-h-0 overflow-y-auto pr-1 transition-colors duration-150 ${
            isDragOver ? "rounded-xl bg-copper-glow" : ""
          }`}
          data-testid="context-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingId) return;
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (draggingId) return;

            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length > 0) {
              void addFilesToContext(files, getDropInsertIndex(e.clientY));
              return;
            }

            const nodeId =
              e.dataTransfer.getData(DND_NODE_ID) ||
              e.dataTransfer.getData("text/plain");
            if (!nodeId) return;

            void addToContext(nodeId, getDropInsertIndex(e.clientY));
          }}
        >
          {cards.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-parchment bg-paper/60 p-4 text-center text-sand">
              <div className="space-y-1">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-sand">
                  <div className="h-5 w-5">
                    <UploadIcon />
                  </div>
                </div>
                <div className="text-[0.85rem] text-clay">{t("context.dropzone.title")}</div>
                <div className="text-[0.75rem]">{t("context.dropzone.subtitle")}</div>
              </div>
            </div>
          ) : (
            cards.map((card) => (
              <ContextCardItem
                key={card.id}
                card={card}
                onRemove={removeFromContext}
                onClick={() => {
                  const block = blockById.get(card.id) ?? null;
                  if (!block || block.kind !== "file") return;
                  setBlockPreview(block);
                }}
                draggable
                onDragStart={() => {
                  setDraggingId(card.id);
                  setLocalOrder(orderedIds);
                }}
                onDragEnter={() => {
                  if (!draggingId) return;
                  setLocalOrder((prev) => {
                    const base = prev ?? orderedIds;
                    const from = base.indexOf(draggingId);
                    const to = base.indexOf(card.id);
                    if (from === -1 || to === -1 || from === to) return base;
                    return moveCard(base, from, to);
                  });
                }}
                onDragEnd={() => {
                  const next = localOrder ?? orderedIds;
                  reorderContext(next);
                  setDraggingId(null);
                  setLocalOrder(null);
                }}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-parchment p-5">
        <button
          className={`flex w-full items-center gap-3 rounded-[10px] border border-parchment bg-paper px-5 py-3.5 font-body text-[0.85rem] text-ink transition-all duration-150 ${
            canCompress
              ? "hover:border-copper hover:bg-copper-glow"
              : "cursor-not-allowed opacity-60"
          }`}
          disabled={!canCompress}
          onClick={() => {
            if (!canCompress) return;
            setCompressionSummary("");
            setCompressionLanguage("");
            setCompressionFormat("");
            setCompressionRole("");
            openCompression();
          }}
        >
          <div className="h-[18px] w-[18px] text-copper">
            <CompressedIcon />
          </div>
          {compressButtonLabel}
        </button>
        <button
          className="flex w-full items-center gap-3 rounded-[10px] border border-parchment bg-paper px-5 py-3.5 font-body text-[0.85rem] text-ink opacity-60 transition-all duration-150"
          disabled
        >
          <div className="h-[18px] w-[18px] text-copper">
            <LightbulbIcon />
          </div>
          {t("context.optimize")}
        </button>
      </div>

      <button
        className="flex items-center justify-between border-t border-parchment bg-transparent px-5 py-4 font-body text-[0.85rem] text-clay transition-all duration-150 hover:bg-paper hover:text-ink"
        onClick={() => void openPreview()}
      >
        <span>{t("context.preview.button")}</span>
        <ChevronRightIcon />
      </button>

      <Modal
        open={previewOpen}
        title={t("context.preview.title")}
        onClose={() => setPreviewOpen(false)}
      >
        <div className="space-y-4">
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-parchment bg-paper p-4 font-mono text-[0.75rem] leading-relaxed text-ink">
            {previewText ?? t("context.preview.building")}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={compressionOpen}
        title={t("context.compress.title")}
        onClose={() => {
          closeCompression();
          setCompressionSummary("");
          setCompressionLanguage("");
          setCompressionFormat("");
          setCompressionRole("");
        }}
      >
        <div className="space-y-4">
          {selectionErrorText && (
            <div className="rounded-xl border border-[#e74c3c]/40 bg-[#fff5f2] p-3 text-[0.85rem] text-[#b73c2b]">
              {selectionErrorText}
            </div>
          )}

          {compressionErrorText && (
            <div className="rounded-xl border border-[#e74c3c]/40 bg-[#fff5f2] p-3 text-[0.85rem] text-[#b73c2b]">
              {compressionErrorText}
            </div>
          )}

          <div>
            <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
              {t("context.compress.selection", { count: compressionNodeIds.length })}
            </div>
            <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-parchment bg-paper p-3 text-[0.8rem] text-clay">
              {compressionNodeIds.length === 0 ? (
                <div className="text-sand">{t("context.compress.noneSelected")}</div>
              ) : (
                compressionNodeIds
                  .map((id) => nodes.get(id))
                  .filter((n): n is Node => Boolean(n))
                  .map((node) => (
                    <div key={node.id} className="rounded-lg bg-cream p-2">
                      <div className="mb-1 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-wide text-sand">
                        <span>{nodeTypeLabel(node.type)}</span>
                        <span>{node.tokenCount}</span>
                      </div>
                      <div className="line-clamp-2 whitespace-pre-wrap">
                        {node.type === NodeType.COMPRESSED
                          ? node.summary ?? node.content
                          : node.content}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
              {t("context.compress.summary")}
            </div>
            <textarea
              className="h-32 w-full resize-none rounded-xl border border-parchment bg-paper p-3 font-body text-[0.9rem] leading-relaxed text-ink outline-none focus:border-copper"
              value={compressionSummary}
              onChange={(e) => setCompressionSummary(e.target.value)}
              placeholder={t("context.compress.summaryPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                {t("context.compress.language")}
              </div>
              <Input
                value={compressionLanguage}
                onChange={(e) => setCompressionLanguage(e.target.value)}
                placeholder={t("context.compress.languagePlaceholder")}
                autoComplete="off"
              />
            </div>
            <div>
              <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                {t("context.compress.format")}
              </div>
              <Input
                value={compressionFormat}
                onChange={(e) => setCompressionFormat(e.target.value)}
                placeholder={t("context.compress.formatPlaceholder")}
                autoComplete="off"
              />
            </div>
            <div>
              <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                {t("context.compress.role")}
              </div>
              <Input
                value={compressionRole}
                onChange={(e) => setCompressionRole(e.target.value)}
                placeholder={t("context.compress.rolePlaceholder")}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => closeCompression()}
              disabled={isCompressing}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void (async () => {
                  if (compressionNodeIds.length < 2) return;
                  try {
                    const suggestion = await generateCompressionSuggestion(
                      compressionNodeIds,
                    );
                    setCompressionSummary(suggestion.summary);
                    setCompressionLanguage(suggestion.metaInstructions.language ?? "");
                    setCompressionFormat(suggestion.metaInstructions.format ?? "");
                    setCompressionRole(suggestion.metaInstructions.role ?? "");
                  } catch {
                    // errors are surfaced via store state
                  }
                })();
              }}
              disabled={isCompressing || compressionNodeIds.length < 2}
            >
              {t("context.compress.generate")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void (async () => {
                  if (compressionNodeIds.length < 2) return;
                  if (compressionSelectionError) return;

                  const metaInstructions: NodeMetaInstructions = {};
                  if (compressionLanguage.trim()) {
                    metaInstructions.language = compressionLanguage.trim();
                  }
                  if (compressionFormat.trim()) {
                    metaInstructions.format = compressionFormat.trim();
                  }
                  if (compressionRole.trim()) {
                    metaInstructions.role = compressionRole.trim();
                  }

                  try {
                    await compressNodes(compressionNodeIds, {
                      summary: compressionSummary,
                      metaInstructions,
                    });
                    closeCompression();
                  } catch {
                    // errors are surfaced via store state
                  }
                })();
              }}
              disabled={isCompressing || Boolean(compressionSelectionError)}
            >
              {t("context.compress.confirm")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(blockPreview)}
        title={
          blockPreview?.kind === "file"
            ? blockPreview.filename
            : t("context.preview.title")
        }
        onClose={() => setBlockPreview(null)}
      >
        {blockPreview?.kind === "file" ? (
          blockPreview.fileKind === "image" ? (
            <div className="space-y-3">
              <Image
                src={blockPreview.dataUrl}
                alt={blockPreview.filename}
                width={1200}
                height={900}
                unoptimized
                className="max-h-[60vh] w-full rounded-xl border border-parchment bg-paper object-contain"
              />
              <div className="font-mono text-[0.7rem] text-sand">
                {blockPreview.mimeType} · {(blockPreview.size / 1024).toFixed(1)} KB
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-parchment bg-paper p-4 font-mono text-[0.75rem] leading-relaxed text-ink">
                {blockPreview.content}
              </div>
              {blockPreview.truncated ? (
                <div className="font-mono text-[0.7rem] text-sand">
                  [Truncated]
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </Modal>
    </aside>
  );
}

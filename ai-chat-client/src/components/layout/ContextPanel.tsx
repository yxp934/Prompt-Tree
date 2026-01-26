"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { orderCompressedChainIds } from "@/lib/services/compressionService";
import { DND_NODE_ID } from "@/lib/utils/dnd";
import { getNodeDisplayName } from "@/lib/utils/nodeDisplay";
import { useAppStore } from "@/store/useStore";
import { NodeType, type Node, type NodeMetaInstructions } from "@/types";

type ContextType = "system" | "human" | "machine" | "compressed";

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
  }
}

function nodeToCard(node: Node): ContextCard {
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
      ? "System Prompt"
      : type === "human"
        ? "User Message"
        : type === "machine"
          ? getNodeDisplayName(node)
          : "Compressed";

  const preview =
    node.type === NodeType.COMPRESSED ? node.summary ?? node.content : node.content;

  return {
    id: node.id,
    type,
    title,
    preview,
    tokens: node.tokenCount,
  };
}

interface ContextCardItemProps {
  card: ContextCard;
  onRemove: (id: string) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
}

function ContextCardItem({
  card,
  onRemove,
  draggable,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: ContextCardItemProps) {
  const isCompressed = card.type === "compressed";

  return (
    <div
      className={`context-card-hover relative mb-2.5 cursor-grab rounded-xl border p-3.5 transition-all duration-200 active:cursor-grabbing ${
        isCompressed
          ? "border-copper bg-copper-glow"
          : "border-parchment bg-paper"
      }`}
      draggable={draggable}
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
        onClick={() => onRemove(card.id)}
        aria-label="Remove from context"
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
  const nodes = useAppStore((s) => s.nodes);
  const contextBox = useAppStore((s) => s.contextBox);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const addToContext = useAppStore((s) => s.addToContext);
  const removeFromContext = useAppStore((s) => s.removeFromContext);
  const clearContext = useAppStore((s) => s.clearContext);
  const reorderContext = useAppStore((s) => s.reorderContext);
  const buildContextContent = useAppStore((s) => s.buildContextContent);

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
    () => localOrder ?? contextBox?.nodeIds ?? [],
    [localOrder, contextBox?.nodeIds],
  );

  const cards = useMemo(() => {
    if (!contextBox) return [];
    return orderedIds
      .map((id) => nodes.get(id))
      .filter((n): n is Node => Boolean(n))
      .map(nodeToCard);
  }, [contextBox, orderedIds, nodes]);

  const totalTokens = contextBox?.totalTokens ?? 0;
  const maxTokens = contextBox?.maxTokens ?? 8192;
  const usagePercent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;

  const [isDragOver, setIsDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);

  const contextCandidateIds = useMemo(() => {
    const rootId = currentTree?.rootId ?? null;
    const ids = contextBox?.nodeIds ?? [];
    if (!rootId) return ids;
    return ids.filter((id) => id !== rootId);
  }, [contextBox?.nodeIds, currentTree?.rootId]);

  const compressionTargetIds = useMemo(
    () => (selectedNodeIds.length >= 2 ? selectedNodeIds : contextCandidateIds),
    [selectedNodeIds, contextCandidateIds],
  );
  const canCompress = compressionTargetIds.length >= 2;
  const compressButtonLabel =
    selectedNodeIds.length >= 2
      ? `Compress Selected (${selectedNodeIds.length})`
      : `Compress Context (${contextCandidateIds.length})`;

  const { compressionNodeIds, compressionSelectionError } = useMemo(() => {
    if (!compressionOpen) {
      return { compressionNodeIds: [] as string[], compressionSelectionError: null as string | null };
    }

    try {
      return {
        compressionNodeIds: orderCompressedChainIds(compressionTargetIds, nodes),
        compressionSelectionError: null,
      };
    } catch (err) {
      return {
        compressionNodeIds: [] as string[],
        compressionSelectionError:
          err instanceof Error ? err.message : "Invalid selection",
      };
    }
  }, [compressionOpen, compressionTargetIds, nodes]);
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
      setPreviewText(err instanceof Error ? err.message : "Failed to build context.");
    }
  };

  return (
    <aside className="flex h-full flex-col border-l border-parchment bg-cream">
      <div className="border-b border-parchment px-6 pb-5 pt-7">
        <div className="font-display text-[1.1rem] text-ink">
          Context Assembly
        </div>
        <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
          Build your prompt
        </div>
      </div>

      <div className="border-b border-parchment p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[0.7rem] uppercase tracking-widest text-sand">
            Token Usage
          </span>
          <span className="font-mono text-[0.85rem] text-ink">
            <strong className="font-medium text-copper">
              {totalTokens.toLocaleString()}
            </strong>{" "}
            / {maxTokens.toLocaleString()}
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

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-3 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          <span>Active Nodes</span>
          <button
            className="border-none bg-transparent font-body text-[0.75rem] normal-case tracking-normal text-copper hover:underline"
            onClick={clearContext}
          >
            Clear all
          </button>
        </div>

        {cards.map((card) => (
          <ContextCardItem
            key={card.id}
            card={card}
            onRemove={removeFromContext}
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
        ))}

        <div
          className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
            isDragOver
              ? "border-copper bg-copper-glow"
              : "border-parchment hover:border-copper hover:bg-copper-glow"
          }`}
          data-testid="context-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const nodeId =
              e.dataTransfer.getData(DND_NODE_ID) ||
              e.dataTransfer.getData("text/plain");
            if (nodeId) void addToContext(nodeId);
          }}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-paper text-sand">
            <div className="h-6 w-6">
              <UploadIcon />
            </div>
          </div>
          <div className="mb-1 text-[0.85rem] text-clay">Drop nodes here</div>
          <div className="text-[0.75rem] text-sand">
            Drag from the tree to add context
          </div>
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
          Optimize Context
        </button>
      </div>

      <button
        className="flex items-center justify-between border-t border-parchment bg-transparent px-5 py-4 font-body text-[0.85rem] text-clay transition-all duration-150 hover:bg-paper hover:text-ink"
        onClick={() => void openPreview()}
      >
        <span>Preview Full Context</span>
        <ChevronRightIcon />
      </button>

      <Modal
        open={previewOpen}
        title="Full Context Preview"
        onClose={() => setPreviewOpen(false)}
      >
        <div className="space-y-4">
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-parchment bg-paper p-4 font-mono text-[0.75rem] leading-relaxed text-ink">
            {previewText ?? "Building context..."}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={compressionOpen}
        title="Compress Nodes"
        onClose={() => {
          closeCompression();
          setCompressionSummary("");
          setCompressionLanguage("");
          setCompressionFormat("");
          setCompressionRole("");
        }}
      >
        <div className="space-y-4">
          {compressionSelectionError && (
            <div className="rounded-xl border border-[#e74c3c]/40 bg-[#fff5f2] p-3 text-[0.85rem] text-[#b73c2b]">
              {compressionSelectionError}
            </div>
          )}

          {compressionError && (
            <div className="rounded-xl border border-[#e74c3c]/40 bg-[#fff5f2] p-3 text-[0.85rem] text-[#b73c2b]">
              {compressionError}
            </div>
          )}

          <div>
            <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
              Selection ({compressionNodeIds.length})
            </div>
            <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-parchment bg-paper p-3 text-[0.8rem] text-clay">
              {compressionNodeIds.length === 0 ? (
                <div className="text-sand">No nodes selected.</div>
              ) : (
                compressionNodeIds
                  .map((id) => nodes.get(id))
                  .filter((n): n is Node => Boolean(n))
                  .map((node) => (
                    <div key={node.id} className="rounded-lg bg-cream p-2">
                      <div className="mb-1 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-wide text-sand">
                        <span>{node.type}</span>
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
              Summary
            </div>
            <textarea
              className="h-32 w-full resize-none rounded-xl border border-parchment bg-paper p-3 font-body text-[0.9rem] leading-relaxed text-ink outline-none focus:border-copper"
              value={compressionSummary}
              onChange={(e) => setCompressionSummary(e.target.value)}
              placeholder="2-3 sentences. You can generate with AI, then edit."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                Language
              </div>
              <Input
                value={compressionLanguage}
                onChange={(e) => setCompressionLanguage(e.target.value)}
                placeholder="zh-CN / en"
                autoComplete="off"
              />
            </div>
            <div>
              <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                Format
              </div>
              <Input
                value={compressionFormat}
                onChange={(e) => setCompressionFormat(e.target.value)}
                placeholder="markdown / json"
                autoComplete="off"
              />
            </div>
            <div>
              <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
                Role
              </div>
              <Input
                value={compressionRole}
                onChange={(e) => setCompressionRole(e.target.value)}
                placeholder="expert"
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
              Cancel
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
              Generate with AI
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
              Compress
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}

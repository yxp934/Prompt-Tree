"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { useAppStore } from "@/store/useStore";
import { NodeType, type Node } from "@/types";

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
          ? "AI Response"
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
}

function ContextCardItem({ card, onRemove }: ContextCardItemProps) {
  const isCompressed = card.type === "compressed";

  return (
    <div
      className={`context-card-hover relative mb-2.5 cursor-grab rounded-xl border p-3.5 transition-all duration-200 active:cursor-grabbing ${
        isCompressed
          ? "border-copper bg-copper-glow"
          : "border-parchment bg-paper"
      }`}
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
  const removeFromContext = useAppStore((s) => s.removeFromContext);
  const clearContext = useAppStore((s) => s.clearContext);
  const buildContextContent = useAppStore((s) => s.buildContextContent);

  const cards = useMemo(() => {
    if (!contextBox) return [];
    return contextBox.nodeIds
      .map((id) => nodes.get(id))
      .filter((n): n is Node => Boolean(n))
      .map(nodeToCard);
  }, [contextBox, nodes]);

  const totalTokens = contextBox?.totalTokens ?? 0;
  const maxTokens = contextBox?.maxTokens ?? 8192;
  const usagePercent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;

  const [isDragOver, setIsDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);

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
          />
        ))}

        <div
          className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
            isDragOver
              ? "border-copper bg-copper-glow"
              : "border-parchment hover:border-copper hover:bg-copper-glow"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={() => setIsDragOver(false)}
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
          className="flex w-full items-center gap-3 rounded-[10px] border border-parchment bg-paper px-5 py-3.5 font-body text-[0.85rem] text-ink opacity-60 transition-all duration-150"
          disabled
        >
          <div className="h-[18px] w-[18px] text-copper">
            <CompressedIcon />
          </div>
          Compress Selected
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
    </aside>
  );
}


"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { getLeafNodes } from "@/lib/services/dagService";
import { useAppStore } from "@/store/useStore";
import { NodeType, type Node } from "@/types";

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M12 20h9"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
      />
    </svg>
  );
}

function defaultBranchLabel(node: Node): string {
  const raw =
    node.type === NodeType.COMPRESSED
      ? node.summary ?? node.content
      : node.content;
  const trimmed = raw.trim();
  if (trimmed) return trimmed.slice(0, 36);
  if (node.type === NodeType.COMPRESSED) return "Compressed branch";
  return `${node.type} branch`;
}

export function BranchList() {
  const nodes = useAppStore((s) => s.nodes);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const setActiveNode = useAppStore((s) => s.setActiveNode);
  const updateNode = useAppStore((s) => s.updateNode);

  const branches = useMemo(() => {
    if (!currentTree) return [] as Node[];
    const leaves = getLeafNodes(nodes.values(), currentTree.rootId);
    return leaves.filter((node) => node.id !== currentTree.rootId);
  }, [currentTree, nodes]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const startEditing = (node: Node) => {
    const fallback = defaultBranchLabel(node);
    setDraftLabel(node.metadata.branchLabel ?? fallback);
    setEditingId(node.id);
  };

  const commitEditing = async () => {
    if (!editingId) return;
    const trimmed = draftLabel.trim();
    await updateNode(editingId, {
      metadata: {
        branchLabel: trimmed || undefined,
        tags: [],
        metaInstructions: {},
      },
    });
    setEditingId(null);
  };

  if (!currentTree) return null;

  return (
    <section className="border-b border-parchment bg-cream px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-sand">
          Branches
        </div>
        <div className="text-[0.75rem] text-sand">
          {branches.length} active
        </div>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {branches.map((node) => {
          const isActive = node.id === activeNodeId;
          const label = node.metadata.branchLabel ?? defaultBranchLabel(node);

          return (
            <div
              key={node.id}
              className={`min-w-[180px] flex-1 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                isActive
                  ? "border-copper bg-copper-glow text-ink"
                  : "border-parchment bg-paper text-clay hover:border-copper"
              }`}
              onClick={() => setActiveNode(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveNode(node.id);
                }
              }}
              role="button"
              tabIndex={0}
              data-branch-id={node.id}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[0.85rem] font-medium text-ink">
                    {editingId === node.id ? (
                      <Input
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onBlur={() => void commitEditing()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitEditing();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingId(null);
                          }
                        }}
                        className="h-8 rounded-lg px-2 py-1 text-[0.8rem]"
                        autoFocus
                      />
                    ) : (
                      <span className="line-clamp-1">{label}</span>
                    )}
                  </div>
                  <div className="mt-1 text-[0.7rem] uppercase tracking-[0.15em] text-sand">
                    {node.type}
                  </div>
                </div>

                {editingId !== node.id && (
                  <Button
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditing(node);
                    }}
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-parchment bg-paper text-sand">
                      <PencilIcon />
                    </span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

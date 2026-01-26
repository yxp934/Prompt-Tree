"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

import type { TreeFlowNodeData } from "@/lib/services/dagService";
import { DND_NODE_ID } from "@/lib/utils/dnd";
import { NodeType } from "@/types";
import { getNodeDisplayName } from "@/lib/utils/nodeDisplay";

function GripIcon() {
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
        strokeWidth="2"
        d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"
      />
    </svg>
  );
}

function typeLabel(node: TreeFlowNodeData["node"]): string {
  return getNodeDisplayName(node);
}

function typeClass(type: NodeType): string {
  switch (type) {
    case NodeType.SYSTEM:
      return "bg-gradient-to-br from-system to-[#3d4a5c] text-cream";
    case NodeType.USER:
      return "bg-gradient-to-br from-human to-[#5a4a3f] text-cream";
    case NodeType.ASSISTANT:
      return "bg-gradient-to-br from-machine to-[#3a5432] text-cream";
    case NodeType.COMPRESSED:
      return "bg-gradient-to-br from-copper to-[#9a5e2a] text-cream";
  }
}

const TreeNode = memo(function TreeNode({ data }: NodeProps<TreeFlowNodeData>) {
  const node = data.node;
  const isCompressed = node.type === NodeType.COMPRESSED;
  const isCollapsed = node.metadata.collapsed ?? false;

  const preview = useMemo(() => {
    if (node.type === NodeType.COMPRESSED) return node.summary ?? "(empty summary)";
    return node.content.trim() ? node.content : "(empty)";
  }, [node]);

  const chrome = data.isActive
    ? "shadow-[0_10px_36px_rgba(184,115,51,0.32),0_0_0_2px_var(--copper)]"
    : data.isSelected
      ? "shadow-[0_8px_28px_rgba(26,24,22,0.18),0_0_0_2px_rgba(196,189,180,0.9)]"
      : data.isInActivePath
        ? "shadow-[0_8px_28px_rgba(26,24,22,0.14),0_0_0_1px_rgba(184,115,51,0.35)]"
        : "shadow-[0_8px_28px_rgba(26,24,22,0.12),0_0_0_1px_rgba(255,255,255,0.08)]";

  return (
    <div
      className={`node-transition group relative w-[200px] cursor-pointer rounded-[18px] px-4 py-3 ${typeClass(
        node.type,
      )} ${chrome}`}
      data-cortex-node-type={node.type}
      data-node-id={node.id}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-0 !bg-[rgba(250,249,247,0.55)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-0 !bg-[rgba(250,249,247,0.55)] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      />

      <div className="mb-1 flex items-center gap-2">
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(255,255,255,0.12)] text-cream opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          draggable
          aria-label="Drag node to context"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onDragStart={(e) => {
            e.dataTransfer.setData(DND_NODE_ID, node.id);
            e.dataTransfer.setData("text/plain", node.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          <GripIcon />
        </button>

        <div className="flex-1">
          <div className="font-mono text-[0.65rem] uppercase tracking-wide opacity-75">
            {typeLabel(node)}
          </div>
        </div>

        {isCompressed && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(255,255,255,0.4)] text-[0.7rem] font-semibold text-cream/80">
            {isCollapsed ? "+" : "−"}
          </div>
        )}

        <div className="font-mono text-[0.7rem] opacity-80">
          {node.tokenCount.toLocaleString()}
        </div>
      </div>

      <div className="line-clamp-2 text-[0.85rem] leading-snug opacity-95">
        {preview}
      </div>
    </div>
  );
});

TreeNode.displayName = "TreeNode";

export default TreeNode;

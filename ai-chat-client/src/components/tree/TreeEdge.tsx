"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";

import type { TreeFlowEdgeData } from "@/lib/services/dagService";

export function TreeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<TreeFlowEdgeData>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  const isActive = data?.isInActivePath ?? false;

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: isActive ? "var(--copper)" : "var(--parchment)",
        strokeWidth: isActive ? 2.6 : 2,
      }}
    />
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { useT } from "@/lib/i18n/useT";
import { computeAutoLayout } from "@/lib/services/dagService";
import { NodeService } from "@/lib/services/nodeService";
import type { Node, NodePosition } from "@/types";

const nodeService = new NodeService();

const MAX_PREVIEW_NODES = 60;

interface PreviewGeometry {
  circles: Array<{ x: number; y: number; r: number; kind: "root" | "node" }>;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

const previewCache = new Map<string, { revision: number; geometry: PreviewGeometry }>();

async function loadPreviewNodes(rootId: string, limit = MAX_PREVIEW_NODES): Promise<Node[]> {
  const root = await nodeService.read(rootId);
  if (!root) return [];

  const nodes: Node[] = [root];
  const queue: string[] = [root.id];
  const seen = new Set<string>([root.id]);

  while (queue.length > 0 && nodes.length < limit) {
    const parentId = queue.shift();
    if (!parentId) continue;

    const children = await nodeService.getChildren(parentId);
    for (const child of children) {
      if (nodes.length >= limit) break;
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      nodes.push(child);
      queue.push(child.id);
    }
  }

  return nodes;
}

function computeBounds(positions: Map<string, NodePosition>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, maxX, minY, maxY };
}

function buildGeometry(nodes: Node[], rootId: string): PreviewGeometry {
  const positions = computeAutoLayout(nodes, rootId, { xSpacing: 160, ySpacing: 90 });
  const bounds = computeBounds(positions);
  if (!bounds) return { circles: [], lines: [] };

  const W = 200;
  const H = 120;
  const PAD = 14;

  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);

  const mapPoint = (pos: NodePosition) => ({
    x: PAD + ((pos.x - bounds.minX) / spanX) * (W - PAD * 2),
    y: PAD + ((pos.y - bounds.minY) / spanY) * (H - PAD * 2),
  });

  const ids = new Set(nodes.map((n) => n.id));
  const circles: PreviewGeometry["circles"] = [];
  const lines: PreviewGeometry["lines"] = [];

  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const pt = mapPoint(pos);
    circles.push({
      x: pt.x,
      y: pt.y,
      r: node.id === rootId ? 4 : 3,
      kind: node.id === rootId ? "root" : "node",
    });

    if (node.parentId && ids.has(node.parentId)) {
      const parentPos = positions.get(node.parentId);
      if (!parentPos) continue;
      const parentPt = mapPoint(parentPos);
      lines.push({ x1: parentPt.x, y1: parentPt.y, x2: pt.x, y2: pt.y });
    }
  }

  return { circles, lines };
}

export function ThreadCanvasPreview({
  treeId,
  rootId,
  revision,
  className = "",
}: {
  treeId: string;
  rootId: string;
  revision: number;
  className?: string;
}) {
  const t = useT();
  const cached = previewCache.get(treeId);
  const cachedGeometry = cached?.revision === revision ? cached.geometry : null;

  const [geometry, setGeometry] = useState<PreviewGeometry | null>(cachedGeometry);

  useEffect(() => {
    if (cachedGeometry) {
      setGeometry(cachedGeometry);
      return;
    }

    let cancelled = false;
    setGeometry(null);

    void (async () => {
      const nodes = await loadPreviewNodes(rootId);
      const next = buildGeometry(nodes, rootId);
      if (cancelled) return;
      previewCache.set(treeId, { revision, geometry: next });
      setGeometry(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [cachedGeometry, revision, rootId, treeId]);

  const svg = useMemo(() => {
    if (!geometry) return null;

    return (
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <g className="stroke-parchment/80" strokeWidth="1.25">
          {geometry.lines.map((line, index) => (
            <line
              key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </g>
        <g>
          {geometry.circles.map((circle, index) => (
            <circle
              key={`${circle.x}-${circle.y}-${index}`}
              cx={circle.x}
              cy={circle.y}
              r={circle.r}
              className={
                circle.kind === "root"
                  ? "fill-copper stroke-ink/10"
                  : "fill-ink/60 stroke-ink/10"
              }
            />
          ))}
        </g>
      </svg>
    );
  }, [geometry]);

  return (
    <div
      className={`relative h-[74px] w-[124px] overflow-hidden rounded-xl border border-parchment bg-cream/60 ${className}`}
      aria-label={t("folder.threadPreviewAria")}
    >
      {svg ?? <div className="h-full w-full animate-pulse bg-parchment/25" />}
    </div>
  );
}

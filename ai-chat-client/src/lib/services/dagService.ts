import type { Edge as FlowEdge, Node as FlowNode } from "reactflow";

import { NodeType, type Node as ConversationNode, type NodePosition } from "@/types";

export interface TreeFlowNodeData {
  node: ConversationNode;
  depth: number;
  isActive: boolean;
  isSelected: boolean;
  isInActivePath: boolean;
  onToggleCollapse?: (nodeId: string) => void;
}

export interface TreeFlowEdgeData {
  isInActivePath: boolean;
}

export type TreeFlowNode = FlowNode<TreeFlowNodeData>;
export type TreeFlowEdge = FlowEdge<TreeFlowEdgeData>;

export interface LayoutOptions {
  xSpacing?: number;
  ySpacing?: number;
}

const DEFAULT_LAYOUT: Required<LayoutOptions> = {
  xSpacing: 280,
  ySpacing: 140,
};

function filterCollapsedNodes(nodes: Iterable<ConversationNode>): ConversationNode[] {
  const all = Array.from(nodes);
  const byId = new Map(all.map((node) => [node.id, node] as const));
  const childrenByParent = new Map<string, ConversationNode[]>();

  for (const node of all) {
    if (!node.parentId) continue;
    const bucket = childrenByParent.get(node.parentId);
    if (bucket) bucket.push(node);
    else childrenByParent.set(node.parentId, [node]);
  }

  const hidden = new Set<string>();
  const hiddenParentToCompressed = new Map<string, string>();
  const compressedParentOverride = new Map<string, string | null>();

  for (const node of all) {
    if (node.type !== NodeType.COMPRESSED) continue;
    if (!node.metadata?.collapsed) continue;

    const ids = node.metadata.compressedNodeIds ?? [];
    if (ids.length === 0) continue;

    const chainSet = new Set(ids);
    for (const id of ids) {
      hidden.add(id);
      hiddenParentToCompressed.set(id, node.id);
    }
    const visited = new Set<string>();
    const stack = [...ids];
    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId) continue;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = childrenByParent.get(currentId) ?? [];
      for (const child of children) {
        if (child.id === node.id) continue;
        if (!hidden.has(child.id)) {
          hidden.add(child.id);
          hiddenParentToCompressed.set(child.id, node.id);
        }
        stack.push(child.id);
      }
    }

    const entryId = ids.find((id) => {
      const candidate = byId.get(id);
      if (!candidate) return false;
      return !candidate.parentId || !chainSet.has(candidate.parentId);
    });

    const entry = entryId ? byId.get(entryId) ?? null : null;
    compressedParentOverride.set(node.id, entry?.parentId ?? null);
  }

  return all
    .filter((node) => !hidden.has(node.id))
    .map((node) => {
      const originalParent = node.parentId ?? null;
      let parentId = originalParent;

      if (compressedParentOverride.has(node.id)) {
        parentId = compressedParentOverride.get(node.id) ?? null;
      } else if (parentId && hiddenParentToCompressed.has(parentId)) {
        parentId = hiddenParentToCompressed.get(parentId) ?? null;
      }

      if (parentId === originalParent) return node;
      return { ...node, parentId };
    });
}

function buildIndex(nodes: Iterable<ConversationNode>): {
  byId: Map<string, ConversationNode>;
  childrenByParent: Map<string, ConversationNode[]>;
} {
  const byId = new Map<string, ConversationNode>();
  for (const node of nodes) byId.set(node.id, node);

  const childrenByParent = new Map<string, ConversationNode[]>();
  for (const node of byId.values()) {
    if (!node.parentId) continue;
    const bucket = childrenByParent.get(node.parentId);
    if (bucket) bucket.push(node);
    else childrenByParent.set(node.parentId, [node]);
  }

  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => a.createdAt - b.createdAt);
  }

  return { byId, childrenByParent };
}

export function computePathIds(
  nodesById: Map<string, ConversationNode>,
  nodeId: string,
): string[] {
  const path: string[] = [];
  const seen = new Set<string>();

  let current = nodesById.get(nodeId) ?? null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.id);
    if (!current.parentId) break;
    current = nodesById.get(current.parentId) ?? null;
  }

  return path;
}

export function countLeafBranches(
  nodes: Iterable<ConversationNode>,
  rootId: string,
): number {
  const { byId, childrenByParent } = buildIndex(filterCollapsedNodes(nodes));
  if (!byId.has(rootId)) return 0;

  const seen = new Set<string>();

  const walk = (id: string): number => {
    if (seen.has(id)) return 0;
    seen.add(id);

    const children = childrenByParent.get(id) ?? [];
    if (children.length === 0) return 1;

    let total = 0;
    for (const child of children) total += walk(child.id);
    return total;
  };

  return walk(rootId);
}

export function getLeafNodes(
  nodes: Iterable<ConversationNode>,
  rootId: string,
): ConversationNode[] {
  const { byId, childrenByParent } = buildIndex(filterCollapsedNodes(nodes));
  if (!byId.has(rootId)) return [];

  const leaves: ConversationNode[] = [];
  for (const node of byId.values()) {
    const children = childrenByParent.get(node.id) ?? [];
    if (children.length === 0) leaves.push(node);
  }

  return leaves.sort((a, b) => a.createdAt - b.createdAt);
}

export function computeAutoLayout(
  nodes: Iterable<ConversationNode>,
  rootId: string,
  options?: LayoutOptions,
): Map<string, NodePosition> {
  const { byId, childrenByParent } = buildIndex(filterCollapsedNodes(nodes));
  if (!byId.has(rootId)) return new Map();

  const { xSpacing, ySpacing } = { ...DEFAULT_LAYOUT, ...options };
  const positions = new Map<string, NodePosition>();

  let cursor = 0;

  const place = (id: string, depth: number): number => {
    const node = byId.get(id);
    if (!node) return 0;

    const children = childrenByParent.get(id) ?? [];
    const x = depth * xSpacing;

    if (children.length === 0) {
      const y = cursor;
      cursor += ySpacing;
      positions.set(id, { x, y });
      return y;
    }

    const ys: number[] = [];
    for (const child of children) ys.push(place(child.id, depth + 1));

    const y =
      ys.length === 0 ? cursor : ys.reduce((sum, value) => sum + value, 0) / ys.length;
    positions.set(id, { x, y });
    return y;
  };

  place(rootId, 0);
  return positions;
}

export interface BuildFlowGraphParams {
  nodes: Iterable<ConversationNode>;
  rootId: string;
  activeNodeId?: string | null;
  selectedNodeIds?: string[];
  forceAutoLayout?: boolean;
  layout?: LayoutOptions;
  onToggleCollapse?: (nodeId: string) => void;
}

export function buildFlowGraph({
  nodes,
  rootId,
  activeNodeId,
  selectedNodeIds,
  forceAutoLayout = false,
  layout,
  onToggleCollapse,
}: BuildFlowGraphParams): {
  nodes: TreeFlowNode[];
  edges: TreeFlowEdge[];
  branchCount: number;
} {
  const visibleNodes = filterCollapsedNodes(nodes);
  const { byId, childrenByParent } = buildIndex(visibleNodes);
  const branchCount = countLeafBranches(visibleNodes, rootId);

  const pathIds = activeNodeId ? computePathIds(byId, activeNodeId) : [];
  const activePath = new Set(pathIds);
  const selected = new Set(selectedNodeIds ?? []);

  const autoPositions =
    forceAutoLayout || Array.from(byId.values()).some((n) => !n.position)
      ? computeAutoLayout(byId.values(), rootId, layout)
      : new Map<string, NodePosition>();

  const ordered: ConversationNode[] = [];
  const depthById = new Map<string, number>();
  const queue: string[] = [rootId];
  depthById.set(rootId, 0);
  const seen = new Set<string>();

  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const node = byId.get(id);
    if (!node) continue;
    ordered.push(node);

    const nextDepth = (depthById.get(id) ?? 0) + 1;
    const children = childrenByParent.get(id) ?? [];
    for (const child of children) {
      if (!depthById.has(child.id)) depthById.set(child.id, nextDepth);
      queue.push(child.id);
    }
  }

  const flowNodes: TreeFlowNode[] = ordered.map((node) => {
    const depth = depthById.get(node.id) ?? 0;
    const position =
      forceAutoLayout
        ? autoPositions.get(node.id) ?? { x: depth * DEFAULT_LAYOUT.xSpacing, y: 0 }
        : node.position ??
          autoPositions.get(node.id) ?? { x: depth * DEFAULT_LAYOUT.xSpacing, y: 0 };

    return {
      id: node.id,
      type: "treeNode",
      position,
      draggable: true,
      selectable: true,
      selected: selected.has(node.id),
      data: {
        node,
        depth,
        isActive: activeNodeId === node.id,
        isSelected: selected.has(node.id),
        isInActivePath: activePath.has(node.id),
        onToggleCollapse,
      },
    };
  });

  const flowEdges: TreeFlowEdge[] = [];
  for (const node of ordered) {
    if (!node.parentId) continue;
    if (!byId.has(node.parentId)) continue;

    flowEdges.push({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId,
      target: node.id,
      type: "treeEdge",
      data: { isInActivePath: activePath.has(node.id) },
    });
  }

  return { nodes: flowNodes, edges: flowEdges, branchCount };
}

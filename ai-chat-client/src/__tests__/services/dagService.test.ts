import { describe, expect, it } from "vitest";

import {
  buildFlowGraph,
  computeAutoLayout,
  computePathIds,
  countLeafBranches,
} from "@/lib/services/dagService";
import { NodeType, type Node } from "@/types";

function n(partial: Partial<Node> & Pick<Node, "id">): Node {
  return {
    id: partial.id,
    type: partial.type ?? NodeType.USER,
    createdAt: partial.createdAt ?? 0,
    updatedAt: partial.updatedAt ?? partial.createdAt ?? 0,
    parentId: partial.parentId ?? null,
    content: partial.content ?? "",
    summary: partial.summary,
    metadata: partial.metadata ?? { tags: [], metaInstructions: {} },
    tokenCount: partial.tokenCount ?? 1,
    position: partial.position,
    style: partial.style,
  };
}

describe("dagService", () => {
  it("computes leaf branch count", () => {
    const root = n({ id: "root", type: NodeType.SYSTEM });
    const u1 = n({ id: "u1", parentId: root.id, createdAt: 1 });
    const a1 = n({ id: "a1", parentId: u1.id, type: NodeType.ASSISTANT, createdAt: 2 });
    const u2 = n({ id: "u2", parentId: a1.id, createdAt: 3 });
    const a2 = n({ id: "a2", parentId: u2.id, type: NodeType.ASSISTANT, createdAt: 4 });
    const u2b = n({ id: "u2b", parentId: a1.id, createdAt: 5 });
    const a2b = n({ id: "a2b", parentId: u2b.id, type: NodeType.ASSISTANT, createdAt: 6 });

    expect(countLeafBranches([root, u1, a1, u2, a2, u2b, a2b], root.id)).toBe(2);
  });

  it("computes a stable path from root to node id", () => {
    const root = n({ id: "root", type: NodeType.SYSTEM });
    const u1 = n({ id: "u1", parentId: root.id });
    const a1 = n({ id: "a1", parentId: u1.id, type: NodeType.ASSISTANT });

    const byId = new Map(
      [root, u1, a1].map((node) => [node.id, node] as const),
    );

    expect(computePathIds(byId, a1.id)).toEqual([root.id, u1.id, a1.id]);
  });

  it("assigns auto layout positions with increasing x by depth", () => {
    const root = n({ id: "root", type: NodeType.SYSTEM });
    const u1 = n({ id: "u1", parentId: root.id });
    const a1 = n({ id: "a1", parentId: u1.id, type: NodeType.ASSISTANT });

    const pos = computeAutoLayout([root, u1, a1], root.id, { xSpacing: 100, ySpacing: 50 });

    expect(pos.get(root.id)?.x).toBe(0);
    expect(pos.get(u1.id)?.x).toBe(100);
    expect(pos.get(a1.id)?.x).toBe(200);
  });

  it("builds flow graph with path highlighting and preserved manual positions", () => {
    const root = n({ id: "root", type: NodeType.SYSTEM, position: { x: 10, y: 20 } });
    const u1 = n({ id: "u1", parentId: root.id, createdAt: 1 });
    const a1 = n({ id: "a1", parentId: u1.id, type: NodeType.ASSISTANT, createdAt: 2 });
    const u2 = n({ id: "u2", parentId: a1.id, createdAt: 3 });
    const a2 = n({ id: "a2", parentId: u2.id, type: NodeType.ASSISTANT, createdAt: 4 });
    const u2b = n({ id: "u2b", parentId: a1.id, createdAt: 5 });
    const a2b = n({ id: "a2b", parentId: u2b.id, type: NodeType.ASSISTANT, createdAt: 6 });

    const result = buildFlowGraph({
      nodes: [root, u1, a1, u2, a2, u2b, a2b],
      rootId: root.id,
      activeNodeId: a2b.id,
      selectedNodeIds: [u2.id],
    });

    const rootFlow = result.nodes.find((node) => node.id === root.id);
    expect(rootFlow?.position).toEqual({ x: 10, y: 20 });

    const activeFlow = result.nodes.find((node) => node.id === a2b.id);
    expect(activeFlow?.data.isActive).toBe(true);
    expect(activeFlow?.data.isInActivePath).toBe(true);

    const selectedFlow = result.nodes.find((node) => node.id === u2.id);
    expect(selectedFlow?.data.isSelected).toBe(true);

    const activeEdge = result.edges.find((e) => e.target === a2b.id);
    expect(activeEdge?.data?.isInActivePath).toBe(true);
  });
});


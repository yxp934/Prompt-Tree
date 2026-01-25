import type { StateCreator } from "zustand";

import { computePathIds } from "@/lib/services/dagService";
import { NodeType, type ContextBox, type Node } from "@/types";

import type { AppStoreDeps, AppStoreState } from "./useStore";

function computeTotalTokens(nodeIds: string[], nodes: Map<string, Node>): number {
  let total = 0;
  for (const id of nodeIds) {
    total += nodes.get(id)?.tokenCount ?? 0;
  }
  return total;
}

export interface ContextSlice {
  contextBox: ContextBox | null;

  getContextBox: () => ContextBox | null;
  addToContext: (nodeId: string) => Promise<void>;
  removeFromContext: (nodeId: string) => void;
  clearContext: () => void;
  reorderContext: (nodeIds: string[]) => void;
  syncContextToNode: (nodeId: string) => Promise<void>;
  buildContextContent: () => Promise<string>;
}

export function createContextSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], ContextSlice> {
  return (set, get) => ({
    contextBox: null,

    getContextBox: () => get().contextBox,

    addToContext: async (nodeId) => {
      const box = get().contextBox;
      if (!box) return;
      if (box.nodeIds.includes(nodeId)) return;

      const existingNodes = get().nodes;
      const node =
        existingNodes.get(nodeId) ?? (await deps.nodeService.read(nodeId));
      if (!node) return;

      const nodesMap = existingNodes.has(nodeId)
        ? existingNodes
        : new Map(existingNodes).set(nodeId, node);
      if (nodesMap !== existingNodes) {
        set({ nodes: nodesMap });
      }

      const nodeIds = [...box.nodeIds, nodeId];
      const totalTokens = computeTotalTokens(nodeIds, nodesMap);

      const next: ContextBox = { ...box, nodeIds, totalTokens };
      set({ contextBox: next });
      await deps.contextBoxService.put(next);
    },

    removeFromContext: (nodeId) => {
      const box = get().contextBox;
      if (!box) return;

      const nodeIds = box.nodeIds.filter((id) => id !== nodeId);
      const totalTokens = computeTotalTokens(nodeIds, get().nodes);
      const next: ContextBox = { ...box, nodeIds, totalTokens };

      set({ contextBox: next });
      void deps.contextBoxService.put(next);
    },

    clearContext: () => {
      const box = get().contextBox;
      if (!box) return;

      const next: ContextBox = { ...box, nodeIds: [], totalTokens: 0 };
      set({ contextBox: next });
      void deps.contextBoxService.put(next);
    },

    reorderContext: (nodeIds) => {
      const box = get().contextBox;
      if (!box) return;

      const unique = Array.from(new Set(nodeIds));
      const totalTokens = computeTotalTokens(unique, get().nodes);
      const next: ContextBox = { ...box, nodeIds: unique, totalTokens };

      set({ contextBox: next });
      void deps.contextBoxService.put(next);
    },
    syncContextToNode: async (nodeId) => {
      const box = get().contextBox;
      if (!box) return;

      const nodes = get().nodes;
      if (!nodes.has(nodeId)) return;

      const pathIds = computePathIds(nodes, nodeId);
      if (pathIds.length === 0) return;

      const pathSet = new Set(pathIds);
      const hidden = new Set<string>();
      for (const id of pathIds) {
        const node = nodes.get(id);
        if (!node) continue;
        if (node.type !== NodeType.COMPRESSED) continue;
        if (!node.metadata.collapsed) continue;
        const compressedIds = node.metadata.compressedNodeIds ?? [];
        for (const compressedId of compressedIds) {
          if (pathSet.has(compressedId)) hidden.add(compressedId);
        }
      }

      const filteredPathIds = pathIds.filter((id) => !hidden.has(id));

      const unique: string[] = [];
      const seen = new Set<string>();
      for (const id of filteredPathIds) {
        if (!id || seen.has(id)) continue;
        if (!nodes.has(id)) continue;
        seen.add(id);
        unique.push(id);
      }

      const same =
        unique.length === box.nodeIds.length &&
        unique.every((id, index) => id === box.nodeIds[index]);
      if (same) return;

      const totalTokens = computeTotalTokens(unique, nodes);
      const next: ContextBox = { ...box, nodeIds: unique, totalTokens };
      set({ contextBox: next });
      await deps.contextBoxService.put(next);
    },

    buildContextContent: async () => {
      const box = get().contextBox;
      if (!box) return "";

      const chunks: string[] = [];
      for (const id of box.nodeIds) {
        const node = get().nodes.get(id);
        if (!node) continue;

        if (node.type === NodeType.COMPRESSED) {
          chunks.push(`[Compressed Context: ${node.summary ?? ""}]`);
          continue;
        }

        const role =
          node.type === NodeType.USER
            ? "User"
            : node.type === NodeType.ASSISTANT
              ? "Assistant"
              : "System";

        chunks.push(`${role}: ${node.content}`);
      }

      return chunks.join("\n\n");
    },
  });
}

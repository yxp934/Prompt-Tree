import type { StateCreator } from "zustand";

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

      const node = get().nodes.get(nodeId) ?? (await deps.nodeService.read(nodeId));
      if (!node) return;

      const nodeIds = [...box.nodeIds, nodeId];
      const totalTokens = computeTotalTokens(nodeIds, get().nodes);

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


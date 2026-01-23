import type { StateCreator } from "zustand";

import type { ContextBox, ConversationTree, Node } from "@/types";

import type { AppStoreDeps, AppStoreState } from "./useStore";

const DEFAULT_MAX_TOKENS = 8192;

function computeLatestNodeId(nodes: Node[], fallback: string): string {
  let latest = fallback;
  let latestTs = -Infinity;
  for (const node of nodes) {
    if (node.createdAt > latestTs) {
      latest = node.id;
      latestTs = node.createdAt;
    }
  }
  return latest;
}

export interface TreeSlice {
  trees: Map<string, ConversationTree>;
  currentTreeId: string | null;

  getCurrentTree: () => ConversationTree | null;

  createTree: (title?: string) => Promise<string>;
  loadTree: (id: string) => Promise<void>;
  deleteTree: (id: string) => Promise<void>;
  updateTreeTitle: (id: string, title: string) => Promise<void>;
}

export function createTreeSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], TreeSlice> {
  return (set, get) => ({
    trees: new Map(),
    currentTreeId: null,

    getCurrentTree: () => {
      const id = get().currentTreeId;
      if (!id) return null;
      return get().trees.get(id) ?? null;
    },

    createTree: async (title) => {
      set({ isLoading: true, error: null });
      try {
        const tree = await deps.treeService.create(title);

        set((state) => {
          const trees = new Map(state.trees);
          trees.set(tree.id, tree);
          return { trees };
        });

        await get().loadTree(tree.id);
        return tree.id;
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to create tree",
        });
        throw err;
      } finally {
        set({ isLoading: false });
      }
    },

    loadTree: async (id) => {
      set({ isLoading: true, error: null });
      try {
        const { tree, nodes } = await deps.treeService.loadTreeNodes(id);

        const nodesMap = new Map<string, Node>();
        for (const node of nodes) nodesMap.set(node.id, node);

        const activeNodeId = computeLatestNodeId(nodes, tree.rootId);

        set((state) => {
          const trees = new Map(state.trees);
          trees.set(tree.id, tree);

          return {
            trees,
            currentTreeId: tree.id,
            nodes: nodesMap,
            activeNodeId,
            selectedNodeIds: [],
          };
        });

        let contextBox = await deps.contextBoxService.read(tree.id);
        if (!contextBox) {
          const root = nodesMap.get(tree.rootId);
          const createdAt = Date.now();
          const fallback: ContextBox = {
            id: tree.id,
            nodeIds: root ? [root.id] : [],
            totalTokens: root?.tokenCount ?? 0,
            maxTokens: DEFAULT_MAX_TOKENS,
            createdAt,
          };
          contextBox = await deps.contextBoxService.put(fallback);
        }

        set({ contextBox });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to load tree",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    deleteTree: async (id) => {
      set({ isLoading: true, error: null });
      try {
        await deps.treeService.delete(id);

        const nextTrees = new Map(get().trees);
        nextTrees.delete(id);
        set({ trees: nextTrees });

        if (get().currentTreeId !== id) return;

        const nextId = nextTrees.keys().next().value as string | undefined;
        if (nextId) {
          await get().loadTree(nextId);
          return;
        }

        const tree = await deps.treeService.create();
        const trees = new Map(nextTrees);
        trees.set(tree.id, tree);
        set({ trees });
        await get().loadTree(tree.id);
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to delete tree",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    updateTreeTitle: async (id, title) => {
      set({ isLoading: true, error: null });
      try {
        const tree = await deps.treeService.updateTitle(id, title);
        set((state) => {
          const trees = new Map(state.trees);
          trees.set(tree.id, tree);
          return { trees };
        });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to update title",
        });
      } finally {
        set({ isLoading: false });
      }
    },
  });
}


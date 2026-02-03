import type { StateCreator } from "zustand";

import type { Node } from "@/types";

import type { AppStoreDeps, AppStoreState } from "./useStore";

export interface NodeSlice {
  nodes: Map<string, Node>;
  activeNodeId: string | null;
  selectedNodeIds: string[];

  getNodes: () => Map<string, Node>;
  getNode: (id: string) => Node | undefined;
  getActiveNode: () => Node | null;
  getSelectedNodes: () => Node[];

  createNode: (
    data: Partial<Omit<Node, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<Node>;
  updateNode: (id: string, updates: Partial<Node>) => Promise<Node>;
  deleteNode: (id: string) => Promise<void>;

  setActiveNode: (id: string) => void;
  toggleNodeSelection: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  clearSelection: () => void;

  getNodePath: (nodeId: string) => Promise<Node[]>;
  getChildren: (nodeId: string) => Promise<Node[]>;
}

function areSameIdSet(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;

  const setA = new Set(a);
  if (setA.size !== a.length) return false;
  for (const id of b) {
    if (!setA.has(id)) return false;
  }
  return true;
}

export function createNodeSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], NodeSlice> {
  return (set, get) => ({
    nodes: new Map(),
    activeNodeId: null,
    selectedNodeIds: [],

    getNodes: () => get().nodes,
    getNode: (id: string) => get().nodes.get(id),
    getActiveNode: () => {
      const id = get().activeNodeId;
      if (!id) return null;
      return get().nodes.get(id) ?? null;
    },
    getSelectedNodes: () =>
      get()
        .selectedNodeIds.map((id) => get().nodes.get(id))
        .filter((n): n is Node => Boolean(n)),

    createNode: async (data) => {
      const node = await deps.nodeService.create(data as Partial<Node>);

      set((state) => {
        const nodes = new Map(state.nodes);
        nodes.set(node.id, node);
        return { nodes };
      });

      return node;
    },
    updateNode: async (id, updates) => {
      const existing = get().nodes.get(id);
      if (existing) {
        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(id, { ...existing, ...updates, id });
          return { nodes };
        });
      }

      const node = await deps.nodeService.update(id, updates);

      set((state) => {
        const nodes = new Map(state.nodes);
        nodes.set(node.id, node);
        return { nodes };
      });

      return node;
    },
    deleteNode: async (id) => {
      await deps.nodeService.delete(id);

      const currentTreeId = get().currentTreeId;
      if (currentTreeId) {
        await get().loadTree(currentTreeId);
        return;
      }

      set((state) => {
        const nodes = new Map(state.nodes);
        nodes.delete(id);
        return { nodes };
      });
    },

    setActiveNode: (id) => {
      set({ activeNodeId: id });
      void get().syncContextToNode(id);
      get().syncToolsToNode(id);
    },
    toggleNodeSelection: (id) =>
      set((state) => {
        const selectedNodeIds = state.selectedNodeIds.includes(id)
          ? state.selectedNodeIds.filter((x) => x !== id)
          : [...state.selectedNodeIds, id];
        return { selectedNodeIds };
      }),
    setSelectedNodeIds: (ids) =>
      set((state) => {
        if (areSameIdSet(state.selectedNodeIds, ids)) return state;
        return { selectedNodeIds: ids };
      }),
    clearSelection: () =>
      set((state) => {
        if (state.selectedNodeIds.length === 0) return state;
        return { selectedNodeIds: [] };
      }),

    getNodePath: (nodeId) => deps.nodeService.getPath(nodeId),
    getChildren: (nodeId) => deps.nodeService.getChildren(nodeId),
  });
}

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
  clearSelection: () => void;

  getNodePath: (nodeId: string) => Promise<Node[]>;
  getChildren: (nodeId: string) => Promise<Node[]>;
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

    setActiveNode: (id) => set({ activeNodeId: id }),
    toggleNodeSelection: (id) =>
      set((state) => {
        const selectedNodeIds = state.selectedNodeIds.includes(id)
          ? state.selectedNodeIds.filter((x) => x !== id)
          : [...state.selectedNodeIds, id];
        return { selectedNodeIds };
      }),
    clearSelection: () => set({ selectedNodeIds: [] }),

    getNodePath: (nodeId) => deps.nodeService.getPath(nodeId),
    getChildren: (nodeId) => deps.nodeService.getChildren(nodeId),
  });
}


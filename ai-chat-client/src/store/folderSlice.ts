import type { StateCreator } from "zustand";

import type { ConversationFolder } from "@/types";
import type { ProviderModelSelection } from "@/types/provider";

import type { AppStoreDeps, AppStoreState } from "./useStore";

export type HomeView = "tree" | "folder";

export interface FolderSlice {
  folders: Map<string, ConversationFolder>;
  currentFolderId: string | null;
  currentView: HomeView;

  getCurrentFolder: () => ConversationFolder | null;

  createFolder: (name?: string) => Promise<string>;
  loadFolder: (id: string) => void;
  updateFolderName: (id: string, name: string) => Promise<void>;
  updateFolderSystemPrompt: (id: string, systemPrompt: string) => Promise<void>;
  updateFolderEnabledModels: (id: string, enabledModels: ProviderModelSelection[] | null) => Promise<void>;
  updateFolderMemoryRag: (id: string, memoryRag: ConversationFolder["memoryRag"]) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

export function createFolderSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], FolderSlice> {
  return (set, get) => ({
    folders: new Map(),
    currentFolderId: null,
    currentView: "tree",

    getCurrentFolder: () => {
      const id = get().currentFolderId;
      if (!id) return null;
      return get().folders.get(id) ?? null;
    },

    createFolder: async (name) => {
      set({ isLoading: true, error: null });
      try {
        const folder = await deps.folderService.create(name);

        set((state) => {
          const folders = new Map(state.folders);
          folders.set(folder.id, folder);
          return {
            folders,
            currentView: "folder",
            currentFolderId: folder.id,
            // Clear thread state so center/right panes don't show stale data.
            currentTreeId: null,
            nodes: new Map(),
            activeNodeId: null,
            selectedNodeIds: [],
            contextBox: null,
          };
        });

        return folder.id;
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to create folder",
        });
        throw err;
      } finally {
        set({ isLoading: false });
      }
    },

    loadFolder: (id) => {
      set({
        currentView: "folder",
        currentFolderId: id,
        currentTreeId: null,
        nodes: new Map(),
        activeNodeId: null,
        selectedNodeIds: [],
        contextBox: null,
      });
    },

    updateFolderName: async (id, name) => {
      set({ isLoading: true, error: null });
      try {
        const folder = await deps.folderService.updateName(id, name);
        set((state) => {
          const folders = new Map(state.folders);
          folders.set(folder.id, folder);
          return { folders };
        });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to update folder name",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    updateFolderSystemPrompt: async (id, systemPrompt) => {
      set({ isLoading: true, error: null });
      try {
        const folder = await deps.folderService.updateSystemPrompt(id, systemPrompt);
        set((state) => {
          const folders = new Map(state.folders);
          folders.set(folder.id, folder);
          return { folders };
        });

        // Apply to all threads in the folder: root node content becomes the unified system prompt.
        const treesInFolder = Array.from(get().trees.values()).filter(
          (tree) => (tree.folderId ?? null) === id,
        );

        const touchedTrees = await Promise.all(
          treesInFolder.map(async (tree) => {
            await deps.treeService.updateRootSystemPrompt(tree.id, folder.systemPrompt);
            return deps.treeService.touch(tree.id);
          }),
        );

        if (touchedTrees.length > 0) {
          set((state) => {
            const trees = new Map(state.trees);
            for (const tree of touchedTrees) trees.set(tree.id, tree);
            return { trees };
          });
        }
      } catch (err) {
        set({
          error:
            err instanceof Error ? err.message : "Failed to update folder system prompt",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    updateFolderEnabledModels: async (id, enabledModels) => {
      set({ isLoading: true, error: null });
      try {
        const folder = await deps.folderService.updateEnabledModels(id, enabledModels);
        set((state) => {
          const folders = new Map(state.folders);
          folders.set(folder.id, folder);
          return { folders };
        });
      } catch (err) {
        set({
          error:
            err instanceof Error ? err.message : "Failed to update folder enabled models",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    updateFolderMemoryRag: async (id, memoryRag) => {
      set({ isLoading: true, error: null });
      try {
        const folder = await deps.folderService.updateMemoryRag(id, memoryRag);
        set((state) => {
          const folders = new Map(state.folders);
          folders.set(folder.id, folder);
          return { folders };
        });
      } catch (err) {
        set({
          error:
            err instanceof Error ? err.message : "Failed to update folder memory RAG settings",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    deleteFolder: async (id) => {
      set({ isLoading: true, error: null });
      try {
        const treesInFolder = Array.from(get().trees.values()).filter(
          (tree) => (tree.folderId ?? null) === id,
        );
        const movedTrees = await Promise.all(
          treesInFolder.map((tree) => deps.treeService.updateFolderId(tree.id, null)),
        );

        await deps.folderService.delete(id);

        set((state) => {
          const folders = new Map(state.folders);
          folders.delete(id);
          const isActive = state.currentFolderId === id;

          const trees = new Map(state.trees);
          for (const tree of movedTrees) trees.set(tree.id, tree);

          return {
            folders,
            trees,
            currentFolderId: isActive ? null : state.currentFolderId,
            currentView: isActive ? "tree" : state.currentView,
          };
        });

        const shouldLoadThread = get().currentView === "tree" && get().currentTreeId == null;
        if (shouldLoadThread) {
          const fallback = Array.from(get().trees.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt,
          )[0];
          if (fallback) await get().loadTree(fallback.id);
        }
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to delete folder",
        });
      } finally {
        set({ isLoading: false });
      }
    },
  });
}

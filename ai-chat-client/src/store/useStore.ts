"use client";

import { useStore as useZustandStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import { ContextBoxService } from "@/lib/services/contextBoxService";
import { LLMService, type ILLMService } from "@/lib/services/llmService";
import { NodeService } from "@/lib/services/nodeService";
import { TreeService } from "@/lib/services/treeService";

import { createContextSlice, type ContextSlice } from "./contextSlice";
import { createLLMSlice, type LLMSlice } from "./llmSlice";
import { createNodeSlice, type NodeSlice } from "./nodeSlice";
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { createUISlice, type UISlice } from "./uiSlice";

export interface AppStoreDeps {
  nodeService: NodeService;
  treeService: TreeService;
  contextBoxService: ContextBoxService;
  llmService: ILLMService;
}

export interface BaseSlice {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
}

export type AppStoreState = BaseSlice &
  NodeSlice &
  TreeSlice &
  ContextSlice &
  UISlice &
  LLMSlice;

export function createAppStore(
  deps?: Partial<AppStoreDeps>,
): StoreApi<AppStoreState> {
  const services: AppStoreDeps = {
    nodeService: deps?.nodeService ?? new NodeService(),
    treeService: deps?.treeService ?? new TreeService(),
    contextBoxService: deps?.contextBoxService ?? new ContextBoxService(),
    llmService: deps?.llmService ?? new LLMService(),
  };

  return createStore<AppStoreState>()((set, get, ...api) => ({
    initialized: false,
    isLoading: false,
    error: null,
    initialize: async () => {
      if (get().initialized) return;

      set({ isLoading: true, error: null });
      try {
        let trees = await services.treeService.list();
        if (trees.length === 0) {
          const tree = await services.treeService.create();
          trees = [tree];
        }

        set({
          trees: new Map(trees.map((t) => [t.id, t])),
        });

        await get().loadTree(trees[0].id);
        set({ initialized: true });
      } catch (err) {
        set({
          error:
            err instanceof Error ? err.message : "Failed to initialize store",
        });
      } finally {
        set({ isLoading: false });
      }
    },

    ...createNodeSlice(services)(set, get, ...api),
    ...createTreeSlice(services)(set, get, ...api),
    ...createContextSlice(services)(set, get, ...api),
    ...createUISlice()(set, get, ...api),
    ...createLLMSlice(services)(set, get, ...api),
  }));
}

export const appStore = createAppStore();

export function useAppStore(): AppStoreState;
export function useAppStore<T>(selector: (state: AppStoreState) => T): T;
export function useAppStore<T>(selector?: (state: AppStoreState) => T): T {
  return useZustandStore(appStore, selector!);
}

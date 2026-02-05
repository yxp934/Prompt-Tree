"use client";

import { useStore as useZustandStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import { CompressionService } from "@/lib/services/compressionService";
import { ContextBoxService } from "@/lib/services/contextBoxService";
import { FolderService } from "@/lib/services/folderService";
import { FolderDocService } from "@/lib/services/folderDocService";
import { AgentService, type IAgentService } from "@/lib/services/agentService";
import { EmbeddingService } from "@/lib/services/embeddingService";
import { LLMService, type ILLMService } from "@/lib/services/llmService";
import { MemoryBankService } from "@/lib/services/memoryBankService";
import { NodeService } from "@/lib/services/nodeService";
import { TreeService } from "@/lib/services/treeService";
import { UserProfileService } from "@/lib/services/userProfileService";

import { createContextSlice, type ContextSlice } from "./contextSlice";
import { createFolderSlice, type FolderSlice } from "./folderSlice";
import { createLLMSlice, type LLMSlice } from "./llmSlice";
import { createNodeSlice, type NodeSlice } from "./nodeSlice";
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { createUISlice, type UISlice } from "./uiSlice";
import { createProviderSlice, type ProviderSlice } from "./providerSlice";
import { createToolSlice, type ToolSlice } from "./toolSlice";
import { createLongTermMemorySlice, type LongTermMemorySlice } from "./longTermMemorySlice";

export interface AppStoreDeps {
  nodeService: NodeService;
  treeService: TreeService;
  folderService: FolderService;
  folderDocService: FolderDocService;
  userProfileService: UserProfileService;
  memoryBankService: MemoryBankService;
  embeddingService: EmbeddingService;
  contextBoxService: ContextBoxService;
  llmService: ILLMService;
  agentService: IAgentService;
  compressionService: CompressionService;
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
  FolderSlice &
  ContextSlice &
  UISlice &
  LLMSlice &
  ProviderSlice &
  ToolSlice &
  LongTermMemorySlice;

export function createAppStore(
  deps?: Partial<AppStoreDeps>,
): StoreApi<AppStoreState> {
  const services: AppStoreDeps = {
    nodeService: deps?.nodeService ?? new NodeService(),
    treeService: deps?.treeService ?? new TreeService(),
    folderService: deps?.folderService ?? new FolderService(),
    folderDocService: deps?.folderDocService ?? new FolderDocService(),
    userProfileService: deps?.userProfileService ?? new UserProfileService(),
    memoryBankService: deps?.memoryBankService ?? new MemoryBankService(),
    embeddingService: deps?.embeddingService ?? new EmbeddingService(),
    contextBoxService: deps?.contextBoxService ?? new ContextBoxService(),
    llmService: deps?.llmService ?? new LLMService(),
    agentService: deps?.agentService ?? new AgentService(),
    compressionService: deps?.compressionService ?? new CompressionService(),
  };

  return createStore<AppStoreState>()((set, get, ...api) => ({
    initialized: false,
    isLoading: false,
    error: null,
    initialize: async () => {
      if (get().initialized) return;

      set({ isLoading: true, error: null });
      try {
        const [folders, initialTrees] = await Promise.all([
          services.folderService.list(),
          services.treeService.list(),
        ]);
        let trees = initialTrees;
        if (trees.length === 0) {
          const tree = await services.treeService.create();
          trees = [tree];
        }

        set({
          trees: new Map(trees.map((t) => [t.id, t])),
          folders: new Map(folders.map((f) => [f.id, f])),
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
    ...createFolderSlice(services)(set, get, ...api),
    ...createContextSlice(services)(set, get, ...api),
    ...createUISlice()(set, get, ...api),
    ...createLLMSlice(services)(set, get, ...api),
    ...createProviderSlice(services)(set, get, ...api),
    ...createToolSlice()(set, get, ...api),
    ...createLongTermMemorySlice()(set, get, ...api),
  }));
}

export const appStore = createAppStore();

export function useAppStore(): AppStoreState;
export function useAppStore<T>(selector: (state: AppStoreState) => T): T;
export function useAppStore<T>(selector?: (state: AppStoreState) => T): T {
  return useZustandStore(appStore, selector!);
}

import type { StateCreator } from "zustand";

import type { Node } from "@/types";

import type { AppStoreDeps, AppStoreState } from "./useStore";

export interface LLMSlice {
  sendMessage: (content: string, contextNodeIds?: string[]) => Promise<Node>;
  compressNodes: (nodeIds: string[]) => Promise<Node>;
  generateSummary: (content: string) => Promise<string>;
}

export function createLLMSlice(
  _deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], LLMSlice> {
  return () => ({
    sendMessage: async () => {
      throw new Error("sendMessage() is not implemented yet.");
    },
    compressNodes: async () => {
      throw new Error("compressNodes() is not implemented yet.");
    },
    generateSummary: async () => {
      throw new Error("generateSummary() is not implemented yet.");
    },
  });
}


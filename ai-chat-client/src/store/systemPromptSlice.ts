import type { StateCreator } from "zustand";

import {
  DEFAULT_THREAD_SYSTEM_PROMPT_V1,
  clearStoredDefaultThreadSystemPrompt,
  getStoredDefaultThreadSystemPrompt,
  normalizeThreadSystemPrompt,
  setStoredDefaultThreadSystemPrompt,
} from "@/lib/services/defaultThreadSystemPromptService";

import type { AppStoreState } from "./useStore";

export interface SystemPromptSlice {
  defaultThreadSystemPrompt: string;
  hydrateDefaultThreadSystemPromptFromStorage: () => void;
  setDefaultThreadSystemPrompt: (prompt: string) => void;
  resetDefaultThreadSystemPrompt: () => void;
}

export function createSystemPromptSlice(): StateCreator<
  AppStoreState,
  [],
  [],
  SystemPromptSlice
> {
  return (set) => ({
    defaultThreadSystemPrompt: DEFAULT_THREAD_SYSTEM_PROMPT_V1,

    hydrateDefaultThreadSystemPromptFromStorage: () =>
      set((state) => {
        const stored = getStoredDefaultThreadSystemPrompt();
        return { defaultThreadSystemPrompt: stored ?? state.defaultThreadSystemPrompt };
      }),

    setDefaultThreadSystemPrompt: (prompt) =>
      set((state) => {
        const next = normalizeThreadSystemPrompt(prompt, state.defaultThreadSystemPrompt);
        setStoredDefaultThreadSystemPrompt(next);
        return { defaultThreadSystemPrompt: next };
      }),

    resetDefaultThreadSystemPrompt: () =>
      set(() => {
        clearStoredDefaultThreadSystemPrompt();
        return { defaultThreadSystemPrompt: DEFAULT_THREAD_SYSTEM_PROMPT_V1 };
      }),
  });
}


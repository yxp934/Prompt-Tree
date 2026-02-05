import type { StateCreator } from "zustand";

import {
  DEFAULT_LONG_TERM_MEMORY_SETTINGS,
  getStoredLongTermMemorySettings,
  normalizeLongTermMemorySettings,
  setStoredLongTermMemorySettings,
} from "@/lib/services/longTermMemorySettingsService";
import type { LongTermMemorySettings } from "@/types";

import type { AppStoreState } from "./useStore";

export interface LongTermMemorySlice {
  longTermMemorySettings: LongTermMemorySettings;
  hydrateLongTermMemorySettingsFromStorage: () => void;
  setLongTermMemorySettings: (updates: Partial<LongTermMemorySettings>) => void;
}

export function createLongTermMemorySlice(): StateCreator<
  AppStoreState,
  [],
  [],
  LongTermMemorySlice
> {
  return (set, get) => ({
    longTermMemorySettings: DEFAULT_LONG_TERM_MEMORY_SETTINGS,

    hydrateLongTermMemorySettingsFromStorage: () => {
      const stored = getStoredLongTermMemorySettings();
      if (!stored) return;
      set({ longTermMemorySettings: stored });

      const memoryToolAllowed = stored.enabled && stored.enableMemorySearchTool;
      if (!memoryToolAllowed) {
        const next = (get().draftToolUses ?? []).filter((id) => id !== "search_memory");
        if (next.length !== (get().draftToolUses ?? []).length) {
          get().setDraftToolUses(next);
        }
      }
    },

    setLongTermMemorySettings: (updates) => {
      set((state) => {
        const next = normalizeLongTermMemorySettings(
          { ...state.longTermMemorySettings, ...updates },
          DEFAULT_LONG_TERM_MEMORY_SETTINGS,
        );
        setStoredLongTermMemorySettings(next);
        return { longTermMemorySettings: next };
      });

      const nextSettings = normalizeLongTermMemorySettings(
        { ...get().longTermMemorySettings, ...updates },
        DEFAULT_LONG_TERM_MEMORY_SETTINGS,
      );
      const memoryToolAllowed = nextSettings.enabled && nextSettings.enableMemorySearchTool;
      if (!memoryToolAllowed) {
        const current = get().draftToolUses ?? [];
        if (current.includes("search_memory")) {
          get().setDraftToolUses(current.filter((id) => id !== "search_memory"));
        }
      }
    },
  });
}

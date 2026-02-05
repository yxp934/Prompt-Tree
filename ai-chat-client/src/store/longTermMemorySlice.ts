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
  return (set) => ({
    longTermMemorySettings: DEFAULT_LONG_TERM_MEMORY_SETTINGS,

    hydrateLongTermMemorySettingsFromStorage: () => {
      const stored = getStoredLongTermMemorySettings();
      if (!stored) return;
      set({ longTermMemorySettings: stored });
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
    },
  });
}

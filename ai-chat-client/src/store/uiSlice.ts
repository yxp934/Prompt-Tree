import type { StateCreator } from "zustand";

import { getStoredTheme, setStoredTheme, type ThemeMode } from "@/lib/services/themeService";

import type { AppStoreState } from "./useStore";

export interface UISlice {
  sidebarOpen: boolean;
  theme: ThemeMode;
  compressionOpen: boolean;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  openCompression: () => void;
  closeCompression: () => void;
}

export function createUISlice(): StateCreator<AppStoreState, [], [], UISlice> {
  return (set) => ({
    sidebarOpen: true,
    theme: getStoredTheme() ?? "light",
    compressionOpen: false,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleTheme: () =>
      set((state) => {
        const nextTheme: ThemeMode = state.theme === "light" ? "dark" : "light";
        setStoredTheme(nextTheme);
        return { theme: nextTheme };
      }),
    openCompression: () => set({ compressionOpen: true }),
    closeCompression: () => set({ compressionOpen: false }),
  });
}

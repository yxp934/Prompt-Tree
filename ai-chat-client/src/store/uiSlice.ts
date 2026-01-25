import type { StateCreator } from "zustand";

import { getStoredTheme, setStoredTheme, type ThemeMode } from "@/lib/services/themeService";

import type { AppStoreState } from "./useStore";

export interface UISlice {
  sidebarOpen: boolean;
  theme: ThemeMode;
  compressionOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  contextPanelOpen: boolean;
  toggleContextPanel: () => void;
  setContextPanelOpen: (open: boolean) => void;
  openCompression: () => void;
  closeCompression: () => void;
}

export function createUISlice(): StateCreator<AppStoreState, [], [], UISlice> {
  return (set) => ({
    sidebarOpen: true,
    theme: getStoredTheme() ?? "light",
    compressionOpen: false,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setTheme: (theme) =>
      set(() => {
        setStoredTheme(theme);
        return { theme };
      }),
    toggleTheme: () =>
      set((state) => {
        const nextTheme: ThemeMode = state.theme === "light" ? "dark" : "light";
        setStoredTheme(nextTheme);
        return { theme: nextTheme };
      }),
    contextPanelOpen: true,
    toggleContextPanel: () =>
      set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),
    setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
    openCompression: () => set({ compressionOpen: true }),
    closeCompression: () => set({ compressionOpen: false }),
  });
}

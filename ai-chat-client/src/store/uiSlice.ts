import type { StateCreator } from "zustand";

import type { AppStoreState } from "./useStore";

export interface UISlice {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  compressionOpen: boolean;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  openCompression: () => void;
  closeCompression: () => void;
}

export function createUISlice(): StateCreator<AppStoreState, [], [], UISlice> {
  return (set) => ({
    sidebarOpen: true,
    theme: "light",
    compressionOpen: false,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleTheme: () =>
      set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
    openCompression: () => set({ compressionOpen: true }),
    closeCompression: () => set({ compressionOpen: false }),
  });
}

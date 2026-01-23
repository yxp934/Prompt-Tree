import type { StateCreator } from "zustand";

import type { AppStoreState } from "./useStore";

export interface UISlice {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  toggleSidebar: () => void;
  toggleTheme: () => void;
}

export function createUISlice(): StateCreator<AppStoreState, [], [], UISlice> {
  return (set) => ({
    sidebarOpen: true,
    theme: "light",
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleTheme: () =>
      set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
  });
}


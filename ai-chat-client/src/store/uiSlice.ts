import type { StateCreator } from "zustand";

import { getStoredLocale, setStoredLocale, type Locale } from "@/lib/services/localeService";
import { getStoredTheme, setStoredTheme, type ThemeMode } from "@/lib/services/themeService";

import type { AppStoreState } from "./useStore";

export interface UISlice {
  sidebarOpen: boolean;
  theme: ThemeMode;
  locale: Locale;
  compressionOpen: boolean;
  hydrateUiFromStorage: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
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
    theme: "light",
    locale: "en",
    compressionOpen: false,
    hydrateUiFromStorage: () =>
      set((state) => {
        const theme = getStoredTheme() ?? state.theme;
        const locale = getStoredLocale() ?? state.locale;
        return { theme, locale };
      }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setTheme: (theme) =>
      set(() => {
        setStoredTheme(theme);
        return { theme };
      }),
    setLocale: (locale) =>
      set(() => {
        setStoredLocale(locale);
        return { locale };
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

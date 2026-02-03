"use client";

import { useEffect } from "react";

import { appStore } from "@/store/useStore";

export default function StoreHydration() {
  useEffect(() => {
    const state = appStore.getState();
    state.hydrateUiFromStorage();
    state.hydrateToolsFromStorage();
    state.loadProviders();
    state.hydrateLLMSettingsFromStorage();
  }, []);

  return null;
}


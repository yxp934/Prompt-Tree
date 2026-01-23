"use client";

import { useAppStore } from "@/store/useStore";

export function useContext() {
  const contextBox = useAppStore((s) => s.contextBox);
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);

  const addToContext = useAppStore((s) => s.addToContext);
  const removeFromContext = useAppStore((s) => s.removeFromContext);
  const clearContext = useAppStore((s) => s.clearContext);
  const buildContextContent = useAppStore((s) => s.buildContextContent);

  const totalTokens = contextBox?.totalTokens ?? 0;
  const maxTokens = contextBox?.maxTokens ?? 0;
  const percentage =
    maxTokens > 0 ? Math.min(100, (totalTokens / maxTokens) * 100) : 0;

  return {
    contextBox,
    totalTokens,
    maxTokens,
    percentage,
    isLoading,
    error: error ? new Error(error) : null,
    addToContext,
    removeFromContext,
    clearContext,
    buildContextContent,
  };
}


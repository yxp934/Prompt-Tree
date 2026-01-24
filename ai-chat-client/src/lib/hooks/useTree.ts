"use client";

import { useMemo } from "react";

import { useAppStore } from "@/store/useStore";

export function useTree() {
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const treesMap = useAppStore((s) => s.trees);
  const isLoading = useAppStore((s) => s.isLoading);
  const errorMessage = useAppStore((s) => s.error);

  const createTree = useAppStore((s) => s.createTree);
  const loadTree = useAppStore((s) => s.loadTree);
  const deleteTree = useAppStore((s) => s.deleteTree);
  const updateTreeTitle = useAppStore((s) => s.updateTreeTitle);

  const trees = useMemo(() => Array.from(treesMap.values()), [treesMap]);
  const error = useMemo(
    () => (errorMessage ? new Error(errorMessage) : null),
    [errorMessage],
  );

  return {
    currentTree,
    trees,
    isLoading,
    error,
    createTree,
    loadTree,
    deleteTree,
    updateTreeTitle,
  };
}

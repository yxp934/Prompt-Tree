"use client";

import { useAppStore } from "@/store/useStore";

export function useTree() {
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const trees = useAppStore((s) => Array.from(s.trees.values()));
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);

  const createTree = useAppStore((s) => s.createTree);
  const loadTree = useAppStore((s) => s.loadTree);
  const deleteTree = useAppStore((s) => s.deleteTree);
  const updateTreeTitle = useAppStore((s) => s.updateTreeTitle);

  return {
    currentTree,
    trees,
    isLoading,
    error: error ? new Error(error) : null,
    createTree,
    loadTree,
    deleteTree,
    updateTreeTitle,
  };
}


"use client";

import { useAppStore } from "@/store/useStore";

export function useNode() {
  const nodes = useAppStore((s) => s.nodes);
  const activeNode = useAppStore((s) => s.getActiveNode());
  const selectedNodes = useAppStore((s) => s.getSelectedNodes());
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);

  const createNode = useAppStore((s) => s.createNode);
  const updateNode = useAppStore((s) => s.updateNode);
  const deleteNode = useAppStore((s) => s.deleteNode);

  const setActiveNode = useAppStore((s) => s.setActiveNode);
  const toggleNodeSelection = useAppStore((s) => s.toggleNodeSelection);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const getNodePath = useAppStore((s) => s.getNodePath);
  const getChildren = useAppStore((s) => s.getChildren);

  return {
    nodes,
    activeNode,
    selectedNodes,
    isLoading,
    error: error ? new Error(error) : null,
    createNode,
    updateNode,
    deleteNode,
    setActiveNode,
    toggleNodeSelection,
    clearSelection,
    getNodePath,
    getChildren,
  };
}


"use client";

import { useMemo } from "react";

import { useAppStore } from "@/store/useStore";
import type { Node } from "@/types";

export function useNode() {
  const nodes = useAppStore((s) => s.nodes);
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const isLoading = useAppStore((s) => s.isLoading);
  const errorMessage = useAppStore((s) => s.error);

  const createNode = useAppStore((s) => s.createNode);
  const updateNode = useAppStore((s) => s.updateNode);
  const deleteNode = useAppStore((s) => s.deleteNode);

  const setActiveNode = useAppStore((s) => s.setActiveNode);
  const toggleNodeSelection = useAppStore((s) => s.toggleNodeSelection);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const getNodePath = useAppStore((s) => s.getNodePath);
  const getChildren = useAppStore((s) => s.getChildren);

  const activeNode = useMemo(() => {
    if (!activeNodeId) return null;
    return nodes.get(activeNodeId) ?? null;
  }, [activeNodeId, nodes]);

  const selectedNodes = useMemo(
    () =>
      selectedNodeIds
        .map((id) => nodes.get(id))
        .filter((n): n is Node => Boolean(n)),
    [nodes, selectedNodeIds],
  );

  const error = useMemo(
    () => (errorMessage ? new Error(errorMessage) : null),
    [errorMessage],
  );

  return {
    nodes,
    activeNode,
    selectedNodes,
    isLoading,
    error,
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

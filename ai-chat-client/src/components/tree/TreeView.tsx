"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactFlow, {
  Background,
  MiniMap,
  useEdgesState,
  useNodesState,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
} from "reactflow";

import "reactflow/dist/style.css";

import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import {
  buildFlowGraph,
  computeAutoLayout,
  computePathIds,
  type TreeFlowEdgeData,
  type TreeFlowNodeData,
} from "@/lib/services/dagService";
import { useAppStore } from "@/store/useStore";
import { NodeType, type Node } from "@/types";

import TreeNode from "./TreeNode";
import { TreeControls } from "./TreeControls";
import { TreeEdge } from "./TreeEdge";

const nodeTypes = { treeNode: TreeNode };
const edgeTypes = { treeEdge: TreeEdge };

const COMPRESSED_EXPAND_OFFSET_Y = 96;

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`w-full rounded-lg px-3 py-2 text-left text-[0.85rem] transition-colors duration-150 ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-cream hover:text-ink"
      }`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  );
}

export function TreeView() {
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const nodesMap = useAppStore((s) => s.nodes);
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);

  const setActiveNode = useAppStore((s) => s.setActiveNode);
  const setSelectedNodeIds = useAppStore((s) => s.setSelectedNodeIds);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const addToContext = useAppStore((s) => s.addToContext);
  const deleteNode = useAppStore((s) => s.deleteNode);
  const updateNode = useAppStore((s) => s.updateNode);
  const openCompression = useAppStore((s) => s.openCompression);
  const decompressNode = useAppStore((s) => s.decompressNode);

  const [flowNodes, setFlowNodes, onNodesChange] =
    useNodesState<TreeFlowNodeData>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] =
    useEdgesState<TreeFlowEdgeData>([]);

  const applyAutoLayout = useCallback(
    (overrideNodes?: Iterable<Node>) => {
      if (!currentTree) return;

      const nodesForLayout = overrideNodes ?? nodesMap.values();
      const positions = computeAutoLayout(nodesForLayout, currentTree.rootId);
      setFlowNodes((prev) =>
        prev.map((node) => ({
          ...node,
          position: positions.get(node.id) ?? node.position,
        })),
      );

      void (async () => {
        for (const [id, position] of positions) {
          await updateNode(id, { position });
        }
      })();
    },
    [currentTree, nodesMap, setFlowNodes, updateNode],
  );

  const toggleCompressedNode = useCallback(
    (nodeId: string) => {
      const conversationNode = nodesMap.get(nodeId);
      if (!conversationNode) return;
      if (conversationNode.type !== NodeType.COMPRESSED) return;

      const collapsed = conversationNode.metadata.collapsed ?? false;
      const compressedIds = conversationNode.metadata.compressedNodeIds ?? [];
      const tailId = compressedIds[compressedIds.length - 1] ?? null;
      const tailPosition = tailId ? nodesMap.get(tailId)?.position ?? null : null;
      const anchor = tailPosition ?? conversationNode.position ?? null;

      const nextCollapsed = !collapsed;
      const nextPosition =
        anchor && !nextCollapsed
          ? { x: anchor.x, y: anchor.y - COMPRESSED_EXPAND_OFFSET_Y }
          : anchor && nextCollapsed
            ? { ...anchor }
            : null;

      void updateNode(nodeId, {
        metadata: { ...conversationNode.metadata, collapsed: nextCollapsed },
        ...(nextPosition ? { position: nextPosition } : {}),
      });

      const nextNodes = new Map(nodesMap);
      nextNodes.set(nodeId, {
        ...conversationNode,
        metadata: { ...conversationNode.metadata, collapsed: nextCollapsed },
        ...(nextPosition ? { position: nextPosition } : {}),
      });
      applyAutoLayout(nextNodes.values());

      if (nextCollapsed) {
        if (activeNodeId && compressedIds.includes(activeNodeId)) {
          setActiveNode(nodeId);
        }
        clearSelection();
      }
    },
    [activeNodeId, applyAutoLayout, clearSelection, nodesMap, setActiveNode, updateNode],
  );

  const graph = useMemo(() => {
    if (!currentTree) return { nodes: [], edges: [], branchCount: 0 };

    return buildFlowGraph({
      nodes: nodesMap.values(),
      rootId: currentTree.rootId,
      activeNodeId,
      selectedNodeIds,
      onToggleCollapse: toggleCompressedNode,
    });
  }, [currentTree, nodesMap, activeNodeId, selectedNodeIds, toggleCompressedNode]);

  useEffect(() => {
    setFlowNodes(graph.nodes);
    setFlowEdges(graph.edges);
  }, [graph.nodes, graph.edges, setFlowNodes, setFlowEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setActiveNode(node.id);
    },
    [setActiveNode],
  );

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes }) => {
      setSelectedNodeIds(nodes.map((n) => n.id));
    },
    [setSelectedNodeIds],
  );

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const [editorText, setEditorText] = useState("");

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const [dragOrigin, setDragOrigin] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );

  const openEditor = useCallback(
    (nodeId: string) => {
      const node = nodesMap.get(nodeId);
      if (!node) return;

      const value =
        node.type === NodeType.COMPRESSED
          ? node.summary ?? ""
          : node.content ?? "";

      setEditorNodeId(nodeId);
      setEditorText(value);
      setEditorOpen(true);
    },
    [nodesMap],
  );

  const onPaneClick = useCallback(() => {
    closeContextMenu();
    clearSelection();
  }, [closeContextMenu, clearSelection]);

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const offset = 8;
      setContextMenu({
        nodeId: node.id,
        x: event.clientX + offset,
        y: event.clientY + offset,
      });
    },
    [],
  );

  useEffect(() => {
    if (!contextMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const el = contextMenuRef.current;
      if (el && el.contains(event.target as Node)) return;
      setContextMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;

    const el = contextMenuRef.current;
    if (!el) return;

    const margin = 8;
    const id = window.requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - margin;
      const maxY = window.innerHeight - rect.height - margin;

      const x = Math.min(Math.max(contextMenu.x, margin), maxX);
      const y = Math.min(Math.max(contextMenu.y, margin), maxY);

      if (x !== contextMenu.x || y !== contextMenu.y) {
        setContextMenu((prev) => (prev ? { ...prev, x, y } : prev));
      }
    });

    return () => window.cancelAnimationFrame(id);
  }, [contextMenu]);

  const onNodeDragStart = useCallback(
    (_event: unknown, node: { id: string; position: { x: number; y: number } }) => {
      setDragOrigin((prev) => {
        const next = new Map(prev);
        next.set(node.id, { ...node.position });
        return next;
      });
    },
    [],
  );

  const onNodeDragStop = useCallback(
    (event: unknown, node: { id: string; position: { x: number; y: number } }) => {
      const evt = event as { clientX?: number; clientY?: number } | null;
      const dropZone = document.querySelector(
        '[data-testid="context-dropzone"]',
      ) as HTMLElement | null;

      const origin = dragOrigin.get(node.id);
      const clientX = evt?.clientX ?? null;
      const clientY = evt?.clientY ?? null;

      if (dropZone && clientX !== null && clientY !== null) {
        const rect = dropZone.getBoundingClientRect();
        const hit =
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom;

        if (hit) {
          void addToContext(node.id);

          if (origin) {
            setFlowNodes((prev) =>
              prev.map((n) => (n.id === node.id ? { ...n, position: origin } : n)),
            );
            void updateNode(node.id, { position: origin });
          }

          setDragOrigin((prev) => {
            const next = new Map(prev);
            next.delete(node.id);
            return next;
          });
          return;
        }
      }

      if (clientX !== null && clientY !== null) {
        const nodeEls = Array.from(
          document.querySelectorAll<HTMLElement>("[data-node-id]"),
        );
        const target = nodeEls.find((el) => {
          const targetId = el.getAttribute("data-node-id");
          if (!targetId || targetId === node.id) return false;
          const rect = el.getBoundingClientRect();
          return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          );
        });

        const targetId = target?.getAttribute("data-node-id") ?? null;
        if (targetId) {
          let cursor = nodesMap.get(targetId) ?? null;
          let isCycle = false;
          while (cursor?.parentId) {
            if (cursor.parentId === node.id) {
              isCycle = true;
              break;
            }
            cursor = nodesMap.get(cursor.parentId) ?? null;
          }

          if (!isCycle) {
            void updateNode(node.id, {
              parentId: targetId,
              position: node.position,
            });
            setDragOrigin((prev) => {
              const next = new Map(prev);
              next.delete(node.id);
              return next;
            });
            return;
          }
        }
      }

      void updateNode(node.id, { position: node.position });
      setDragOrigin((prev) => {
        const next = new Map(prev);
        next.delete(node.id);
        return next;
      });
    },
    [addToContext, dragOrigin, nodesMap, setFlowNodes, updateNode],
  );

  const menuNode = contextMenu ? nodesMap.get(contextMenu.nodeId) ?? null : null;
  const isRoot = Boolean(menuNode && currentTree && menuNode.id === currentTree.rootId);
  const compressPathIds = useMemo(() => {
    if (!menuNode || !currentTree) return [] as string[];
    const path = computePathIds(nodesMap, menuNode.id);
    return path.filter((id) => id !== currentTree.rootId);
  }, [currentTree, menuNode, nodesMap]);
  const canCompressPath = compressPathIds.length >= 2;
  const canDecompress = Boolean(menuNode && menuNode.type === NodeType.COMPRESSED);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionChange={onSelectionChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        fitView
        minZoom={0.2}
        maxZoom={2}
        panOnDrag={false}
        panOnScroll={false}
        autoPanOnNodeDrag={false}
        selectionOnDrag
      >
        <Background color="var(--parchment)" gap={48} size={1} />
        <MiniMap
          pannable
          zoomable
          className="!rounded-xl !border !border-parchment !bg-paper !shadow-[0_10px_30px_rgba(26,24,22,0.08)]"
          nodeColor={(n) => {
            const type = (n.data as TreeFlowNodeData).node.type;
            if (type === NodeType.SYSTEM) return "var(--system)";
            if (type === NodeType.USER) return "var(--human)";
            if (type === NodeType.ASSISTANT) return "var(--machine)";
            return "var(--copper)";
          }}
        />
        <TreeControls onAutoLayout={applyAutoLayout} />
      </ReactFlow>

      {contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="fixed z-[60] w-52 rounded-xl border border-parchment bg-paper p-2 shadow-[0_16px_38px_rgba(26,24,22,0.12)]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <MenuItem
              onClick={() => {
                setActiveNode(contextMenu.nodeId);
                closeContextMenu();
              }}
            >
              Continue from here
            </MenuItem>
            <MenuItem
              disabled={!canCompressPath}
              onClick={() => {
                if (!canCompressPath) return;
                setSelectedNodeIds(compressPathIds);
                openCompression();
                closeContextMenu();
              }}
            >
              Compress branch
            </MenuItem>
            <MenuItem
              disabled={!canDecompress}
              onClick={() => {
                if (!menuNode || !canDecompress) return;
                const ok = window.confirm(
                  "Decompress this node and restore the full chain?",
                );
                if (!ok) return;
                void decompressNode(menuNode.id);
                closeContextMenu();
              }}
            >
              Decompress
            </MenuItem>
            <MenuItem
              onClick={() => {
                void addToContext(contextMenu.nodeId);
                closeContextMenu();
              }}
            >
              Add to Context
            </MenuItem>
            <MenuItem
              onClick={() => {
                openEditor(contextMenu.nodeId);
                closeContextMenu();
              }}
            >
              Edit node
            </MenuItem>
            <MenuItem
              disabled={isRoot}
              onClick={() => {
                if (isRoot) return;
                void deleteNode(contextMenu.nodeId);
                closeContextMenu();
              }}
            >
              Delete subtree
            </MenuItem>
          </div>,
          document.body,
        )}

      <Modal
        open={editorOpen}
        title="Edit Node"
        onClose={() => setEditorOpen(false)}
      >
        <div className="space-y-4">
          <textarea
            className="h-48 w-full resize-none rounded-xl border border-parchment bg-paper p-3 font-body text-[0.9rem] leading-relaxed text-ink outline-none focus:border-copper"
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditorOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const id = editorNodeId;
                if (!id) return;
                const node = nodesMap.get(id);
                if (!node) return;

                const updates =
                  node.type === NodeType.COMPRESSED
                    ? { summary: editorText }
                    : { content: editorText };

                void updateNode(id, updates);
                setEditorOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

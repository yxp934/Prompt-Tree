import type { StateCreator } from "zustand";

import { computePathIds } from "@/lib/services/dagService";
import { createContextFileBlock } from "@/lib/services/fileImportService";
import { buildToolInstructionBlocks } from "@/lib/services/tools/toolInstructions";
import { NodeType, type ContextBlock, type ContextBox, type Node } from "@/types";

import type { AppStoreDeps, AppStoreState } from "./useStore";

function computeTotalTokens(blocks: ContextBlock[], nodes: Map<string, Node>): number {
  let total = 0;
  for (const block of blocks) {
    if (block.kind === "node") {
      total += nodes.get(block.nodeId)?.tokenCount ?? 0;
      continue;
    }
    total += block.tokenCount;
  }
  return total;
}

export interface ContextSlice {
  contextBox: ContextBox | null;

  getContextBox: () => ContextBox | null;
  addToContext: (nodeId: string, insertIndex?: number) => Promise<void>;
  addFilesToContext: (files: File[], insertIndex?: number) => Promise<void>;
  removeFromContext: (blockId: string) => void;
  clearContext: () => void;
  reorderContext: (blockIds: string[]) => void;
  syncContextToNode: (nodeId: string) => Promise<void>;
  buildContextContent: () => Promise<string>;
}

export function createContextSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], ContextSlice> {
  return (set, get) => ({
    contextBox: null,

    getContextBox: () => get().contextBox,

    addToContext: async (nodeId, insertIndex) => {
      const box = get().contextBox;
      if (!box) return;
      if (box.blocks.some((block) => block.kind === "node" && block.nodeId === nodeId)) {
        return;
      }

      const existingNodes = get().nodes;
      const node =
        existingNodes.get(nodeId) ?? (await deps.nodeService.read(nodeId));
      if (!node) return;

      const nodesMap = existingNodes.has(nodeId)
        ? existingNodes
        : new Map(existingNodes).set(nodeId, node);
      if (nodesMap !== existingNodes) {
        set({ nodes: nodesMap });
      }

      const blocks = box.blocks.slice();
      const safeIndex =
        typeof insertIndex === "number" && Number.isFinite(insertIndex)
          ? Math.max(0, Math.min(insertIndex, blocks.length))
          : blocks.length;
      blocks.splice(safeIndex, 0, { id: nodeId, kind: "node", nodeId });
      const totalTokens = computeTotalTokens(blocks, nodesMap);

      const next: ContextBox = { ...box, blocks, totalTokens };
      set({ contextBox: next });
      await deps.contextBoxService.put(next);
    },

    addFilesToContext: async (files, insertIndex) => {
      const box = get().contextBox;
      if (!box) return;
      if (!Array.isArray(files) || files.length === 0) return;

      const blocks = box.blocks.slice();
      const safeIndex =
        typeof insertIndex === "number" && Number.isFinite(insertIndex)
          ? Math.max(0, Math.min(insertIndex, blocks.length))
          : blocks.length;

      const imported: ContextBlock[] = [];
      const errors: string[] = [];

      for (const file of files) {
        try {
          imported.push(await createContextFileBlock(file));
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to import file.";
          errors.push(`${file.name || "file"}: ${message}`);
        }
      }

      if (imported.length === 0) {
        set({ error: errors[0] ?? "Failed to import files." });
        return;
      }

      blocks.splice(safeIndex, 0, ...imported);

      const totalTokens = computeTotalTokens(blocks, get().nodes);
      const next: ContextBox = { ...box, blocks, totalTokens };
      set({ contextBox: next, ...(errors.length > 0 ? { error: errors[0] } : {}) });
      await deps.contextBoxService.put(next);
    },

    removeFromContext: (blockId) => {
      const box = get().contextBox;
      if (!box) return;

      const blocks = box.blocks.filter((block) => block.id !== blockId);
      const totalTokens = computeTotalTokens(blocks, get().nodes);
      const next: ContextBox = { ...box, blocks, totalTokens };

      set({ contextBox: next });
      void deps.contextBoxService.put(next);
    },

    clearContext: () => {
      const box = get().contextBox;
      if (!box) return;

      const next: ContextBox = { ...box, blocks: [], totalTokens: 0 };
      set({ contextBox: next });
      void deps.contextBoxService.put(next);
    },

    reorderContext: (blockIds) => {
      const box = get().contextBox;
      if (!box) return;

      const current = new Map(box.blocks.map((block) => [block.id, block]));
      const unique = Array.from(new Set(blockIds))
        .map((id) => current.get(id))
        .filter((b): b is ContextBlock => Boolean(b));
      const totalTokens = computeTotalTokens(unique, get().nodes);
      const next: ContextBox = { ...box, blocks: unique, totalTokens };

      set({ contextBox: next });
      void deps.contextBoxService.put(next);
    },
    syncContextToNode: async (nodeId) => {
      const box = get().contextBox;
      if (!box) return;

      const nodes = get().nodes;
      if (!nodes.has(nodeId)) return;

      const pathIds = computePathIds(nodes, nodeId);
      if (pathIds.length === 0) return;

      const pathSet = new Set(pathIds);
      const hidden = new Set<string>();
      for (const id of pathIds) {
        const node = nodes.get(id);
        if (!node) continue;
        if (node.type !== NodeType.COMPRESSED) continue;
        if (!node.metadata.collapsed) continue;
        const compressedIds = node.metadata.compressedNodeIds ?? [];
        for (const compressedId of compressedIds) {
          if (pathSet.has(compressedId)) hidden.add(compressedId);
        }
      }

      const filteredPathIds = pathIds.filter((id) => !hidden.has(id));

      const unique: string[] = [];
      const seen = new Set<string>();
      for (const id of filteredPathIds) {
        if (!id || seen.has(id)) continue;
        if (!nodes.has(id)) continue;
        seen.add(id);
        unique.push(id);
      }

      const existingBlocks = box.blocks;

      const anchoredFiles = new Map<string | null, ContextBlock[]>();
      let lastNodeId: string | null = null;
      for (const block of existingBlocks) {
        if (block.kind === "node") {
          lastNodeId = block.nodeId;
          continue;
        }
        const bucket = anchoredFiles.get(lastNodeId) ?? [];
        bucket.push(block);
        anchoredFiles.set(lastNodeId, bucket);
      }

      const nextBlocks: ContextBlock[] = [];
      const headFiles = anchoredFiles.get(null) ?? [];
      nextBlocks.push(...headFiles);

      for (const id of unique) {
        nextBlocks.push({ id, kind: "node", nodeId: id });
        const bucket = anchoredFiles.get(id);
        if (bucket?.length) nextBlocks.push(...bucket);
      }

      // Append file blocks anchored to nodes that are no longer in the path.
      for (const [anchorId, bucket] of anchoredFiles.entries()) {
        if (anchorId === null) continue;
        if (unique.includes(anchorId)) continue;
        nextBlocks.push(...bucket);
      }

      const same =
        nextBlocks.length === box.blocks.length &&
        nextBlocks.every((block, index) => block.id === box.blocks[index]?.id);
      if (same) return;

      const totalTokens = computeTotalTokens(nextBlocks, nodes);
      const next: ContextBox = { ...box, blocks: nextBlocks, totalTokens };
      set({ contextBox: next });
      await deps.contextBoxService.put(next);
    },

    buildContextContent: async () => {
      const box = get().contextBox;
      if (!box) return "";

      const toolBlocks = buildToolInstructionBlocks(
        get().draftToolUses ?? [],
        get().toolSettings,
      );
      let insertedToolBlocks = false;

      const chunks: string[] = [];
      for (const block of box.blocks) {
        if (block.kind === "file") {
          if (block.fileKind === "image") {
            chunks.push(`User: [Image: ${block.filename}]`);
            continue;
          }

          const truncatedNote = block.truncated ? "\n\n[Truncated]" : "";
          chunks.push(
            [
              `User: [File: ${block.filename} (${block.fileKind})]`,
              "```",
              block.content,
              "```" + truncatedNote,
            ].join("\n"),
          );
          continue;
        }

        const node = get().nodes.get(block.nodeId);
        if (!node) continue;

        if (!insertedToolBlocks && node.type === NodeType.SYSTEM) {
          chunks.push(`System: ${node.content}`);
          insertedToolBlocks = true;
          for (const toolBlock of toolBlocks) {
            chunks.push(`System: ${toolBlock.content}`);
          }
          continue;
        }

        if (node.type === NodeType.COMPRESSED) {
          chunks.push(`[Compressed Context: ${node.summary ?? ""}]`);
          continue;
        }

        const role =
          node.type === NodeType.USER
            ? "User"
            : node.type === NodeType.ASSISTANT
              ? "Assistant"
              : "System";

        chunks.push(`${role}: ${node.content}`);
      }

      if (!insertedToolBlocks) {
        for (const block of toolBlocks) {
          chunks.unshift(`System: ${block.content}`);
        }
      }

      return chunks.join("\n\n");
    },
  });
}

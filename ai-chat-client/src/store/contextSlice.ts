import type { StateCreator } from "zustand";

import { computePathIds } from "@/lib/services/dagService";
import { createContextFileBlock } from "@/lib/services/fileImportService";
import {
  buildAutoMemoryBlockId,
  buildPinnedMemoryBlockId,
  isLongTermMemoryBlockId,
} from "@/lib/services/longTermMemoryBlocks";
import { fileBlockToChatMessage, nodeToChatMessage, renderChatMessagesPreview } from "@/lib/services/chatMessageService";
import { injectToolInstructionMessages } from "@/lib/services/tools/toolInstructions";
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
  upsertFileBlock: (block: ContextBlock, anchorNodeId?: string) => Promise<void>;
  replaceAutoMemoryBlocks: (blocks: ContextBlock[], anchorNodeId?: string) => Promise<void>;
  removeFromContext: (blockId: string) => void;
  clearContext: () => void;
  reorderContext: (blockIds: string[]) => void;
  togglePinLongTermMemory: (memoryId: string) => Promise<void>;
  syncContextToNode: (nodeId: string) => Promise<void>;
  buildContextContent: () => Promise<string>;
}

export function createContextSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], ContextSlice> {
  return (set, get) => {
    const AUTO_MEM_PREFIX = "ltm.auto.mem:";
    const PIN_MEM_PREFIX = "ltm.pin.mem:";

    const enforceLongTermMemoryPolicy = (blocks: ContextBlock[]): ContextBlock[] => {
      const settings = get().longTermMemorySettings;
      const maxAuto = settings.maxAutoMemoriesPerThread;
      const maxPinned = settings.maxPinnedMemoriesPerThread;

      const memoryMap = new Map<string, { autoId?: string; pinId?: string }>();
      const autoBlocks: Array<{ id: string; createdAt: number }> = [];
      const pinBlocks: Array<{ id: string; createdAt: number }> = [];

      for (const block of blocks) {
        if (block.kind !== "file") continue;

        if (block.id.startsWith(AUTO_MEM_PREFIX)) {
          const memoryId = block.id.slice(AUTO_MEM_PREFIX.length).trim();
          if (!memoryId) continue;
          const entry = memoryMap.get(memoryId) ?? {};
          entry.autoId = block.id;
          memoryMap.set(memoryId, entry);
          autoBlocks.push({ id: block.id, createdAt: block.createdAt });
        } else if (block.id.startsWith(PIN_MEM_PREFIX)) {
          const memoryId = block.id.slice(PIN_MEM_PREFIX.length).trim();
          if (!memoryId) continue;
          const entry = memoryMap.get(memoryId) ?? {};
          entry.pinId = block.id;
          memoryMap.set(memoryId, entry);
          pinBlocks.push({ id: block.id, createdAt: block.createdAt });
        }
      }

      const removeIds = new Set<string>();

      // Deduplicate: if pinned exists, drop auto for the same memoryId.
      for (const entry of memoryMap.values()) {
        if (entry.pinId && entry.autoId) {
          removeIds.add(entry.autoId);
        }
      }

      const trimmedPins = pinBlocks.filter((b) => !removeIds.has(b.id));
      if (trimmedPins.length > maxPinned) {
        trimmedPins
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(0, trimmedPins.length - maxPinned)
          .forEach((b) => removeIds.add(b.id));
      }

      const trimmedAutos = autoBlocks.filter((b) => !removeIds.has(b.id));
      if (trimmedAutos.length > maxAuto) {
        trimmedAutos
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(0, trimmedAutos.length - maxAuto)
          .forEach((b) => removeIds.add(b.id));
      }

      if (removeIds.size === 0) return blocks;
      return blocks.filter((b) => !removeIds.has(b.id));
    };

    return {
      contextBox: null,

      getContextBox: () => get().contextBox,

      addToContext: async (nodeId, insertIndex) => {
        const box = get().contextBox;
        if (!box) return;
        if (box.blocks.some((block) => block.kind === "node" && block.nodeId === nodeId)) {
          return;
        }

        const existingNodes = get().nodes;
        const node = existingNodes.get(nodeId) ?? (await deps.nodeService.read(nodeId));
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
            const message = err instanceof Error ? err.message : "Failed to import file.";
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

      upsertFileBlock: async (block, anchorNodeId) => {
        const box = get().contextBox;
        if (!box) return;

        let blocks = box.blocks.slice();
        const existingIndex = blocks.findIndex((b) => b.id === block.id);

        if (existingIndex !== -1) {
          blocks[existingIndex] = block;
        } else {
          const anchorIndex = anchorNodeId
            ? blocks.findIndex((b) => b.kind === "node" && b.nodeId === anchorNodeId)
            : -1;

          const insertIndex = (() => {
            if (anchorIndex === -1) return blocks.length;
            let idx = anchorIndex + 1;
            // Keep long-term memory blocks grouped right after the anchor node.
            if (block.kind === "file" && isLongTermMemoryBlockId(block.id)) {
              while (
                idx < blocks.length &&
                blocks[idx]?.kind === "file" &&
                isLongTermMemoryBlockId(blocks[idx]!.id)
              ) {
                idx += 1;
              }
              return idx;
            }
            // Default: insert right after the anchor node (before its existing file blocks).
            return anchorIndex + 1;
          })();

          blocks.splice(insertIndex, 0, block);
        }

        blocks = enforceLongTermMemoryPolicy(blocks);
        const totalTokens = computeTotalTokens(blocks, get().nodes);
        const next: ContextBox = { ...box, blocks, totalTokens };
        set({ contextBox: next });
        await deps.contextBoxService.put(next);
      },

      replaceAutoMemoryBlocks: async (blocks, anchorNodeId) => {
        const box = get().contextBox;
        if (!box) return;

        const incoming = blocks.filter(
          (block): block is ContextBlock =>
            block.kind === "file" && block.id.startsWith(AUTO_MEM_PREFIX),
        );
        const uniqueIncoming = Array.from(new Map(incoming.map((block) => [block.id, block])).values());

        let nextBlocks = box.blocks.filter(
          (block) => !(block.kind === "file" && block.id.startsWith(AUTO_MEM_PREFIX)),
        );

        const anchorIndex = anchorNodeId
          ? nextBlocks.findIndex((block) => block.kind === "node" && block.nodeId === anchorNodeId)
          : -1;

        const insertIndex = (() => {
          if (anchorIndex === -1) return nextBlocks.length;
          let index = anchorIndex + 1;
          while (
            index < nextBlocks.length &&
            nextBlocks[index]?.kind === "file" &&
            isLongTermMemoryBlockId(nextBlocks[index]!.id)
          ) {
            index += 1;
          }
          return index;
        })();

        nextBlocks.splice(insertIndex, 0, ...uniqueIncoming);
        nextBlocks = enforceLongTermMemoryPolicy(nextBlocks);
        const totalTokens = computeTotalTokens(nextBlocks, get().nodes);
        const next: ContextBox = { ...box, blocks: nextBlocks, totalTokens };
        set({ contextBox: next });
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

      togglePinLongTermMemory: async (memoryId) => {
        const id = memoryId.trim();
        if (!id) return;
        const box = get().contextBox;
        if (!box) return;

        const autoId = buildAutoMemoryBlockId(id);
        const pinId = buildPinnedMemoryBlockId(id);
        let blocks = box.blocks.slice();

        const autoIndex = blocks.findIndex((b) => b.id === autoId && b.kind === "file");
        const pinIndex = blocks.findIndex((b) => b.id === pinId && b.kind === "file");
        const fromIndex = pinIndex !== -1 ? pinIndex : autoIndex;
        if (fromIndex === -1) return;

        const from = blocks[fromIndex];
        if (!from || from.kind !== "file") return;
        if (from.fileKind === "image") return;

        const pinned = pinIndex !== -1;

        if (!pinned) {
          const settings = get().longTermMemorySettings;
          const maxPinned = settings.maxPinnedMemoriesPerThread;
          const pinnedCount = blocks.filter(
            (b) => b.kind === "file" && b.id.startsWith(PIN_MEM_PREFIX),
          ).length;
          if (pinnedCount >= maxPinned) {
            set({ error: "errors.memoryPinnedLimitReached" });
            return;
          }
        }
        const nextId = pinned ? autoId : pinId;

        // Remove any existing duplicate with the target id.
        const targetIndex = blocks.findIndex((b) => b.id === nextId);
        if (targetIndex !== -1) {
          blocks.splice(targetIndex, 1);
          if (targetIndex < fromIndex) {
            // Adjust fromIndex because we removed an earlier element.
            blocks.splice(fromIndex - 1, 1);
          } else {
            blocks.splice(fromIndex, 1);
          }
        } else {
          blocks.splice(fromIndex, 1);
        }

        const nextContent = (() => {
          const text = typeof from.content === "string" ? from.content : "";
          const lines = text.split("\n");
          if (lines[0] === "Pinned Memory" || lines[0] === "Retrieved Memory") {
            lines[0] = pinned ? "Retrieved Memory" : "Pinned Memory";
            return lines.join("\n");
          }
          return text;
        })();

        const nextBlock = {
          ...from,
          id: nextId,
          filename: pinned ? "Memory" : "Memory (Pinned)",
          content: nextContent,
        };

        // Reinsert next to original position.
        const safeIndex = Math.max(0, Math.min(fromIndex, blocks.length));
        blocks.splice(safeIndex, 0, nextBlock);

        blocks = enforceLongTermMemoryPolicy(blocks);
        const totalTokens = computeTotalTokens(blocks, get().nodes);
        const next: ContextBox = { ...box, blocks, totalTokens };
        set({ contextBox: next });
        await deps.contextBoxService.put(next);
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

        const baseMessages = box.blocks
          .map((block) => {
            if (block.kind === "file") return fileBlockToChatMessage(block);
            const node = get().nodes.get(block.nodeId);
            if (!node) return null;
            return nodeToChatMessage(node);
          })
          .filter((message): message is NonNullable<typeof message> => Boolean(message));

        const withTools = injectToolInstructionMessages(
          baseMessages,
          get().draftToolUses ?? [],
          get().toolSettings,
        );

        return renderChatMessagesPreview(withTools);
      },
    };
  };
}

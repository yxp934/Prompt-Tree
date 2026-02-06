import { estimateTokens } from "@/lib/services/tokenService";
import type { ContextTextFileBlock, MemoryItem } from "@/types";

export const LTM_PROFILE_BLOCK_ID = "ltm.profile";

export function buildFolderDocBlockId(folderId: string): string {
  return `ltm.folderDoc:${folderId}`;
}

export function buildAutoMemoryBlockId(memoryId: string): string {
  return `ltm.auto.mem:${memoryId}`;
}

export function buildPinnedMemoryBlockId(memoryId: string): string {
  return `ltm.pin.mem:${memoryId}`;
}

export function isLongTermMemoryBlockId(blockId: string): boolean {
  return blockId === LTM_PROFILE_BLOCK_ID || blockId.startsWith("ltm.");
}

export function parsePinnedMemoryBlockId(
  blockId: string,
): { memoryId: string; pinned: boolean } | null {
  if (blockId.startsWith("ltm.auto.mem:")) {
    const memoryId = blockId.slice("ltm.auto.mem:".length).trim();
    return memoryId ? { memoryId, pinned: false } : null;
  }
  if (blockId.startsWith("ltm.pin.mem:")) {
    const memoryId = blockId.slice("ltm.pin.mem:".length).trim();
    return memoryId ? { memoryId, pinned: true } : null;
  }
  return null;
}

export function buildProfileContextBlock(markdown: string, createdAt?: number): ContextTextFileBlock {
  const content = markdown.trim();
  return {
    id: LTM_PROFILE_BLOCK_ID,
    kind: "file",
    fileKind: "markdown",
    filename: "User Profile",
    mimeType: "text/markdown",
    createdAt: createdAt ?? Date.now(),
    tokenCount: estimateTokens(content),
    content,
    truncated: false,
  };
}

export function buildFolderDocContextBlock(params: {
  folderId: string;
  markdown: string;
  createdAt?: number;
}): ContextTextFileBlock {
  const content = params.markdown.trim();
  return {
    id: buildFolderDocBlockId(params.folderId),
    kind: "file",
    fileKind: "markdown",
    filename: "Folder Doc",
    mimeType: "text/markdown",
    createdAt: params.createdAt ?? Date.now(),
    tokenCount: estimateTokens(content),
    content,
    truncated: false,
  };
}

export function buildMemoryContextBlock(params: {
  item: MemoryItem;
  pinned: boolean;
  createdAt?: number;
}): ContextTextFileBlock {
  const { item, pinned } = params;
  const header = pinned ? "Pinned Memory" : "Retrieved Memory";
  const tagLine = item.tags.length ? `Tags: ${item.tags.join(", ")}` : "Tags: (none)";
  const scopeLine =
    item.scope === "folder"
      ? `Scope: folder(${item.folderId ?? "unknown"})`
      : "Scope: user";
  const createdLine = `Created: ${new Date(item.createdAt).toISOString()}`;
  const updatedLine = `Updated: ${new Date(item.updatedAt).toISOString()}`;
  const body = [header, scopeLine, tagLine, createdLine, updatedLine, "", item.text.trim()].join("\n");
  const id = pinned ? buildPinnedMemoryBlockId(item.id) : buildAutoMemoryBlockId(item.id);
  return {
    id,
    kind: "file",
    fileKind: "markdown",
    filename: pinned ? "Memory (Pinned)" : "Memory",
    mimeType: "text/markdown",
    createdAt: params.createdAt ?? Date.now(),
    tokenCount: estimateTokens(body),
    content: body,
    truncated: false,
  };
}

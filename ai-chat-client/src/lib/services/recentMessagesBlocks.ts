import { estimateTokens } from "@/lib/services/tokenService";
import { NodeType, type ContextTextFileBlock, type Node } from "@/types";

export const RECENT_MESSAGES_BLOCK_ID = "stm.recent_messages";

export function isRecentMessagesBlockId(blockId: string): boolean {
  return blockId === RECENT_MESSAGES_BLOCK_ID;
}

function formatHeading(node: Node): string {
  if (node.type === NodeType.USER) return "User";
  if (node.type === NodeType.ASSISTANT) {
    const model = node.metadata.modelName?.trim();
    return model ? `Assistant (${model})` : "Assistant";
  }
  return "Message";
}

export function buildRecentMessagesContextBlock(params: {
  sourceTitle: string;
  sourceTreeId: string;
  messageNodes: Node[];
  createdAt?: number;
}): ContextTextFileBlock {
  const createdAt = params.createdAt ?? Date.now();

  const transcript = params.messageNodes
    .filter((node) => node.type === NodeType.USER || node.type === NodeType.ASSISTANT)
    .map((node) => {
      const heading = formatHeading(node);
      const text = node.content.trim();
      return [`## ${heading}`, "", text || "(empty)"].join("\n");
    })
    .join("\n\n---\n\n")
    .trim();

  const content = [
    "# Recent Messages (Auto)",
    "",
    `Source thread: ${params.sourceTitle.trim() || params.sourceTreeId}`,
    `Captured: ${new Date(createdAt).toISOString()}`,
    "",
    transcript,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    id: RECENT_MESSAGES_BLOCK_ID,
    kind: "file",
    fileKind: "markdown",
    filename: "Recent Messages",
    mimeType: "text/markdown",
    createdAt,
    tokenCount: estimateTokens(content),
    content,
    truncated: false,
  };
}


import { NodeType, type Node } from "@/types";

export function getNodeDisplayName(node: Node): string {
  if (node.type === NodeType.ASSISTANT) {
    return node.metadata.modelName ?? "Assistant";
  }
  if (node.type === NodeType.USER) {
    return "You";
  }
  if (node.type === NodeType.SYSTEM) {
    return "System";
  }
  return "Compressed";
}

export function getNodeAvatarLetter(node: Node): string {
  const name = getNodeDisplayName(node).trim();
  return name ? name[0].toUpperCase() : "?";
}

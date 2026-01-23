import { estimateTokens as estimate } from "@/lib/utils/tokens";
import type { Node } from "@/types";

export function estimateTokens(text: string): number {
  return estimate(text);
}

export function sumNodeTokens(nodes: Iterable<Node>): number {
  let total = 0;
  for (const node of nodes) total += node.tokenCount;
  return total;
}


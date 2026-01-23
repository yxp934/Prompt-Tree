import { describe, expect, it } from "vitest";

import { estimateTokens, sumNodeTokens } from "@/lib/services/tokenService";
import { NodeType, type Node } from "@/types";

describe("tokenService", () => {
  it("estimates tokens", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("hello world")).toBeGreaterThan(0);
  });

  it("sums node token counts", () => {
    const nodes: Node[] = [
      {
        id: "a",
        type: NodeType.USER,
        createdAt: 1,
        updatedAt: 1,
        parentId: null,
        content: "a",
        metadata: { tags: [], metaInstructions: {} },
        tokenCount: 10,
      },
      {
        id: "b",
        type: NodeType.ASSISTANT,
        createdAt: 2,
        updatedAt: 2,
        parentId: "a",
        content: "b",
        metadata: { tags: [], metaInstructions: {} },
        tokenCount: 20,
      },
    ];

    expect(sumNodeTokens(nodes)).toBe(30);
  });
});


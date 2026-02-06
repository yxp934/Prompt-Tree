import { describe, expect, it } from "vitest";

import { buildMemoryContextBlock } from "@/lib/services/longTermMemoryBlocks";
import type { MemoryItem } from "@/types";

describe("longTermMemoryBlocks", () => {
  it("includes created/updated timestamps in memory context blocks", () => {
    const item: MemoryItem = {
      id: "mem-1",
      scope: "user",
      text: "Hello memory",
      tags: ["demo"],
      confidence: "medium",
      status: "active",
      createdAt: 1,
      updatedAt: 2,
      sources: [],
    };

    const block = buildMemoryContextBlock({ item, pinned: false, createdAt: 3 });

    expect(block.content).toContain("Created: 1970-01-01T00:00:00.001Z");
    expect(block.content).toContain("Updated: 1970-01-01T00:00:00.002Z");
  });
});


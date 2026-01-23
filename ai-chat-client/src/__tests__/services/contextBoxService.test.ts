import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { ContextBoxService } from "@/lib/services/contextBoxService";

describe("ContextBoxService", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("reads, writes, updates, and deletes context boxes", async () => {
    const service = new ContextBoxService();

    expect(await service.read("missing")).toBeNull();

    await service.put({
      id: "box-1",
      nodeIds: ["n1"],
      totalTokens: 12,
      maxTokens: 8192,
      createdAt: 1,
    });

    const loaded = await service.read("box-1");
    expect(loaded?.nodeIds).toEqual(["n1"]);

    const updated = await service.update("box-1", {
      nodeIds: ["n1", "n2"],
      totalTokens: 25,
    });
    expect(updated.nodeIds).toEqual(["n1", "n2"]);
    expect(updated.totalTokens).toBe(25);

    await service.delete("box-1");
    expect(await service.read("box-1")).toBeNull();
  });
});


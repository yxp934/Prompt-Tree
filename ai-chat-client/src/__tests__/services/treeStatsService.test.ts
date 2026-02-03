import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { NodeService } from "@/lib/services/nodeService";
import { computeNodeCountsForTrees } from "@/lib/services/treeStatsService";
import { TreeService } from "@/lib/services/treeService";
import { NodeType } from "@/types";

describe("treeStatsService", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("computes node counts for multiple trees", async () => {
    const treeService = new TreeService();
    const nodeService = new NodeService();

    const treeA = await treeService.create({ title: "Tree A" });
    const treeB = await treeService.create({ title: "Tree B" });

    const user1 = await nodeService.create({
      type: NodeType.USER,
      parentId: treeA.rootId,
      content: "U1",
    });
    await nodeService.create({
      type: NodeType.ASSISTANT,
      parentId: user1.id,
      content: "A1",
    });
    await nodeService.create({
      type: NodeType.USER,
      parentId: treeA.rootId,
      content: "U2",
    });

    await nodeService.create({
      type: NodeType.USER,
      parentId: treeB.rootId,
      content: "B1",
    });

    const counts = await computeNodeCountsForTrees([treeA, treeB]);
    expect(counts[treeA.id]).toBe(4);
    expect(counts[treeB.id]).toBe(2);
  });
});


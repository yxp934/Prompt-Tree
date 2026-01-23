import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB, getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { NodeService } from "@/lib/services/nodeService";
import { TreeService } from "@/lib/services/treeService";
import { NodeType, type ContextBox } from "@/types";

describe("TreeService", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("creates a tree with a system root node and context box", async () => {
    const service = new TreeService();
    const tree = await service.create("My Tree");

    expect(tree.title).toBe("My Tree");
    expect(tree.rootId).toBeTruthy();

    const nodeService = new NodeService();
    const root = await nodeService.read(tree.rootId);
    expect(root?.type).toBe(NodeType.SYSTEM);

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.contextBoxes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.contextBoxes.name);
    const contextBox = await requestToPromise<ContextBox | undefined>(
      store.get(tree.id) as IDBRequest<ContextBox | undefined>,
    );
    await transactionToPromise(tx);

    expect(contextBox?.nodeIds).toEqual([tree.rootId]);
  });

  it("lists, updates title, loads nodes, and deletes trees", async () => {
    const service = new TreeService();
    const tree = await service.create("First");

    expect((await service.list()).map((t) => t.id)).toEqual([tree.id]);

    const renamed = await service.updateTitle(tree.id, "Renamed");
    expect(renamed.title).toBe("Renamed");

    const loaded = await service.loadTreeNodes(tree.id);
    expect(loaded.tree.id).toBe(tree.id);
    expect(loaded.nodes.some((n) => n.id === tree.rootId)).toBe(true);

    await service.delete(tree.id);

    expect(await service.read(tree.id)).toBeNull();
    const nodeService = new NodeService();
    expect(await nodeService.read(tree.rootId)).toBeNull();
  });
});


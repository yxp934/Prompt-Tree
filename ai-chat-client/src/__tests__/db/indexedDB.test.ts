import { beforeEach, describe, expect, it } from "vitest";

import { getDB, deleteDB } from "@/lib/db/indexedDB";
import { ObjectStore } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { NodeType, type Node } from "@/types";

describe("IndexedDB", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("initializes expected stores and indexes", async () => {
    const db = await getDB();

    expect(Array.from(db.objectStoreNames)).toEqual(
      expect.arrayContaining([
        DB_CONFIG.stores.nodes.name,
        DB_CONFIG.stores.trees.name,
        DB_CONFIG.stores.contextBoxes.name,
      ]),
    );

    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readonly");
    const nodesStore = tx.objectStore(DB_CONFIG.stores.nodes.name);
    expect(Array.from(nodesStore.indexNames)).toEqual(
      expect.arrayContaining(["parentId", "type", "createdAt"]),
    );
  });

  it("supports basic CRUD via the ObjectStore wrapper", async () => {
    const db = await getDB();
    const store = new ObjectStore<Node>(db, DB_CONFIG.stores.nodes.name);

    const node: Node = {
      id: "n1",
      type: NodeType.USER,
      createdAt: 1,
      updatedAt: 1,
      parentId: null,
      content: "hello",
      metadata: { tags: [], metaInstructions: {} },
      tokenCount: 2,
    };

    await store.put(node);

    const loaded = await store.get("n1");
    expect(loaded).toEqual(node);

    await store.delete("n1");
    expect(await store.get("n1")).toBeUndefined();
  });
});


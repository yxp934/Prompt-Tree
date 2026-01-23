import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB, getDB } from "@/lib/db/indexedDB";
import { ObjectStore, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { NodeType, type Node } from "@/types";

describe("ObjectStore", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("supports add/get/getAll/clear and index queries", async () => {
    const db = await getDB();
    const store = new ObjectStore<Node>(db, DB_CONFIG.stores.nodes.name);

    const n1: Node = {
      id: "n1",
      type: NodeType.USER,
      createdAt: 1,
      updatedAt: 1,
      parentId: "p1",
      content: "one",
      metadata: { tags: [], metaInstructions: {} },
      tokenCount: 1,
    };
    const n2: Node = {
      id: "n2",
      type: NodeType.USER,
      createdAt: 2,
      updatedAt: 2,
      parentId: "p2",
      content: "two",
      metadata: { tags: [], metaInstructions: {} },
      tokenCount: 1,
    };

    await store.add(n1);
    await store.put(n2);

    expect(await store.get("n1")).toEqual(n1);
    expect((await store.getAll()).map((n) => n.id).sort()).toEqual(["n1", "n2"]);

    expect(await store.getByIndex("parentId", "p1")).toEqual(n1);
    expect((await store.getAllByIndex("parentId", "p2")).map((n) => n.id)).toEqual([
      "n2",
    ]);

    await store.clear();
    expect(await store.getAll()).toEqual([]);
  });

  it("rejects on transaction abort", async () => {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readwrite");
    const promise = transactionToPromise(tx);
    tx.abort();
    await expect(promise).rejects.toThrow();
  });

  it("rejects on duplicate keys with add()", async () => {
    const db = await getDB();
    const store = new ObjectStore<Node>(db, DB_CONFIG.stores.nodes.name);

    const node: Node = {
      id: "dup",
      type: NodeType.USER,
      createdAt: 1,
      updatedAt: 1,
      parentId: null,
      content: "x",
      metadata: { tags: [], metaInstructions: {} },
      tokenCount: 1,
    };

    await store.add(node);
    await expect(store.add(node)).rejects.toThrow();
  });
});


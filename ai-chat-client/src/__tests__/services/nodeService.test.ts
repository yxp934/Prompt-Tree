import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { NodeService } from "@/lib/services/nodeService";
import { estimateTokens } from "@/lib/utils/tokens";
import { NodeType } from "@/types";

describe("NodeService", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("creates and reads nodes", async () => {
    const service = new NodeService();

    const node = await service.create({
      type: NodeType.USER,
      content: "hello world",
    });

    const loaded = await service.read(node.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.content).toBe("hello world");
    expect(loaded?.tokenCount).toBe(estimateTokens("hello world"));
  });

  it("returns children ordered by createdAt", async () => {
    const service = new NodeService();
    const parent = await service.create({ type: NodeType.USER, content: "p" });

    const c1 = await service.create({
      parentId: parent.id,
      content: "c1",
      createdAt: 1,
      updatedAt: 1,
    });
    const c2 = await service.create({
      parentId: parent.id,
      content: "c2",
      createdAt: 2,
      updatedAt: 2,
    });

    const children = await service.getChildren(parent.id);
    expect(children.map((n) => n.id)).toEqual([c1.id, c2.id]);
  });

  it("builds a path from root to node", async () => {
    const service = new NodeService();

    const root = await service.create({ type: NodeType.SYSTEM, content: "sys" });
    const user = await service.create({
      type: NodeType.USER,
      parentId: root.id,
      content: "u",
    });
    const assistant = await service.create({
      type: NodeType.ASSISTANT,
      parentId: user.id,
      content: "a",
    });

    const path = await service.getPath(assistant.id);
    expect(path.map((n) => n.id)).toEqual([root.id, user.id, assistant.id]);
  });

  it("deletes nodes recursively", async () => {
    const service = new NodeService();

    const root = await service.create({ type: NodeType.USER, content: "root" });
    const child = await service.create({
      type: NodeType.USER,
      parentId: root.id,
      content: "child",
    });
    const grandChild = await service.create({
      type: NodeType.USER,
      parentId: child.id,
      content: "grandChild",
    });

    await service.delete(root.id);

    expect(await service.read(root.id)).toBeNull();
    expect(await service.read(child.id)).toBeNull();
    expect(await service.read(grandChild.id)).toBeNull();
  });

  it("searches by content and tags", async () => {
    const service = new NodeService();

    const n1 = await service.create({
      type: NodeType.USER,
      content: "Zustand slice pattern",
    });
    const n2 = await service.create({
      type: NodeType.USER,
      content: "Other topic",
      metadata: { tags: ["reactflow"], metaInstructions: {} },
    });

    expect((await service.search("zustand")).map((n) => n.id)).toEqual([n1.id]);
    expect((await service.search("reactflow")).map((n) => n.id)).toEqual([n2.id]);
  });

  it("batch creates multiple nodes in one transaction", async () => {
    const service = new NodeService();
    const created = await service.batchCreate([
      { content: "a" },
      { content: "b" },
      { content: "c" },
    ]);

    expect(created).toHaveLength(3);

    const loaded = await Promise.all(created.map((n) => service.read(n.id)));
    expect(loaded.every(Boolean)).toBe(true);
  });
});

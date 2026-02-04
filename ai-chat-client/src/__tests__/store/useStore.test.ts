import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { createAppStore } from "@/store/useStore";
import { NodeType } from "@/types";

describe("Zustand store (AppStore)", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("initializes with a default tree, nodes, and context box", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const state = store.getState();
    expect(state.initialized).toBe(true);
    expect(state.trees.size).toBe(1);
    expect(state.currentTreeId).toBeTruthy();

    const current = state.getCurrentTree();
    expect(current).not.toBeNull();
    expect(state.nodes.has(current!.rootId)).toBe(true);
    expect(state.contextBox?.blocks).toEqual([
      { id: current!.rootId, kind: "node", nodeId: current!.rootId },
    ]);
  });

  it("creates nodes and builds context content", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const state = store.getState();
    const activeId = state.activeNodeId;
    expect(activeId).toBeTruthy();

    const userNode = await state.createNode({
      type: NodeType.USER,
      parentId: activeId!,
      content: "Hello",
    });
    const aiNode = await state.createNode({
      type: NodeType.ASSISTANT,
      parentId: userNode.id,
      content: "Hi there",
    });

    await state.addToContext(userNode.id);
    await state.addToContext(aiNode.id);

    const context = await store.getState().buildContextContent();
    expect(context).toContain("User: Hello");
    expect(context).toContain("Assistant: Hi there");
  });

  it("creates and switches trees", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const firstId = store.getState().currentTreeId;
    const secondId = await store.getState().createTree("Second");

    expect(secondId).not.toBe(firstId);
    expect(store.getState().currentTreeId).toBe(secondId);
    expect(store.getState().trees.size).toBe(2);
  });
});

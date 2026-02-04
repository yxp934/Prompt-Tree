import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { ContextBoxService } from "@/lib/services/contextBoxService";
import type { ILLMService } from "@/lib/services/llmService";
import { createAppStore } from "@/store/useStore";
import { NodeType } from "@/types";

describe("store slices", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("supports selection + update + recursive delete", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const tree = store.getState().getCurrentTree();
    expect(tree).not.toBeNull();

    const user = await store.getState().createNode({
      type: NodeType.USER,
      parentId: tree!.rootId,
      content: "hello",
    });
    const assistant = await store.getState().createNode({
      type: NodeType.ASSISTANT,
      parentId: user.id,
      content: "hi",
    });

    store.getState().toggleNodeSelection(user.id);
    expect(store.getState().selectedNodeIds).toEqual([user.id]);
    expect(store.getState().getSelectedNodes().map((n) => n.id)).toEqual([user.id]);

    const updated = await store.getState().updateNode(user.id, { content: "hello!!" });
    expect(updated.content).toBe("hello!!");
    expect(store.getState().nodes.get(user.id)?.content).toBe("hello!!");

    await store.getState().deleteNode(user.id);

    // deleteNode triggers a reload, so we should be back to root-only data.
    expect(store.getState().nodes.has(user.id)).toBe(false);
    expect(store.getState().nodes.has(assistant.id)).toBe(false);
    expect(store.getState().nodes.size).toBe(1);
  });

  it("supports context remove/clear and UI toggles", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const tree = store.getState().getCurrentTree();
    const rootId = tree!.rootId;

    const before = store.getState().contextBox?.blocks.length ?? 0;
    await store.getState().addToContext(rootId);
    expect(store.getState().contextBox?.blocks.length).toBe(before);

    const user = await store.getState().createNode({
      type: NodeType.USER,
      parentId: rootId,
      content: "hello",
    });

    await store.getState().addToContext(user.id);
    expect(store.getState().contextBox?.blocks.map((b) => b.id)).toContain(user.id);

    const user2 = await store.getState().createNode({
      type: NodeType.USER,
      parentId: rootId,
      content: "hello again",
    });

    const beforeInsert = store.getState().contextBox?.blocks.map((b) => b.id) ?? [];
    const insertAt = Math.max(0, beforeInsert.indexOf(user.id));
    await store.getState().addToContext(user2.id, insertAt);
    const afterInsert = store.getState().contextBox?.blocks.map((b) => b.id) ?? [];
    expect(afterInsert.indexOf(user2.id)).toBeLessThan(afterInsert.indexOf(user.id));

    await store.getState().addToContext("missing-node");

    store.getState().removeFromContext(user.id);
    expect(store.getState().contextBox?.blocks.map((b) => b.id)).not.toContain(user.id);

    store.getState().clearContext();
    expect(store.getState().contextBox?.blocks).toEqual([]);

    store.setState({ contextBox: null });
    await store.getState().addToContext(user.id);
    expect(store.getState().contextBox).toBeNull();
    store.getState().removeFromContext(user.id);
    store.getState().clearContext();

    const beforeSidebar = store.getState().sidebarOpen;
    store.getState().toggleSidebar();
    expect(store.getState().sidebarOpen).toBe(!beforeSidebar);

    const beforeTheme = store.getState().theme;
    store.getState().toggleTheme();
    expect(store.getState().theme).not.toBe(beforeTheme);
    store.getState().toggleTheme();
    expect(store.getState().theme).toBe(beforeTheme);
  });

  it("switches trees when deleting the current one", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const firstId = store.getState().currentTreeId;
    const secondId = await store.getState().createTree("Second");

    expect(store.getState().currentTreeId).toBe(secondId);
    await store.getState().deleteTree(secondId);
    expect(store.getState().currentTreeId).toBe(firstId);
  });

  it("deletes nodes even when no tree is loaded (no currentTreeId)", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });

    expect(store.getState().currentTreeId).toBeNull();
    expect(store.getState().getActiveNode()).toBeNull();
    expect(store.getState().getSelectedNodes()).toEqual([]);

    const node = await store.getState().createNode({
      type: NodeType.USER,
      parentId: null,
      content: "orphan",
    });
    expect(store.getState().nodes.has(node.id)).toBe(true);

    store.getState().setActiveNode(node.id);
    expect(store.getState().getActiveNode()?.id).toBe(node.id);

    store.getState().toggleNodeSelection(node.id);
    store.getState().toggleNodeSelection(node.id);
    expect(store.getState().selectedNodeIds).toEqual([]);

    store.setState({ selectedNodeIds: ["missing-id"] });
    expect(store.getState().getSelectedNodes()).toEqual([]);

    await store.getState().deleteNode(node.id);
    expect(store.getState().nodes.has(node.id)).toBe(false);
  });

  it("creates a fallback context box if missing in IndexedDB", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const contextBoxService = new ContextBoxService();
    const store = createAppStore({ llmService, contextBoxService });

    await store.getState().initialize();
    const id = store.getState().currentTreeId!;
    await contextBoxService.delete(id);

    await store.getState().loadTree(id);
    expect(store.getState().contextBox?.id).toBe(id);
    expect(store.getState().contextBox?.blocks.length).toBeGreaterThan(0);
  });

  it("deleting a non-current tree keeps currentTreeId unchanged", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const firstId = store.getState().currentTreeId!;
    const secondId = await store.getState().createTree("Second");

    await store.getState().loadTree(firstId);
    expect(store.getState().currentTreeId).toBe(firstId);

    await store.getState().deleteTree(secondId);
    expect(store.getState().currentTreeId).toBe(firstId);
  });

  it("deleting the last tree recreates a fresh one", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const oldId = store.getState().currentTreeId!;
    await store.getState().deleteTree(oldId);

    expect(store.getState().currentTreeId).not.toBe(oldId);
    expect(store.getState().trees.size).toBe(1);
  });

  it("sendMessage rejects empty input", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    await expect(store.getState().sendMessage("   ")).rejects.toThrow(
      /Message is empty/,
    );
  });

  it("sendMessage rejects when no tree is loaded", async () => {
    const llmService: ILLMService = { chat: vi.fn(async () => "ok") };
    const store = createAppStore({ llmService });

    await expect(store.getState().sendMessage("hi")).rejects.toThrow(
      /errors\.noActiveConversationTree/,
    );
  });
});

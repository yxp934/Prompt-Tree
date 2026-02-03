import { beforeEach, describe, expect, it } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { createAppStore } from "@/store/useStore";
import { NodeType } from "@/types";

describe("folders", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("creates folders and opens folder view", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const folderId = await store.getState().createFolder("VeryLongFolderName");
    const folder = store.getState().folders.get(folderId);

    expect(folder).toBeTruthy();
    expect(Array.from(folder!.name).length).toBeLessThanOrEqual(6);
    expect(store.getState().currentView).toBe("folder");
    expect(store.getState().currentFolderId).toBe(folderId);
    expect(store.getState().currentTreeId).toBeNull();
  });

  it("creates threads inside folders using the folder system prompt as the root node", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const folderId = await store.getState().createFolder("Work");
    await store.getState().updateFolderSystemPrompt(folderId, "SYSTEM: folder prompt");

    const treeId = await store.getState().createTreeInFolder(folderId, "Task 1");
    const tree = store.getState().trees.get(treeId);
    expect(tree?.folderId).toBe(folderId);

    const currentTree = store.getState().getCurrentTree();
    expect(currentTree?.id).toBe(treeId);

    const root = store.getState().nodes.get(currentTree!.rootId);
    expect(root?.type).toBe(NodeType.SYSTEM);
    expect(root?.content).toBe("SYSTEM: folder prompt");

    // Changing the folder prompt should update existing threads after reload.
    await store
      .getState()
      .updateFolderSystemPrompt(folderId, "SYSTEM: folder prompt v2");
    await store.getState().loadTree(treeId);

    const reloadedRoot = store.getState().nodes.get(store.getState().getCurrentTree()!.rootId);
    expect(reloadedRoot?.content).toBe("SYSTEM: folder prompt v2");
  });

  it("deletes folders without orphaning threads", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const folderId = await store.getState().createFolder("Work");
    const treeId = await store.getState().createTreeInFolder(folderId, "Task 1");

    expect(store.getState().folders.has(folderId)).toBe(true);
    expect(store.getState().trees.get(treeId)?.folderId).toBe(folderId);

    await store.getState().deleteFolder(folderId);

    expect(store.getState().folders.has(folderId)).toBe(false);
    expect(store.getState().trees.get(treeId)?.folderId ?? null).toBeNull();
  });

  it("returns to a loaded thread after deleting the active folder view", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    const originalTreeId = store.getState().currentTreeId;
    expect(originalTreeId).toBeTruthy();

    const folderId = await store.getState().createFolder("Work");
    expect(store.getState().currentView).toBe("folder");
    expect(store.getState().currentTreeId).toBeNull();

    await store.getState().deleteFolder(folderId);

    expect(store.getState().currentView).toBe("tree");
    expect(store.getState().currentTreeId).toBeTruthy();
  });
});

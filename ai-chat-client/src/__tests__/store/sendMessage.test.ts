import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import type { ChatParams, ILLMService } from "@/lib/services/llmService";
import { createAppStore } from "@/store/useStore";
import { NodeType } from "@/types";

describe("sendMessage flow", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("creates user + assistant nodes and updates active node", async () => {
    const chatMock = vi.fn(async (_params: ChatParams) => {
      return "Hi there!";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const assistantNode = await store.getState().sendMessage("Hello");

    expect(assistantNode.type).toBe(NodeType.ASSISTANT);
    expect(store.getState().activeNodeId).toBe(assistantNode.id);
    expect(store.getState().isSending).toBe(false);
    expect(store.getState().llmError).toBeNull();

    const nodes = store.getState().nodes;
    expect(nodes.size).toBeGreaterThanOrEqual(3);

    const contextBox = store.getState().contextBox;
    expect(contextBox?.nodeIds).toContain(assistantNode.id);

    expect(chatMock).toHaveBeenCalledOnce();
    const arg = chatMock.mock.calls[0]![0];
    expect(arg.messages.some((m) => m.role === "system")).toBe(true);
    expect(arg.messages.some((m) => m.role === "user")).toBe(true);
  });

  it("supports explicit context node ids", async () => {
    const chatMock = vi.fn(async (_params: ChatParams) => "ok");
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const tree = store.getState().getCurrentTree();
    const assistantNode = await store
      .getState()
      .sendMessage("Hello", [tree!.rootId]);

    expect(assistantNode.type).toBe(NodeType.ASSISTANT);
    expect(chatMock).toHaveBeenCalledOnce();
    const params = chatMock.mock.calls[0]![0];
    expect(params.messages.some((m) => m.role === "system")).toBe(true);
    expect(params.messages.some((m) => m.role === "user")).toBe(true);
  });
});

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
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
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

    expect(chatMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    const calls = chatMock.mock.calls.map((call) => call[0]);
    const messageCall = calls.find((params) =>
      params.messages.some((m) => m.role === "user" && m.content === "Hello"),
    );
    expect(messageCall).toBeDefined();
    expect(messageCall?.messages.some((m) => m.role === "system")).toBe(true);
  });

  it("supports explicit context node ids", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "ok";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const tree = store.getState().getCurrentTree();
    const assistantNode = await store
      .getState()
      .sendMessage("Hello", [tree!.rootId]);

    expect(assistantNode.type).toBe(NodeType.ASSISTANT);
    expect(chatMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    const calls = chatMock.mock.calls.map((call) => call[0]);
    const messageCall = calls.find((params) =>
      params.messages.some((m) => m.role === "user" && m.content === "Hello"),
    );
    expect(messageCall).toBeDefined();
    expect(messageCall?.messages.some((m) => m.role === "system")).toBe(true);
  });
});

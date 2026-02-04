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
    expect(contextBox?.blocks.map((b) => b.id)).toContain(assistantNode.id);

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

  it("creates assistant placeholders for multiple selected models", async () => {
    const deferred: Array<{ model: string | undefined; resolve: (value: string) => void }> = [];
    const chatMock = vi.fn(
      async (params: ChatParams) =>
        await new Promise<string>((resolve) => {
          deferred.push({ model: params.model, resolve });
        }),
    );
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    await store
      .getState()
      .updateTreeTitle(store.getState().currentTreeId!, "Multi model test");

    store.setState({
      providers: [
        {
          id: "p1",
          name: "Test Provider",
          baseUrl: "https://api.openai.com/v1",
          apiKeys: [{ id: "k1", value: "test-key", isPrimary: true }],
          models: [
            { id: "m1", name: "m1", enabled: true, supportsStreaming: false },
            { id: "m2", name: "m2", enabled: true, supportsStreaming: false },
            { id: "m3", name: "m3", enabled: true, supportsStreaming: false },
          ],
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      selectedModels: [
        { providerId: "p1", modelId: "m1" },
        { providerId: "p1", modelId: "m2" },
        { providerId: "p1", modelId: "m3" },
      ],
    });

    const pending = store.getState().sendMessage("Hello");

    const startedAt = Date.now();
    while (chatMock.mock.calls.length < 3) {
      if (Date.now() - startedAt > 2000) {
        throw new Error("Timed out waiting for chat requests");
      }
      await new Promise((r) => setTimeout(r, 5));
    }

    const assistantPlaceholders = Array.from(store.getState().nodes.values()).filter(
      (node) => node.type === NodeType.ASSISTANT,
    );
    expect(assistantPlaceholders).toHaveLength(3);
    expect(assistantPlaceholders.every((node) => node.content === "")).toBe(true);

    for (const item of deferred) {
      item.resolve(`ok:${item.model ?? "unknown"}`);
    }

    const lastAssistant = await pending;
    expect(lastAssistant.type).toBe(NodeType.ASSISTANT);

    const assistantContents = Array.from(store.getState().nodes.values())
      .filter((node) => node.type === NodeType.ASSISTANT)
      .map((node) => node.content);
    expect(assistantContents).toContain("ok:m1");
    expect(assistantContents).toContain("ok:m2");
    expect(assistantContents).toContain("ok:m3");
  });

  it("treats gemini models as vision-capable for image blocks", async () => {
    const chatMock = vi.fn(async (_params: ChatParams) => "ok");
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    store.setState({
      providers: [
        {
          id: "p1",
          name: "Gemini Provider",
          baseUrl: "https://example.com/v1",
          apiKeys: [{ id: "k1", value: "test-key", isPrimary: true }],
          models: [
            {
              id: "gemini3flash",
              name: "gemini3flash",
              enabled: true,
              category: "chat",
              supportsStreaming: false,
            },
          ],
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      selectedModels: [{ providerId: "p1", modelId: "gemini3flash" }],
    });

    const box = store.getState().contextBox!;
    store.setState({
      contextBox: {
        ...box,
        blocks: [
          ...box.blocks,
          {
            id: "file-1",
            kind: "file",
            fileKind: "image",
            filename: "image.webp",
            mimeType: "image/webp",
            dataUrl: "data:image/webp;base64,AAA",
            size: 3,
            createdAt: Date.now(),
            tokenCount: 0,
          },
        ],
      },
    });

    const assistantNode = await store.getState().sendMessage("Hello");
    expect(assistantNode.type).toBe(NodeType.ASSISTANT);
    expect(chatMock).toHaveBeenCalled();
    expect(store.getState().llmError).toBeNull();
  });

  it("rejects when all selected models lack vision support for image blocks", async () => {
    const chatMock = vi.fn(async (_params: ChatParams) => "ok");
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    store.setState({
      providers: [
        {
          id: "p1",
          name: "Chat-only Provider",
          baseUrl: "https://example.com/v1",
          apiKeys: [{ id: "k1", value: "test-key", isPrimary: true }],
          models: [
            {
              id: "gpt-3.5-turbo",
              name: "gpt-3.5-turbo",
              enabled: true,
              category: "chat",
              supportsStreaming: false,
            },
          ],
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      selectedModels: [{ providerId: "p1", modelId: "gpt-3.5-turbo" }],
    });

    const box = store.getState().contextBox!;
    store.setState({
      contextBox: {
        ...box,
        blocks: [
          ...box.blocks,
          {
            id: "file-1",
            kind: "file",
            fileKind: "image",
            filename: "image.webp",
            mimeType: "image/webp",
            dataUrl: "data:image/webp;base64,AAA",
            size: 3,
            createdAt: Date.now(),
            tokenCount: 0,
          },
        ],
      },
    });

    await expect(store.getState().sendMessage("Hello")).rejects.toThrow(
      /does not support vision/i,
    );
    expect(chatMock).not.toHaveBeenCalled();
  });
});

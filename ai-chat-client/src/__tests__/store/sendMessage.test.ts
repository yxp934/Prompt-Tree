import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import type { AgentRunParams, IAgentService } from "@/lib/services/agentService";
import { buildAutoMemoryBlockId } from "@/lib/services/longTermMemoryBlocks";
import { NodeService } from "@/lib/services/nodeService";
import type { ChatParams, ILLMService } from "@/lib/services/llmService";
import { MemoryBankService } from "@/lib/services/memoryBankService";
import { RECENT_MESSAGES_BLOCK_ID } from "@/lib/services/recentMessagesBlocks";
import { createAppStore } from "@/store/useStore";
import { NodeType, type ContextTextFileBlock } from "@/types";

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
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
    });

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
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
    });

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

  it("auto-injects recent messages into the first message of a new thread", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "ok";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    store.setState({
      longTermMemorySettings: {
        ...store.getState().longTermMemorySettings,
        enabled: true,
        autoInjectOnFirstMessage: false,
        enableProfileUpdates: false,
        enableFolderDocUpdates: false,
        enableMemoryUpdates: false,
        autoInjectRecentMessagesOnFirstMessage: true,
        autoInjectRecentMessagesCount: 3,
      },
    });

    const sourceTree = store.getState().getCurrentTree()!;
    const nodeService = new NodeService();
    const baseTs = Date.now();

    const user1 = await nodeService.create({
      type: NodeType.USER,
      parentId: sourceTree.rootId,
      content: "u1",
      createdAt: baseTs,
    });
    const assistant1 = await nodeService.create({
      type: NodeType.ASSISTANT,
      parentId: user1.id,
      content: "a1",
      createdAt: baseTs + 1,
    });
    const user2 = await nodeService.create({
      type: NodeType.USER,
      parentId: assistant1.id,
      content: "u2",
      createdAt: baseTs + 2,
    });
    const assistant2 = await nodeService.create({
      type: NodeType.ASSISTANT,
      parentId: user2.id,
      content: "a2",
      createdAt: baseTs + 3,
    });
    await nodeService.create({
      type: NodeType.USER,
      parentId: assistant2.id,
      content: "u3",
      createdAt: baseTs + 4,
    });

    await store.getState().createTree("New thread");

    const assistantNode = await store.getState().sendMessage("Hello new");
    expect(assistantNode.type).toBe(NodeType.ASSISTANT);

    const box = store.getState().contextBox!;
    const injected = box.blocks.find(
      (b): b is ContextTextFileBlock =>
        b.kind === "file" &&
        b.id === RECENT_MESSAGES_BLOCK_ID &&
        b.fileKind !== "image",
    );
    expect(injected?.content ?? "").toContain("u2");
    expect(injected?.content ?? "").toContain("a2");
    expect(injected?.content ?? "").toContain("u3");
    expect(injected?.content ?? "").not.toContain("u1");

    expect(chatMock).toHaveBeenCalled();
    const call = chatMock.mock.calls[0]?.[0];
    expect(call?.messages.some((m) => m.role === "system" && String(m.content).includes(RECENT_MESSAGES_BLOCK_ID))).toBe(true);
  });

  it("refreshes auto memory RAG blocks on every user message", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "ok";
    });
    const llmService: ILLMService = { chat: chatMock };
    const memoryBankService = new MemoryBankService();

    const store = createAppStore({ llmService, memoryBankService });
    await store.getState().initialize();
    store.setState({
      longTermMemorySettings: {
        ...store.getState().longTermMemorySettings,
        enabled: true,
        autoInjectOnFirstMessage: true,
        enableProfileUpdates: false,
        enableFolderDocUpdates: false,
        enableMemoryUpdates: false,
      },
    });

    const alpha = await memoryBankService.upsert({
      item: {
        text: "alphauniquezz preference detail",
        tags: ["alpha"],
        scope: "user",
      },
    });
    const beta = await memoryBankService.upsert({
      item: {
        text: "betauniquezz preference detail",
        tags: ["beta"],
        scope: "user",
      },
    });

    await store.getState().sendMessage("alphauniquezz");
    const afterFirst = store.getState().contextBox!;
    expect(afterFirst.blocks.some((b) => b.id === buildAutoMemoryBlockId(alpha.id))).toBe(true);
    expect(afterFirst.blocks.some((b) => b.id === buildAutoMemoryBlockId(beta.id))).toBe(false);

    await store.getState().sendMessage("betauniquezz");
    const afterSecond = store.getState().contextBox!;
    expect(afterSecond.blocks.some((b) => b.id === buildAutoMemoryBlockId(alpha.id))).toBe(false);
    expect(afterSecond.blocks.some((b) => b.id === buildAutoMemoryBlockId(beta.id))).toBe(true);
  });

  it("builds memory writer snapshot from latest memory state at job execution time", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "ok";
    });
    const llmService: ILLMService = { chat: chatMock };

    const systemPrompts: string[] = [];
    const agentRun = vi.fn(async (params: AgentRunParams) => {
      const prompt = String(params.messages[0]?.content ?? "");
      systemPrompts.push(prompt);
      if (systemPrompts.length === 1) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      return { content: "{}" };
    });
    const agentService: IAgentService = {
      run: agentRun,
    };

    const store = createAppStore({ llmService, agentService });
    await store.getState().initialize();

    const now = Date.now();
    store.setState({
      providers: [
        {
          id: "p1",
          name: "Writer Provider",
          baseUrl: "https://example.com/v1",
          apiKeys: [{ id: "k1", value: "test-key", isPrimary: true }],
          models: [{ id: "writer-model", name: "writer-model", enabled: true, supportsStreaming: false }],
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      longTermMemorySettings: {
        ...store.getState().longTermMemorySettings,
        enabled: true,
        autoInjectOnFirstMessage: true,
        autoInjectRecentMessagesOnFirstMessage: false,
        enableProfileUpdates: false,
        enableFolderDocUpdates: false,
        enableMemoryUpdates: true,
        forceFirstMessageMemoryUpsert: true,
        memoryWriterModel: { providerId: "p1", modelId: "writer-model" },
        embeddingModel: null,
      },
    });

    await store.getState().sendMessage("same-memory-seed");
    await store.getState().sendMessage("same-memory-seed followup");

    const started = Date.now();
    while (systemPrompts.length < 2) {
      if (Date.now() - started > 5000) {
        throw new Error("Timed out waiting for memory writer jobs");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(systemPrompts[1]).toContain("thread-first-message");
    expect(systemPrompts[1]).toContain("same-memory-seed");
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
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
    });

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
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "ok";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
    });

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
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "ok";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
    });

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

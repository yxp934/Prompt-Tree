import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import type { ChatParams, ILLMService } from "@/lib/services/llmService";
import { MemoryBankService } from "@/lib/services/memoryBankService";
import { UserProfileService } from "@/lib/services/userProfileService";
import { createAppStore } from "@/store/useStore";

describe("prompt optimizer", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("optimizes prompt with direct replacement payload", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "optimized prompt";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    store.getState().setLLMSettings({
      promptOptimizerPrompt: "custom optimizer prompt",
      promptOptimizerSmartMemory: false,
    });

    const result = await store.getState().optimizePrompt("Draft prompt text");
    expect(result).toBe("optimized prompt");

    const call = chatMock.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.messages[0]?.role).toBe("system");
    expect(call?.messages[0]?.content).toBe("custom optimizer prompt");
    expect(String(call?.messages[1]?.content)).toContain("<<<DRAFT");
    expect(String(call?.messages[1]?.content)).toContain("Draft prompt text");
    expect(String(call?.messages[1]?.content)).not.toContain("<<<SMART_MEMORY");
  });

  it("uses configured prompt optimizer model when provided", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "optimized";
    });
    const llmService: ILLMService = { chat: chatMock };
    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const now = Date.now();
    store.setState({
      providers: [
        {
          id: "p-opt",
          name: "Optimizer Provider",
          baseUrl: "https://example.com/v1",
          apiKeys: [{ id: "k-opt", value: "opt-key", isPrimary: true }],
          models: [{ id: "model-opt", name: "model-opt", enabled: true, supportsStreaming: false }],
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      selectedModels: [{ providerId: "p-opt", modelId: "model-selected-default" }],
    });

    store.getState().setLLMSettings({
      promptOptimizerModel: { providerId: "p-opt", modelId: "model-opt" },
    });

    await store.getState().optimizePrompt("Draft prompt");

    const call = chatMock.mock.calls[0]?.[0];
    expect(call?.model).toBe("model-opt");
    expect(call?.apiKey).toBe("opt-key");
    expect(call?.baseUrl).toBe("https://example.com/v1");
  });

  it("includes smart memory bundle when enabled", async () => {
    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "optimized with memory";
    });
    const llmService: ILLMService = { chat: chatMock };
    const memoryBankService = new MemoryBankService();
    const userProfileService = new UserProfileService();

    const store = createAppStore({ llmService, memoryBankService, userProfileService });
    await store.getState().initialize();

    await userProfileService.replaceData({
      identity: { name: "Alex" },
      preferences: { writingStyle: "concise" },
      constraints: [],
      goals: [],
      notes: [],
    });

    await memoryBankService.upsert({
      item: {
        text: "alpha-memory unique style preference",
        tags: ["style"],
        scope: "user",
      },
    });

    const tree = store.getState().getCurrentTree();
    await store.getState().upsertFileBlock(
      {
        id: "manual.context.block",
        kind: "file",
        fileKind: "markdown",
        filename: "Manual Context",
        mimeType: "text/markdown",
        createdAt: Date.now(),
        tokenCount: 8,
        content: "Context detail line for optimizer.",
        truncated: false,
      },
      tree!.rootId,
    );

    store.getState().setLLMSettings({
      promptOptimizerPrompt: "optimizer with smart memory",
      promptOptimizerSmartMemory: true,
    });

    await store.getState().optimizePrompt("alpha-memory");

    const call = chatMock.mock.calls[0]?.[0];
    const userPayload = String(call?.messages[1]?.content ?? "");
    expect(userPayload).toContain("<<<SMART_MEMORY");
    expect(userPayload).toContain("## User Profile");
    expect(userPayload).toContain("RAG Atomic Memories (Top 10)");
    expect(userPayload).toContain("alpha-memory unique style preference");
    expect(userPayload).toContain("## Context Snapshot");
    expect(userPayload).toContain("Context detail line for optimizer.");
  });

  it("prevents concurrent optimize requests", async () => {
    let releaseChat!: (value: string) => void;
    const pendingResponse = new Promise<string>((resolve) => {
      releaseChat = resolve;
    });
    const chatMock = vi.fn(
      async (params: ChatParams) => {
        void params;
        return pendingResponse;
      },
    );
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ llmService });
    await store.getState().initialize();

    const pending = store.getState().optimizePrompt("first");
    await expect(store.getState().optimizePrompt("second")).rejects.toThrow(
      "Prompt optimization is already running.",
    );

    releaseChat("done");
    await expect(pending).resolves.toBe("done");
    expect(store.getState().isOptimizingPrompt).toBe(false);
  });
});

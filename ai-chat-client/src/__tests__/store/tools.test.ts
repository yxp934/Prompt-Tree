import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import type { AgentRunParams, IAgentService } from "@/lib/services/agentService";
import type { ChatParams, ILLMService } from "@/lib/services/llmService";
import { createAppStore } from "@/store/useStore";
import { NodeType } from "@/types";
import { createModelConfig } from "@/types/provider";

describe("tool use flow", () => {
  beforeEach(async () => {
    await deleteDB();
  });

  it("routes tool-enabled messages through AgentService and persists toolUses + toolLogs", async () => {
    const agentRunMock = vi.fn(async (params: AgentRunParams) => {
      params.onEvent?.({ type: "assistant_delta", delta: "Hello" });
      params.onEvent?.({
        type: "tool_call",
        call: { id: "call_1", name: "web_search", arguments: { query: "x" } },
      });
      params.onEvent?.({
        type: "tool_result",
        callId: "call_1",
        name: "web_search",
        result: {
          provider: "tavily",
          query: "x",
          results: [],
          sources: [],
        },
      });
      params.onEvent?.({ type: "assistant_final", content: "Hello [1]" });
      return { content: "Hello [1]" };
    });
    const agentService: IAgentService = { run: agentRunMock };

    const chatMock = vi.fn(async (params: ChatParams) => {
      void params;
      return "should-not-be-called";
    });
    const llmService: ILLMService = { chat: chatMock };

    const store = createAppStore({ agentService, llmService });
    await store.getState().initialize();

    const tree = store.getState().getCurrentTree();
    await store.getState().updateTreeTitle(tree!.id, "Test Chat");

    const provider = store.getState().addProvider("Test Provider");
    store.getState().addApiKey(provider.id, "sk-test");
    store.getState().addModel(provider.id, createModelConfig("gpt-test"));
    store
      .getState()
      .setSelectedModels([{ providerId: provider.id, modelId: "gpt-test" }]);

    store.getState().setDraftToolUses(["web_search"]);
    const assistantNode = await store.getState().sendMessage("Hi");

    expect(chatMock).not.toHaveBeenCalled();
    expect(agentRunMock).toHaveBeenCalledTimes(1);

    const agentParams = agentRunMock.mock.calls[0]?.[0];
    expect(agentParams?.toolUses).toEqual(["web_search"]);
    expect(
      agentParams?.messages.some(
        (m) =>
          m.role === "system" &&
          typeof m.content === "string" &&
          m.content.includes("Citations (Perplexity-style):"),
      ),
    ).toBe(true);

    expect(assistantNode.type).toBe(NodeType.ASSISTANT);
    expect(assistantNode.metadata.toolLogs?.length).toBe(1);
    expect(assistantNode.metadata.toolLogs?.[0]?.id).toBe("call_1");
    expect(assistantNode.metadata.toolLogs?.[0]?.status).toBe("success");

    const userNode = store.getState().nodes.get(assistantNode.parentId ?? "");
    expect(userNode?.type).toBe(NodeType.USER);
    expect(userNode?.metadata.toolUses).toEqual(["web_search"]);

    store.getState().setDraftToolUses([]);
    store.getState().setActiveNode(userNode!.id);
    expect(store.getState().draftToolUses).toEqual(["web_search"]);
  });

  it("includes selected tool blocks in context preview", async () => {
    const store = createAppStore();
    await store.getState().initialize();

    store.getState().setDraftToolUses(["web_search"]);
    const context = await store.getState().buildContextContent();
    expect(context).toContain("Citations (Perplexity-style):");
  });
});

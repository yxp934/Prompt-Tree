import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { createAppStore } from "@/store/useStore";
import { NodeType } from "@/types";
import { createModelConfig } from "@/types/provider";

function createSseResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  const chunks = [
    ...events.map((event) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    encoder.encode("data: [DONE]\n\n"),
  ];
  let index = 0;

  return {
    ok: true,
    status: 200,
    headers: {
      get: (key: string) => (key.toLowerCase() === "content-type" ? "text/event-stream" : null),
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined as unknown as Uint8Array };
          const value = chunks[index++];
          return { done: false, value };
        },
      }),
    },
    json: async () => ({}),
    text: async () => "",
  };
}

describe("tool use flow", () => {
  beforeEach(async () => {
    await deleteDB();
    vi.unstubAllGlobals();
  });

  it("routes tool-enabled messages through agent-step loop and persists toolUses + toolLogs", async () => {
    let agentStepCalls = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);

      if (u === "/api/agent-step") {
        agentStepCalls += 1;
        if (agentStepCalls === 1) {
          // First step: request tool call.
          const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ role: string; content?: unknown }> };
          expect(body.messages?.some((m) => m.role === "system" && String(m.content ?? "").includes("Citations (Perplexity-style):"))).toBe(true);

          return createSseResponse([
            { type: "assistant_final", content: "Hello" },
            { type: "tool_call", call: { id: "call_1", name: "web_search", arguments: { query: "x" } } },
          ]) as unknown as Response;
        }
        // Second step: final answer, no tool calls.
        return createSseResponse([{ type: "assistant_final", content: "Hello [1]" }]) as unknown as Response;
      }

      if (u === "/api/tools/search") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ provider: "tavily", query: "x", results: [], sources: [] }),
          text: async () => "",
          headers: { get: () => "application/json" },
        } as unknown as Response;
      }

      throw new Error(`Unexpected fetch: ${u}`);
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const store = createAppStore();
    await store.getState().initialize();
    store.setState({
      longTermMemorySettings: { ...store.getState().longTermMemorySettings, enabled: false },
    });

    const tree = store.getState().getCurrentTree();
    await store.getState().updateTreeTitle(tree!.id, "Test Chat");

    const provider = store.getState().addProvider("Test Provider");
    store.getState().addApiKey(provider.id, "sk-test");
    store.getState().addModel(provider.id, createModelConfig("gpt-test"));
    store.getState().setSelectedModels([{ providerId: provider.id, modelId: "gpt-test" }]);

    store.getState().setDraftToolUses(["web_search"]);
    const assistantNode = await store.getState().sendMessage("Hi");

    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some((call) => String(call[0]) === "/api/agent-step")).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]) === "/api/tools/search")).toBe(true);

    expect(assistantNode.type).toBe(NodeType.ASSISTANT);
    expect(assistantNode.metadata.toolLogs?.length).toBe(1);
    expect(assistantNode.metadata.toolLogs?.[0]?.id).toBe("call_1");
    expect(assistantNode.metadata.toolLogs?.[0]?.tool).toBe("web_search");
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


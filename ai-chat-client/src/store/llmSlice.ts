import type { StateCreator } from "zustand";

import { NodeType, type ChatMessage, type Node } from "@/types";

import type { AppStoreDeps, AppStoreState } from "./useStore";

export interface LLMSlice {
  isSending: boolean;
  llmError: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  sendMessage: (content: string, contextNodeIds?: string[]) => Promise<Node>;
  compressNodes: (nodeIds: string[]) => Promise<Node>;
  generateSummary: (content: string) => Promise<string>;
}

function nodeToChatMessage(node: Node): ChatMessage | null {
  switch (node.type) {
    case NodeType.SYSTEM:
      return { role: "system", content: node.content };
    case NodeType.USER:
      return { role: "user", content: node.content };
    case NodeType.ASSISTANT:
      return { role: "assistant", content: node.content };
    case NodeType.COMPRESSED:
      return {
        role: "system",
        content: node.summary ? `[Compressed]\n${node.summary}` : node.content,
      };
  }
}

export function createLLMSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], LLMSlice> {
  return (set, get) => ({
    isSending: false,
    llmError: null,
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1024,
    sendMessage: async (content: string, contextNodeIds?: string[]) => {
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Message is empty.");

      const tree = get().getCurrentTree();
      if (!tree) throw new Error("No active conversation tree loaded.");

      set({ isSending: true, llmError: null });
      try {
        const parentId = get().activeNodeId ?? tree.rootId;
        const userNode = await deps.nodeService.create({
          type: NodeType.USER,
          parentId,
          content: trimmed,
        });

        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(userNode.id, userNode);
          return { nodes, activeNodeId: userNode.id };
        });

        await get().addToContext(userNode.id);

        const contextNodes: Node[] = contextNodeIds?.length
          ? (
              await Promise.all(
                contextNodeIds.map(
                  async (id) => get().nodes.get(id) ?? deps.nodeService.read(id),
                ),
              )
            ).filter((n): n is Node => Boolean(n))
          : await deps.nodeService.getPath(userNode.id);

        const messages: ChatMessage[] = [];
        for (const node of contextNodes) {
          const msg = nodeToChatMessage(node);
          if (msg) messages.push(msg);
        }

        const last = messages[messages.length - 1];
        if (!last || last.role !== "user" || last.content !== trimmed) {
          messages.push({ role: "user", content: trimmed });
        }

        const assistantText = await deps.llmService.chat({
          messages,
          model: get().model,
          temperature: get().temperature,
          maxTokens: get().maxTokens,
        });

        const assistantNode = await deps.nodeService.create({
          type: NodeType.ASSISTANT,
          parentId: userNode.id,
          content: assistantText,
        });

        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(assistantNode.id, assistantNode);
          return { nodes, activeNodeId: assistantNode.id };
        });

        await get().addToContext(assistantNode.id);

        if (get().currentTreeId) {
          const touched = await deps.treeService.touch(get().currentTreeId!);
          set((state) => {
            const trees = new Map(state.trees);
            trees.set(touched.id, touched);
            return { trees };
          });
        }

        return assistantNode;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";
        set({ llmError: message });
        throw err;
      } finally {
        set({ isSending: false });
      }
    },
    compressNodes: async () => {
      throw new Error("compressNodes() is not implemented yet.");
    },
    generateSummary: async () => {
      throw new Error("generateSummary() is not implemented yet.");
    },
  });
}

import type { StateCreator } from "zustand";

import { NodeType, type ChatMessage, type Node, type NodeMetaInstructions } from "@/types";
import {
  DEFAULT_LLM_SETTINGS,
  getStoredLLMSettings,
  normalizeLLMSettings,
  setStoredLLMSettings,
  type LLMSettings,
} from "@/lib/services/llmSettingsService";
import type { ProviderModelSelection } from "@/types/provider";

import type { AppStoreDeps, AppStoreState } from "./useStore";

export interface LLMSlice {
  isSending: boolean;
  llmError: string | null;
  isCompressing: boolean;
  compressionError: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  selectedModels: ProviderModelSelection[];
  setLLMSettings: (settings: Partial<LLMSettings>) => void;
  setSelectedModels: (models: ProviderModelSelection[]) => void;
  sendMessage: (content: string, contextNodeIds?: string[]) => Promise<Node>;
  compressNodes: (
    nodeIds: string[],
    options?: { summary?: string; metaInstructions?: NodeMetaInstructions },
  ) => Promise<Node>;
  decompressNode: (nodeId: string) => Promise<Node[]>;
  generateCompressionSuggestion: (nodeIds: string[]) => Promise<{
    summary: string;
    metaInstructions: NodeMetaInstructions;
  }>;
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
  const storedSettings = getStoredLLMSettings();
  const initialSettings = storedSettings ?? DEFAULT_LLM_SETTINGS;

  return (set, get) => ({
    isSending: false,
    llmError: null,
    isCompressing: false,
    compressionError: null,
    model: initialSettings.model,
    temperature: initialSettings.temperature,
    maxTokens: initialSettings.maxTokens,
    selectedModels: initialSettings.selectedModels,
    setLLMSettings: (settings) =>
      set((state) => {
        const next = normalizeLLMSettings(
          {
            model: settings.model ?? state.model,
            temperature: settings.temperature ?? state.temperature,
            maxTokens: settings.maxTokens ?? state.maxTokens,
            selectedModels: settings.selectedModels ?? state.selectedModels,
          },
          DEFAULT_LLM_SETTINGS,
        );
        setStoredLLMSettings(next);
        return next;
      }),
    setSelectedModels: (models) =>
      set((state) => {
        const next = normalizeLLMSettings(
          {
            model: state.model,
            temperature: state.temperature,
            maxTokens: state.maxTokens,
            selectedModels: models,
          },
          DEFAULT_LLM_SETTINGS,
        );
        setStoredLLMSettings(next);
        return { selectedModels: next.selectedModels };
      }),
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

        const resolvedContextIds =
          contextNodeIds?.length
            ? contextNodeIds
            : get().contextBox?.nodeIds?.length
              ? get().contextBox!.nodeIds
              : null;

        const contextNodes: Node[] = resolvedContextIds
          ? (
              await Promise.all(
                resolvedContextIds.map(
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
    compressNodes: async (nodeIds, options) => {
      const treeId = get().currentTreeId;
      if (!treeId) throw new Error("No active conversation tree loaded.");

      set({ isCompressing: true, compressionError: null });
      try {
        const compressed = await deps.compressionService.compress(nodeIds, {
          summary: options?.summary,
          metaInstructions: options?.metaInstructions,
        });

        await deps.treeService.touch(treeId);
        await get().loadTree(treeId);

        const box = get().contextBox;
        if (box) {
          const selected = new Set(nodeIds);
          const nextIds: string[] = [];
          let inserted = false;

          for (const id of box.nodeIds) {
            if (selected.has(id)) {
              if (!inserted) {
                nextIds.push(compressed.id);
                inserted = true;
              }
              continue;
            }
            nextIds.push(id);
          }

          const unique: string[] = [];
          const seen = new Set<string>();
          for (const id of nextIds) {
            if (!id || seen.has(id)) continue;
            if (!get().nodes.has(id)) continue;
            seen.add(id);
            unique.push(id);
          }

          if (inserted) {
            const totalTokens = unique.reduce(
              (sum, id) => sum + (get().nodes.get(id)?.tokenCount ?? 0),
              0,
            );

            const nextBox = { ...box, nodeIds: unique, totalTokens };
            set({ contextBox: nextBox });
            await deps.contextBoxService.put(nextBox);
          }
        }

        return compressed;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to compress nodes";
        set({ compressionError: message });
        throw err;
      } finally {
        set({ isCompressing: false });
      }
    },
    decompressNode: async (nodeId) => {
      const treeId = get().currentTreeId;
      if (!treeId) throw new Error("No active conversation tree loaded.");

      const priorBoxIds = get().contextBox?.nodeIds ?? [];

      set({ isCompressing: true, compressionError: null });
      try {
        const restored = await deps.compressionService.decompress(nodeId);
        const restoredIds = restored.map((n) => n.id);

        await deps.treeService.touch(treeId);
        await get().loadTree(treeId);

        const box = get().contextBox;
        if (box && priorBoxIds.includes(nodeId)) {
          const nextIds: string[] = [];
          for (const id of priorBoxIds) {
            if (id === nodeId) {
              nextIds.push(...restoredIds);
              continue;
            }
            nextIds.push(id);
          }

          const unique: string[] = [];
          const seen = new Set<string>();
          for (const id of nextIds) {
            if (!id || seen.has(id)) continue;
            if (!get().nodes.has(id)) continue;
            seen.add(id);
            unique.push(id);
          }

          const totalTokens = unique.reduce(
            (sum, id) => sum + (get().nodes.get(id)?.tokenCount ?? 0),
            0,
          );

          const nextBox = { ...box, nodeIds: unique, totalTokens };
          set({ contextBox: nextBox });
          await deps.contextBoxService.put(nextBox);
        }

        return restored;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to decompress node";
        set({ compressionError: message });
        throw err;
      } finally {
        set({ isCompressing: false });
      }
    },
    generateCompressionSuggestion: async (nodeIds) => {
      set({ isCompressing: true, compressionError: null });
      try {
        const nodes = await Promise.all(
          nodeIds.map(async (id) => get().nodes.get(id) ?? deps.nodeService.read(id)),
        ).then((items) => items.filter((n): n is Node => Boolean(n)));

        const suggestion = await deps.compressionService.generateSuggestion(
          deps.llmService,
          nodes,
          {
            model: get().model,
            temperature: 0.2,
            maxTokens: 512,
            responseFormat: { type: "json_object" },
          },
        );

        return suggestion;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate suggestion";
        set({ compressionError: message });
        throw err;
      } finally {
        set({ isCompressing: false });
      }
    },
    generateSummary: async (content) => {
      const prompt = [
        "You are a helpful assistant. Summarize the following content in 2-3 sentences.",
        "",
        content,
      ].join("\n");

      const text = await deps.llmService.chat({
        messages: [{ role: "user", content: prompt }],
        model: get().model,
        temperature: 0.2,
        maxTokens: 256,
      });

      return text.trim();
    },
  });
}

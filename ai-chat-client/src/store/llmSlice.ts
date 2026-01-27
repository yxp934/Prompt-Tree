import type { StateCreator } from "zustand";

import { NodeType, type ChatMessage, type Node, type NodeMetaInstructions } from "@/types";
import {
  DEFAULT_LLM_SETTINGS,
  getStoredLLMSettings,
  normalizeLLMSettings,
  setStoredLLMSettings,
  type LLMSettings,
} from "@/lib/services/llmSettingsService";
import { getPrimaryApiKey, type ProviderModelSelection } from "@/types/provider";

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
  compressionModel: ProviderModelSelection | null;
  summaryModel: ProviderModelSelection | null;
  setLLMSettings: (settings: Partial<LLMSettings>) => void;
  setSelectedModels: (models: ProviderModelSelection[]) => void;
  sendMessage: (content: string, contextNodeIds?: string[]) => Promise<Node>;
  retryAssistant: (nodeId: string) => Promise<Node>;
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

  return (set, get) => {
    const resolveSingleModelRequest = (
      selection: ProviderModelSelection | null,
    ): {
      modelId: string;
      modelName: string;
      providerId?: string;
      providerName?: string;
      apiKey?: string;
      baseUrl?: string;
    } => {
      const fallbackModel = get().model;
      if (!selection) {
        return { modelId: fallbackModel, modelName: fallbackModel };
      }

      const providers = get().providers;
      const provider = providers.find((item) => item.id === selection.providerId);
      if (!provider) {
        throw new Error("Selected model provider is missing.");
      }
      const primaryKey = getPrimaryApiKey(provider);
      if (!primaryKey) {
        throw new Error("Selected model is missing API key.");
      }

      const modelName = provider.name
        ? `${provider.name} · ${selection.modelId}`
        : selection.modelId;

      return {
        modelId: selection.modelId,
        modelName,
        providerId: provider.id,
        providerName: provider.name,
        apiKey: primaryKey.value,
        baseUrl: provider.baseUrl,
      };
    };

    const isDefaultTitle = (title: string): boolean =>
      title.trim().toLowerCase() === "new chat";

    const normalizeSummaryTitle = (text: string): string => {
      const cleaned = text.replace(/[\r\n]+/g, " ").trim();
      const stripped = cleaned.replace(/[，,。.!！?？；;：:"“”'‘’、()[\]{}]/g, "");
      const compact = stripped.replace(/\s+/g, "");
      return Array.from(compact).slice(0, 6).join("");
    };

    type ModelRequest = {
      modelId: string;
      modelName: string;
      providerId?: string;
      providerName?: string;
      apiKey?: string;
      baseUrl?: string;
      supportsStreaming?: boolean;
    };

    const getModelStreamingSupport = (
      providerId: string | undefined,
      modelId: string,
    ): boolean => {
      if (!providerId) return false;
      const provider = get().providers.find((item) => item.id === providerId);
      if (!provider) return false;
      const config = provider.models.find((model) => model.id === modelId);
      return config?.supportsStreaming ?? false;
    };

    const buildRequestFromSelection = (
      selection: ProviderModelSelection,
    ): ModelRequest | null => {
      const providers = get().providers;
      const provider = providers.find((item) => item.id === selection.providerId);
      if (!provider) return null;
      const primaryKey = getPrimaryApiKey(provider);
      if (!primaryKey) return null;
      const modelName = provider.name
        ? `${provider.name} · ${selection.modelId}`
        : selection.modelId;
      return {
        modelId: selection.modelId,
        modelName,
        providerId: provider.id,
        providerName: provider.name,
        apiKey: primaryKey.value,
        baseUrl: provider.baseUrl,
        supportsStreaming: getModelStreamingSupport(provider.id, selection.modelId),
      };
    };

    const updateStreamingContent = (nodeId: string, content: string) => {
      set((state) => {
        const nodes = new Map(state.nodes);
        const existing = nodes.get(nodeId);
        if (!existing) return state;
        nodes.set(nodeId, { ...existing, content });
        return { nodes };
      });
    };

    const runModelRequest = async (
      request: ModelRequest,
      parentId: string,
      messages: ChatMessage[],
    ): Promise<Node> => {
      if (request.supportsStreaming) {
        const assistantNode = await deps.nodeService.create({
          type: NodeType.ASSISTANT,
          parentId,
          content: "",
          metadata: {
            modelId: request.modelId,
            modelName: request.modelName,
            providerId: request.providerId,
            providerName: request.providerName,
          },
        });

        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(assistantNode.id, assistantNode);
          return { nodes };
        });

        let content = "";
        let lastFlush = 0;
        const flush = (force = false) => {
          const now = Date.now();
          if (!force && now - lastFlush < 50) return;
          lastFlush = now;
          updateStreamingContent(assistantNode.id, content);
        };

        try {
          await deps.llmService.chat({
            messages,
            model: request.modelId,
            temperature: get().temperature,
            maxTokens: get().maxTokens,
            apiKey: request.apiKey,
            baseUrl: request.baseUrl,
            stream: true,
            onToken: (delta) => {
              content += delta;
              flush();
            },
          });
        } catch (err) {
          if (!content) {
            await deps.nodeService.delete(assistantNode.id);
            set((state) => {
              const nodes = new Map(state.nodes);
              nodes.delete(assistantNode.id);
              return { nodes };
            });
          }
          throw err;
        }

        flush(true);
        const updated = await deps.nodeService.update(assistantNode.id, { content });
        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(updated.id, updated);
          return { nodes };
        });
        return updated;
      }

      const content = await deps.llmService.chat({
        messages,
        model: request.modelId,
        temperature: get().temperature,
        maxTokens: get().maxTokens,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
      });

      return deps.nodeService.create({
        type: NodeType.ASSISTANT,
        parentId,
        content,
        metadata: {
          modelId: request.modelId,
          modelName: request.modelName,
          providerId: request.providerId,
          providerName: request.providerName,
        },
      });
    };

    return {
      isSending: false,
      llmError: null,
      isCompressing: false,
      compressionError: null,
      model: initialSettings.model,
      temperature: initialSettings.temperature,
      maxTokens: initialSettings.maxTokens,
      selectedModels: initialSettings.selectedModels,
      compressionModel: initialSettings.compressionModel,
      summaryModel: initialSettings.summaryModel,
      setLLMSettings: (settings) =>
        set((state) => {
          const next = normalizeLLMSettings(
            {
              model: Object.prototype.hasOwnProperty.call(settings, "model")
                ? settings.model
                : state.model,
              temperature: Object.prototype.hasOwnProperty.call(settings, "temperature")
                ? settings.temperature
                : state.temperature,
              maxTokens: Object.prototype.hasOwnProperty.call(settings, "maxTokens")
                ? settings.maxTokens
                : state.maxTokens,
              selectedModels: Object.prototype.hasOwnProperty.call(
                settings,
                "selectedModels",
              )
                ? settings.selectedModels
                : state.selectedModels,
              compressionModel: Object.prototype.hasOwnProperty.call(
                settings,
                "compressionModel",
              )
                ? settings.compressionModel
                : state.compressionModel,
              summaryModel: Object.prototype.hasOwnProperty.call(
                settings,
                "summaryModel",
              )
                ? settings.summaryModel
                : state.summaryModel,
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
              compressionModel: state.compressionModel,
              summaryModel: state.summaryModel,
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

        if (isDefaultTitle(tree.title)) {
          void (async () => {
            try {
              const summary = await get().generateSummary(trimmed);
              const nextTitle = normalizeSummaryTitle(summary);
              if (!nextTitle) return;

              const latest = get().getCurrentTree();
              if (!latest || latest.id !== tree.id) return;
              if (!isDefaultTitle(latest.title)) return;

              const updated = await deps.treeService.updateTitle(tree.id, nextTitle);
              set((state) => {
                const trees = new Map(state.trees);
                trees.set(updated.id, updated);
                return { trees };
              });
            } catch {
              // ignore title generation errors
            }
          })();
        }

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

        const selectedModels = get().selectedModels;
        const requests = selectedModels
          .map((selection) => buildRequestFromSelection(selection))
          .filter((request): request is ModelRequest => Boolean(request));

        if (selectedModels.length > 0 && requests.length === 0) {
          throw new Error("Selected models are missing API keys or providers.");
        }

        if (requests.length === 0) {
          const fallbackModel = get().model;
          requests.push({
            modelId: fallbackModel,
            modelName: fallbackModel,
            supportsStreaming: false,
          });
        }

        const results = await Promise.allSettled(
          requests.map(async (request) => {
            const node = await runModelRequest(request, userNode.id, messages);
            return { request, node };
          }),
        );

        const assistantNodes: Node[] = [];
        const errors: string[] = [];

        for (const [index, result] of results.entries()) {
          const request = requests[index];
          if (result.status === "rejected") {
            const reason =
              result.reason instanceof Error ? result.reason.message : "Failed to send message";
            errors.push(`${request.modelName}: ${reason}`);
            continue;
          }
          assistantNodes.push(result.value.node);
        }

        if (assistantNodes.length === 0) {
          throw new Error(errors[0] ?? "Failed to send message");
        }

        set((state) => {
          const nodes = new Map(state.nodes);
          for (const node of assistantNodes) {
            nodes.set(node.id, node);
          }
          return {
            nodes,
            activeNodeId: assistantNodes[assistantNodes.length - 1]?.id ?? userNode.id,
          };
        });

        for (const node of assistantNodes) {
          await get().addToContext(node.id);
        }

        if (errors.length > 0) {
          set({ llmError: errors[0] });
        }

        if (get().currentTreeId) {
          const touched = await deps.treeService.touch(get().currentTreeId!);
          set((state) => {
            const trees = new Map(state.trees);
            trees.set(touched.id, touched);
            return { trees };
          });
        }

        return assistantNodes[assistantNodes.length - 1];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";
        set({ llmError: message });
        throw err;
      } finally {
        set({ isSending: false });
      }
    },
    retryAssistant: async (nodeId) => {
      const tree = get().getCurrentTree();
      if (!tree) throw new Error("No active conversation tree loaded.");

      const assistantNode =
        get().nodes.get(nodeId) ?? (await deps.nodeService.read(nodeId));
      if (!assistantNode || assistantNode.type !== NodeType.ASSISTANT) {
        throw new Error("Selected node is not an assistant message.");
      }

      const userNodeId = assistantNode.parentId;
      if (!userNodeId) {
        throw new Error("Assistant message has no parent user node.");
      }

      const userNode =
        get().nodes.get(userNodeId) ?? (await deps.nodeService.read(userNodeId));
      if (!userNode || userNode.type !== NodeType.USER) {
        throw new Error("Parent user node not found.");
      }

      set({ isSending: true, llmError: null });
      try {
        const resolvedContextIds = get().contextBox?.nodeIds?.length
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
        if (!last || last.role !== "user" || last.content !== userNode.content) {
          messages.push({ role: "user", content: userNode.content });
        }

        const request = (() => {
          const modelId = assistantNode.metadata.modelId ?? get().model;
          const providerId = assistantNode.metadata.providerId;
          if (!providerId) {
            return {
              modelId,
              modelName: assistantNode.metadata.modelName ?? modelId,
              supportsStreaming: false,
            } satisfies ModelRequest;
          }

          const provider = get().providers.find((item) => item.id === providerId);
          if (!provider) {
            throw new Error("Selected model provider is missing.");
          }
          const primaryKey = getPrimaryApiKey(provider);
          if (!primaryKey) {
            throw new Error("Selected model is missing API key.");
          }
          const modelName =
            assistantNode.metadata.modelName ??
            (provider.name ? `${provider.name} · ${modelId}` : modelId);

          return {
            modelId,
            modelName,
            providerId: provider.id,
            providerName: provider.name,
            apiKey: primaryKey.value,
            baseUrl: provider.baseUrl,
            supportsStreaming: getModelStreamingSupport(provider.id, modelId),
          } satisfies ModelRequest;
        })();
        const assistantReply = await runModelRequest(
          request,
          userNode.id,
          messages,
        );

        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(assistantReply.id, assistantReply);
          return {
            nodes,
            activeNodeId: assistantReply.id,
          };
        });

        await get().addToContext(assistantReply.id);

        if (get().currentTreeId) {
          const touched = await deps.treeService.touch(get().currentTreeId!);
          set((state) => {
            const trees = new Map(state.trees);
            trees.set(touched.id, touched);
            return { trees };
          });
        }

        return assistantReply;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to retry message";
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

        const request = resolveSingleModelRequest(get().compressionModel);
        const suggestion = await deps.compressionService.generateSuggestion(
          deps.llmService,
          nodes,
          {
            model: request.modelId,
            temperature: 0.2,
            maxTokens: 512,
            responseFormat: { type: "json_object" },
            apiKey: request.apiKey,
            baseUrl: request.baseUrl,
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
        "你是一个标题生成器。",
        "请根据下面的内容生成不超过6个汉字的主题标题。",
        "只输出标题本身，不要解释，不要标点。",
        "",
        content,
      ].join("\n");

      const selection = get().summaryModel ?? get().compressionModel;
      const request = resolveSingleModelRequest(selection ?? null);
      const text = await deps.llmService.chat({
        messages: [{ role: "user", content: prompt }],
        model: request.modelId,
        temperature: 0.2,
        maxTokens: 64,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
      });

      return text.trim();
    },
  };
};
}

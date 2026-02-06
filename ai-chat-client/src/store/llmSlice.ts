import type { StateCreator } from "zustand";

import {
  NodeType,
  type ChatMessage,
  type ContextBlock,
  type ContextTextFileBlock,
  type MemoryItem,
  type Node,
  type NodeMetaInstructions,
} from "@/types";
import { getOpenAIApiKey } from "@/lib/services/apiKeyService";
import { getOpenAIBaseUrlOrDefault } from "@/lib/services/apiUrlService";
import {
  DEFAULT_LLM_SETTINGS,
  getStoredLLMSettings,
  normalizeLLMSettings,
  setStoredLLMSettings,
  type LLMSettings,
} from "@/lib/services/llmSettingsService";
import { getPrimaryApiKey, type ProviderModelSelection } from "@/types/provider";
import { fileBlockToChatMessage, nodeToChatMessage } from "@/lib/services/chatMessageService";
import { injectToolInstructionMessages } from "@/lib/services/tools/toolInstructions";
import {
  LTM_PROFILE_BLOCK_ID,
  buildAutoMemoryBlockId,
  buildFolderDocContextBlock,
  buildFolderDocBlockId,
  buildMemoryContextBlock,
  buildPinnedMemoryBlockId,
  buildProfileContextBlock,
  isLongTermMemoryBlockId,
  parsePinnedMemoryBlockId,
} from "@/lib/services/longTermMemoryBlocks";
import { buildRecentMessagesContextBlock } from "@/lib/services/recentMessagesBlocks";
import {
  renderFolderDocMarkdown,
  renderUserProfileMarkdown,
} from "@/lib/services/longTermMemoryMarkdown";
import type { ToolCallLog, ToolSettings, ToolUseId } from "@/types";
import type { AgentMessage, AgentStreamEvent } from "@/types";
import {
  buildMemoryWriterSystemPrompt,
  safeParseMemoryWriterPlan,
} from "@/lib/services/memoryWriterService";

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
  hydrateLLMSettingsFromStorage: () => void;
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

export function createLLMSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], LLMSlice> {
  const initialSettings = DEFAULT_LLM_SETTINGS;

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
      return Array.from(compact).slice(0, 20).join("");
    };

    type ModelRequest = {
      modelId: string;
      modelName: string;
      providerId?: string;
      providerName?: string;
      apiKey?: string;
      baseUrl?: string;
      headers?: Record<string, string>;
      timeout?: number;
      supportsStreaming?: boolean;
      createdAt?: number;
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

    const getModelVisionSupport = (
      providerId: string | undefined,
      modelId: string,
    ): boolean => {
      const id = modelId.toLowerCase();
      const heuristic =
        id.includes("vision") ||
        id.includes("image") ||
        id.includes("gpt-4o") ||
        id.includes("claude-3") ||
        id.includes("gemini");

      if (!providerId) return heuristic;
      const provider = get().providers.find((item) => item.id === providerId);
      const config = provider?.models.find((m) => m.id === modelId);
      if (!config?.category) return heuristic;
      return config.category === "vision" || heuristic;
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
        headers: provider.headers,
        timeout: provider.timeout,
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

    const updateToolLogs = (nodeId: string, logs: ToolCallLog[]) => {
      set((state) => {
        const nodes = new Map(state.nodes);
        const existing = nodes.get(nodeId);
        if (!existing) return state;
        nodes.set(nodeId, {
          ...existing,
          metadata: { ...existing.metadata, toolLogs: logs },
        });
        return { nodes };
      });
    };

    let memoryWriterQueue: Promise<void> = Promise.resolve();

    const enqueueMemoryWriterJob = (job: () => Promise<void>) => {
      memoryWriterQueue = memoryWriterQueue.then(job).catch((err) => {
        // Avoid crashing the send pipeline; memory writing is best-effort.
        console.warn("MemoryWriterJob failed:", err);
      });
    };

    const buildContextMemorySnapshotMarkdown = (blocks: ContextBlock[]): string => {
      const memoryBlocks = blocks.filter(
        (b): b is ContextTextFileBlock =>
          b.kind === "file" && b.fileKind !== "image" && isLongTermMemoryBlockId(b.id),
      );
      if (memoryBlocks.length === 0) return "";

      return memoryBlocks
        .map((block) => [`## ${block.filename} (${block.id})`, "", block.content].join("\n"))
        .join("\n\n---\n\n");
    };

    const searchRelevantMemories = async (params: {
      query: string;
      folderId: string | null;
    }): Promise<MemoryItem[]> => {
      const query = params.query.trim();
      if (!query) return [];

      const settings = get().longTermMemorySettings;
      const embeddingSelection = settings.embeddingModel;
      const embeddingRes =
        embeddingSelection && query
          ? await deps.embeddingService.embedWithSelection({
              providers: get().providers,
              selection: embeddingSelection,
              text: query,
            })
          : null;
      const queryEmbedding = embeddingRes?.embedding ?? null;
      const embeddingModelKey = embeddingRes?.embeddingModelKey ?? null;

      const folder = params.folderId ? get().folders.get(params.folderId) ?? null : null;
      const topKFolder = folder?.memoryRag?.topKFolder ?? 5;
      const topKUser = params.folderId ? (folder?.memoryRag?.topKUser ?? 5) : 10;

      const folderHits =
        params.folderId && topKFolder > 0
          ? await deps.memoryBankService.search({
              query,
              topK: topKFolder,
              scope: "folder",
              folderId: params.folderId,
              queryEmbedding,
              embeddingModelKey,
            })
          : [];
      const userHits =
        topKUser > 0
          ? await deps.memoryBankService.search({
              query,
              topK: topKUser,
              scope: "user",
              queryEmbedding,
              embeddingModelKey,
            })
          : [];

      const combined: MemoryItem[] = [];
      const seen = new Set<string>();
      for (const hit of [...folderHits, ...userHits]) {
        if (seen.has(hit.id)) continue;
        seen.add(hit.id);
        const { score: _score, ...item } = hit;
        combined.push(item);
      }
      return combined;
    };

    const buildLiveMemoryWriterSnapshotMarkdown = async (params: {
      treeId: string;
      folderId: string | null;
      latestUserText: string;
    }): Promise<string> => {
      const persistedBox = await deps.contextBoxService.read(params.treeId);
      const fallbackBlocks =
        get().currentTreeId === params.treeId ? (get().contextBox?.blocks ?? []) : [];
      const contextBlocks = persistedBox?.blocks ?? fallbackBlocks;

      const ltmTextBlocks = contextBlocks.filter(
        (block): block is ContextTextFileBlock =>
          block.kind === "file" && block.fileKind !== "image" && isLongTermMemoryBlockId(block.id),
      );

      const nonMemoryBlocks: ContextTextFileBlock[] = [];
      const memoryMeta = new Map<string, { pinned: boolean; createdAt: number }>();

      for (const block of ltmTextBlocks) {
        const parsed = parsePinnedMemoryBlockId(block.id);
        if (!parsed) {
          nonMemoryBlocks.push(block);
          continue;
        }
        const existing = memoryMeta.get(parsed.memoryId);
        if (!existing) {
          memoryMeta.set(parsed.memoryId, { pinned: parsed.pinned, createdAt: block.createdAt });
          continue;
        }
        memoryMeta.set(parsed.memoryId, {
          pinned: existing.pinned || parsed.pinned,
          createdAt: Math.max(existing.createdAt, block.createdAt),
        });
      }

      const searched = await searchRelevantMemories({
        query: params.latestUserText,
        folderId: params.folderId,
      });
      const merged = new Map<string, MemoryItem>(searched.map((item) => [item.id, item]));
      const missingFromContext = Array.from(memoryMeta.keys()).filter((id) => !merged.has(id));
      if (missingFromContext.length > 0) {
        const contextItems = await deps.memoryBankService.getByIds(missingFromContext);
        for (const item of contextItems) {
          merged.set(item.id, item);
        }
      }

      const refreshedMemoryBlocks = Array.from(merged.values()).map((item) => {
        const meta = memoryMeta.get(item.id);
        return buildMemoryContextBlock({
          item,
          pinned: meta?.pinned ?? false,
          createdAt: meta?.createdAt,
        });
      });

      return buildContextMemorySnapshotMarkdown([...nonMemoryBlocks, ...refreshedMemoryBlocks]);
    };

    const runMemoryWriterJob = async (params: {
      treeId: string;
      folderId: string | null;
      latestUserNodeId: string;
      latestUserCreatedAt: number;
      latestUserText: string;
      isFirstUserMessageInThread: boolean;
    }) => {
      const settings = get().longTermMemorySettings;
      if (!settings.enabled) return;

      const updatesEnabled =
        settings.enableProfileUpdates || settings.enableFolderDocUpdates || settings.enableMemoryUpdates;
      if (!updatesEnabled) return;

      const treeMeta = get().trees.get(params.treeId) ?? null;
      const anchorNodeId = treeMeta?.rootId ?? null;
      const isCurrentTree = get().currentTreeId === params.treeId;

      const folderId = params.folderId ?? null;
      const isFolderThread = Boolean(folderId);
      const contextMemorySnapshotMarkdown = await buildLiveMemoryWriterSnapshotMarkdown({
        treeId: params.treeId,
        folderId,
        latestUserText: params.latestUserText,
      });

      const systemPrompt = buildMemoryWriterSystemPrompt({
        isFirstUserMessageInThread: params.isFirstUserMessageInThread,
        isFolderThread,
        folderId,
        forceFirstMessageMemoryUpsert: settings.forceFirstMessageMemoryUpsert,
        forceFirstMessageFolderDocUpsert: settings.forceFirstMessageFolderDocUpsert,
        enableProfileUpdates: settings.enableProfileUpdates,
        enableFolderDocUpdates: settings.enableFolderDocUpdates,
        enableMemoryUpdates: settings.enableMemoryUpdates,
        contextMemorySnapshotMarkdown,
      });

      const { nodes } = await deps.treeService.loadTreeNodes(params.treeId);
      const userNodes = nodes
        .filter((n) => n.type === NodeType.USER)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt);

      const userBundle = (() => {
        const lines: string[] = [];
        lines.push("Thread USER messages (chronological):");
        for (const [index, n] of userNodes.entries()) {
          const isLatest = n.id === params.latestUserNodeId;
          lines.push("");
          lines.push(
            `${index + 1}. nodeId=${n.id} createdAt=${new Date(n.createdAt).toISOString()}${isLatest ? " [LATEST]" : ""}`,
          );
          lines.push(n.content);
        }
        return lines.join("\n").trim();
      })();

      const memoryWriterSelection = settings.memoryWriterModel;
      const request: ModelRequest = (() => {
        if (memoryWriterSelection) {
          const resolved = buildRequestFromSelection(memoryWriterSelection);
          if (!resolved) {
            throw new Error("Memory writer model is missing provider/apiKey configuration.");
          }
          return resolved;
        }
        const fallbackModel = get().model;
        return { modelId: fallbackModel, modelName: fallbackModel };
      })();

      const apiKey = request.apiKey ?? getOpenAIApiKey();
      if (!apiKey) throw new Error("errors.missingOpenAIApiKey");
      const baseUrl = request.baseUrl ?? getOpenAIBaseUrlOrDefault();

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userBundle },
      ];

      const res = await deps.agentService.run({
        apiKey,
        baseUrl,
        headers: request.headers,
        timeout: request.timeout,
        model: request.modelId,
        temperature: 0.2,
        maxTokens: 1200,
        messages,
        toolUses: [],
        toolSettings: get().toolSettings,
        stream: false,
      });

      let plan = safeParseMemoryWriterPlan(res.content);

      const isFirst = params.isFirstUserMessageInThread;
      const forceMemory = isFirst && settings.forceFirstMessageMemoryUpsert && settings.enableMemoryUpdates;
      const forceFolder =
        isFolderThread && isFirst && settings.forceFirstMessageFolderDocUpsert && settings.enableFolderDocUpdates;

      if (forceMemory && (!plan.memoryUpserts || plan.memoryUpserts.length === 0)) {
        plan = {
          ...plan,
          memoryUpserts: [
            {
              text: `User started a new thread with: ${params.latestUserText.trim().slice(0, 240)}`,
              tags: ["thread-first-message"],
              scope: "user",
              confidence: "low",
            },
          ],
        };
      }

      if (forceFolder && (!plan.folderDocPatch || plan.folderDocPatch.length === 0)) {
        plan = {
          ...plan,
          folderDocPatch: [
            {
              op: "set",
              path: "/summary",
              value: `Updated on first message of thread ${params.treeId}. Latest: ${params.latestUserText.trim().slice(0, 240)}`,
            },
          ],
        };
      }

      if (settings.enableProfileUpdates && plan.profilePatch?.length) {
        await deps.userProfileService.patch(plan.profilePatch);

        const box = get().contextBox;
        const hasProfileBlock = box?.blocks.some((b) => b.id === LTM_PROFILE_BLOCK_ID) ?? false;
        if (hasProfileBlock && isCurrentTree && anchorNodeId) {
          const profile = await deps.userProfileService.read();
          await get().upsertFileBlock(
            buildProfileContextBlock(renderUserProfileMarkdown(profile)),
            anchorNodeId,
          );
        }
      }

      if (settings.enableFolderDocUpdates && folderId && plan.folderDocPatch?.length) {
        await deps.folderDocService.patch(folderId, plan.folderDocPatch);

        const folderBlockId = buildFolderDocBlockId(folderId);
        const box = get().contextBox;
        const hasFolderDocBlock = box?.blocks.some((b) => b.id === folderBlockId) ?? false;
        if (hasFolderDocBlock && isCurrentTree && anchorNodeId) {
          const doc = await deps.folderDocService.read(folderId);
          await get().upsertFileBlock(
            buildFolderDocContextBlock({ folderId, markdown: renderFolderDocMarkdown(doc) }),
            anchorNodeId,
          );
        }
      }

      if (settings.enableMemoryUpdates && plan.memoryUpserts?.length) {
        const upserts = plan.memoryUpserts
          .filter((item) => (item.scope === "folder" ? Boolean(item.folderId?.trim()) : true))
          .filter((item) => (item.scope === "folder" ? isFolderThread : true));

        const source = {
          treeId: params.treeId,
          nodeId: params.latestUserNodeId,
          createdAt: params.latestUserCreatedAt,
        };

        const embeddingSelection = settings.embeddingModel;
        const embedBatch =
          embeddingSelection && upserts.length > 0
            ? await deps.embeddingService.embedBatchWithSelection({
                providers: get().providers,
                selection: embeddingSelection,
                texts: upserts.map((u) => u.text),
              })
            : null;

        for (const [index, item] of upserts.entries()) {
          const embedding = embedBatch?.embeddings?.[index] ?? null;
          const embeddingModelKey = embedBatch?.embeddingModelKey ?? null;
          await deps.memoryBankService.upsert({
            item,
            source,
            embedding,
            embeddingModelKey,
          });
        }
      }
    };

    const runModelRequest = async (
      request: ModelRequest,
      parentId: string,
      messages: ChatMessage[],
      toolUses: ToolUseId[],
      toolSettings: ToolSettings,
    ): Promise<Node> => {
      const longTermMemorySettings = get().longTermMemorySettings;
      const memoryToolAllowed =
        longTermMemorySettings.enabled && longTermMemorySettings.enableMemorySearchTool;
      const normalizedToolUses = memoryToolAllowed
        ? toolUses
        : toolUses.filter((id) => id !== "search_memory");
      const usesTools = normalizedToolUses.length > 0;

      if (usesTools) {
        const assistantNode = await deps.nodeService.create({
          type: NodeType.ASSISTANT,
          parentId,
          ...(typeof request.createdAt === "number" ? { createdAt: request.createdAt } : {}),
          content: "",
          metadata: {
            tags: [],
            metaInstructions: {},
            modelId: request.modelId,
            modelName: request.modelName,
            providerId: request.providerId,
            providerName: request.providerName,
            toolLogs: [],
          },
        });

        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(assistantNode.id, assistantNode);
          return { nodes };
        });

        let content = "";
        let toolLogs: ToolCallLog[] = [];
        let agentError: string | null = null;
        let lastFlush = 0;
        const flush = (force = false) => {
          const now = Date.now();
          if (!force && now - lastFlush < 50) return;
          lastFlush = now;
          updateStreamingContent(assistantNode.id, content);
          updateToolLogs(assistantNode.id, toolLogs);
        };

        const nowMs = () => Date.now();
        const upsertLog = (log: ToolCallLog) => {
          const existingIndex = toolLogs.findIndex((l) => l.id === log.id);
          if (existingIndex >= 0) {
            toolLogs = toolLogs.slice();
            toolLogs[existingIndex] = log;
          } else {
            toolLogs = [...toolLogs, log];
          }
        };

        try {
          const toolMessages = injectToolInstructionMessages(messages, normalizedToolUses, toolSettings);

          const apiKey = request.apiKey ?? getOpenAIApiKey();
          if (!apiKey) {
            throw new Error("errors.missingOpenAIApiKey");
          }
          const baseUrl = request.baseUrl ?? getOpenAIBaseUrlOrDefault();

          type AgentToolCall = { id: string; name: string; arguments: unknown };
          const safeJsonStringify = (value: unknown): string => {
            try {
              return JSON.stringify(value);
            } catch {
              return JSON.stringify({ error: "Unserializable payload." });
            }
          };

          const isRecord = (value: unknown): value is Record<string, unknown> =>
            typeof value === "object" && value !== null;
          const normalizeString = (value: unknown): string => (typeof value === "string" ? value : "");
          const normalizeNumber = (value: unknown): number | null =>
            typeof value === "number" && Number.isFinite(value) ? value : null;

          const buildEnabledMcpServers = (): { serverIdSet: Set<string>; byId: Map<string, unknown> } => {
            const all = toolSettings.mcp.servers.slice();
            const enabled = (() => {
              if (normalizedToolUses.includes("mcp")) return all;
              const byId = new Map(all.map((s) => [s.id, s] as const));
              const ids = normalizedToolUses
                .filter((id) => id.startsWith("mcp:"))
                .map((id) => id.slice("mcp:".length).trim())
                .filter(Boolean);
              const seen = new Set<string>();
              const out: typeof all = [];
              for (const id of ids) {
                if (seen.has(id)) continue;
                seen.add(id);
                const server = byId.get(id);
                if (server) out.push(server);
              }
              return out;
            })();
            return {
              serverIdSet: new Set(enabled.map((s) => s.id)),
              byId: new Map(all.map((s) => [s.id, s] as const)),
            };
          };

          const enabledMcp = buildEnabledMcpServers();

          const runSearchMemory = async (args: unknown): Promise<unknown> => {
            const query = isRecord(args) ? normalizeString(args.query) : "";
            const rawTopK = isRecord(args) ? normalizeNumber(args.topK) : null;
            const topK = Math.max(1, Math.min(20, Math.round(rawTopK ?? 10)));
            const scope =
              isRecord(args) && (args.scope === "user" || args.scope === "folder" || args.scope === "both")
                ? (args.scope as "user" | "folder" | "both")
                : "both";
            const tagsAny = isRecord(args) && Array.isArray(args.tagsAny)
              ? args.tagsAny.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean)
              : [];
            const normalizeTimeMs = (value: unknown): number | null => {
              const num = normalizeNumber(value);
              if (num != null) {
                return num > 0 && num < 1e12 ? Math.round(num * 1000) : Math.round(num);
              }
              if (typeof value !== "string") return null;
              const s = value.trim();
              if (!s) return null;
              const asNum = Number(s);
              if (Number.isFinite(asNum) && /^[0-9]+(\.[0-9]+)?$/.test(s)) {
                return asNum > 0 && asNum < 1e12 ? Math.round(asNum * 1000) : Math.round(asNum);
              }
              const parsed = Date.parse(s);
              if (!Number.isFinite(parsed)) return null;
              return parsed;
            };
            const timeFrom = isRecord(args) ? normalizeTimeMs(args.timeFrom) : null;
            const timeTo = isRecord(args) ? normalizeTimeMs(args.timeTo) : null;

            const currentTree = get().getCurrentTree();
            const currentFolderId = currentTree?.folderId ?? null;
            const folderIdArg = isRecord(args) ? normalizeString(args.folderId).trim() : "";
            const folderId =
              scope === "user"
                ? null
                : folderIdArg || currentFolderId || null;

            const embeddingSelection = get().longTermMemorySettings.embeddingModel;
            const embeddingRes =
              embeddingSelection && query.trim()
                ? await deps.embeddingService.embedWithSelection({
                    providers: get().providers,
                    selection: embeddingSelection,
                    text: query,
                  })
                : null;

            const queryEmbedding = embeddingRes?.embedding ?? null;
            const embeddingModelKey = embeddingRes?.embeddingModelKey ?? null;

            const hits = await deps.memoryBankService.search({
              query,
              topK,
              scope,
              folderId,
              tagsAny,
              queryEmbedding,
              embeddingModelKey,
              timeFrom,
              timeTo,
            });

            const anchorNodeId = currentTree?.rootId ?? null;
            const box = get().contextBox;
            if (box && anchorNodeId) {
              const existingIds = new Set(box.blocks.map((b) => b.id));
              for (const item of hits) {
                const pinnedId = buildPinnedMemoryBlockId(item.id);
                const autoId = buildAutoMemoryBlockId(item.id);
                const alreadyPinned = existingIds.has(pinnedId);
                const alreadyAuto = existingIds.has(autoId);

                const finalBlock = buildMemoryContextBlock({
                  item,
                  pinned: alreadyPinned,
                });

                // Prefer pinned version if duplicates exist.
                if (alreadyPinned && alreadyAuto) {
                  get().removeFromContext(autoId);
                  existingIds.delete(autoId);
                }

                await get().upsertFileBlock(finalBlock, anchorNodeId);
                existingIds.add(finalBlock.id);
              }
            }

            return {
              query,
              topK,
              scope,
              folderId,
              timeFrom,
              timeTo,
              hits: hits.map((h) => ({
                id: h.id,
                text: h.text,
                tags: h.tags,
                scope: h.scope,
                folderId: h.folderId ?? null,
                confidence: h.confidence,
                score: h.score,
                createdAt: h.createdAt,
                updatedAt: h.updatedAt,
              })),
            };
          };

          const executeTool = async (call: AgentToolCall): Promise<unknown> => {
            const name = call.name;
            const args = call.arguments;

            if (name === "search_memory") {
              return runSearchMemory(args);
            }

            if (name === "web_search") {
              const query = isRecord(args) ? normalizeString(args.query) : "";
              const provider =
                isRecord(args) && args.provider === "exa"
                  ? "exa"
                  : isRecord(args) && args.provider === "tavily"
                    ? "tavily"
                    : toolSettings.search.provider;
              const maxResults =
                (isRecord(args) ? normalizeNumber(args.maxResults) : null) ?? toolSettings.search.maxResults;
              const searchDepth =
                isRecord(args) && args.searchDepth === "advanced"
                  ? "advanced"
                  : isRecord(args) && args.searchDepth === "basic"
                    ? "basic"
                    : toolSettings.search.searchDepth;
              const apiKey = provider === "exa" ? toolSettings.search.exaApiKey : toolSettings.search.tavilyApiKey;

              const response = await fetch("/api/tools/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider, apiKey, query, maxResults, searchDepth }),
              });
              const json = (await response.json().catch(() => null)) as unknown;
              if (!response.ok) {
                const message = isRecord(json) && "error" in json ? String(json.error ?? "") : "";
                throw new Error(message || `web_search failed (${response.status})`);
              }
              return json;
            }

            if (name === "exec_python") {
              const code = isRecord(args) ? normalizeString(args.code) : "";
              const response = await fetch("/api/tools/python", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code,
                  timeoutMs: toolSettings.python.timeoutMs,
                  maxOutputChars: toolSettings.python.maxOutputChars,
                  pythonCommand: toolSettings.python.pythonCommand,
                }),
              });
              const json = (await response.json().catch(() => null)) as unknown;
              if (!response.ok) {
                const message = isRecord(json) && "error" in json ? String(json.error ?? "") : "";
                throw new Error(message || `exec_python failed (${response.status})`);
              }
              return json;
            }

            if (name === "mcp_list_tools") {
              const serverId = isRecord(args) ? normalizeString(args.serverId).trim() : "";
              if (!serverId || !enabledMcp.serverIdSet.has(serverId)) {
                throw new Error(`MCP server not enabled: ${serverId || "(missing)"}`);
              }
              const server = enabledMcp.byId.get(serverId) as unknown;
              const response = await fetch("/api/tools/mcp/list-tools", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ server }),
              });
              const json = (await response.json().catch(() => null)) as unknown;
              if (!response.ok) {
                const message = isRecord(json) && "error" in json ? String(json.error ?? "") : "";
                throw new Error(message || `mcp_list_tools failed (${response.status})`);
              }
              return json;
            }

            if (name === "mcp_call") {
              const serverId = isRecord(args) ? normalizeString(args.serverId).trim() : "";
              const toolName = isRecord(args) ? normalizeString(args.name) : "";
              const toolArgs = isRecord(args) ? args.arguments : undefined;
              if (!serverId || !enabledMcp.serverIdSet.has(serverId)) {
                throw new Error(`MCP server not enabled: ${serverId || "(missing)"}`);
              }
              if (!toolName.trim()) {
                throw new Error("Missing MCP tool name.");
              }
              const server = enabledMcp.byId.get(serverId) as unknown;
              const response = await fetch("/api/tools/mcp/call-tool", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ server, name: toolName, arguments: toolArgs }),
              });
              const json = (await response.json().catch(() => null)) as unknown;
              if (!response.ok) {
                const message = isRecord(json) && "error" in json ? String(json.error ?? "") : "";
                throw new Error(message || `mcp_call failed (${response.status})`);
              }
              return json;
            }

            throw new Error(`Unknown tool: ${name}`);
          };

          const toAgentMessages = (input: ChatMessage[]): AgentMessage[] =>
            input
              .map((m): AgentMessage | null => {
                if (m.role === "system") {
                  return typeof m.content === "string"
                    ? { role: "system", content: m.content }
                    : { role: "system", content: "" };
                }
                if (m.role === "assistant") {
                  return typeof m.content === "string"
                    ? { role: "assistant", content: m.content }
                    : { role: "assistant", content: "" };
                }
                if (m.role === "user") {
                  if (typeof m.content === "string") return { role: "user", content: m.content };
                  if (Array.isArray(m.content)) return { role: "user", content: m.content };
                  return { role: "user", content: "" };
                }
                return null;
              })
              .filter((m): m is AgentMessage => Boolean(m));

          const runAgentStep = async (
            conversation: AgentMessage[],
          ): Promise<{ assistantContent: string; toolCalls: AgentToolCall[] }> => {
            const response = await fetch("/api/agent-step", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                apiKey,
                baseUrl,
                headers: request.headers,
                timeout: request.timeout,
                model: request.modelId,
                temperature: get().temperature,
                maxTokens: get().maxTokens,
                messages: conversation,
                toolUses: normalizedToolUses,
                toolSettings,
                stream: Boolean(request.supportsStreaming),
              }),
            });

            if (!response.ok) {
              const text = await response.text().catch(() => "");
              throw new Error(`Agent step failed (${response.status}): ${text}`);
            }

            const contentType = response.headers.get("content-type") ?? "";
            if (!response.body || contentType.includes("application/json")) {
              const json = (await response.json().catch(() => null)) as unknown;
              if (isRecord(json) && typeof json.error === "string" && json.error.trim()) {
                throw new Error(json.error);
              }
              throw new Error("Invalid agent-step response payload.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let stepContent = "";
            const toolCalls: AgentToolCall[] = [];
            let done = false;

            while (!done) {
              const chunk = await reader.read();
              if (chunk.done) break;
              buffer += decoder.decode(chunk.value, { stream: true });
              const parts = buffer.split(/\r?\n\r?\n/);
              buffer = parts.pop() ?? "";

              for (const part of parts) {
                const lines = part.split(/\r?\n/);
                for (const line of lines) {
                  if (!line.startsWith("data:")) continue;
                  const data = line.replace(/^data:\s*/, "");
                  if (!data) continue;
                  if (data === "[DONE]") {
                    done = true;
                    break;
                  }
                  try {
                    const event = JSON.parse(data) as AgentStreamEvent;
                    if (event.type === "assistant_delta") {
                      content += event.delta;
                      flush();
                    } else if (event.type === "assistant_final") {
                      stepContent = event.content;
                      content = event.content;
                      flush(true);
                    } else if (event.type === "tool_call") {
                      toolCalls.push({
                        id: event.call.id,
                        name: event.call.name,
                        arguments: event.call.arguments,
                      });
                      upsertLog({
                        id: event.call.id,
                        tool: event.call.name,
                        args: event.call.arguments,
                        status: "running",
                        startedAt: nowMs(),
                      });
                      flush();
                    } else if (event.type === "error") {
                      agentError = event.message;
                    }
                  } catch {
                    // ignore malformed stream payloads
                  }
                }
                if (done) break;
              }
            }

            if (agentError) throw new Error(agentError);
            return { assistantContent: stepContent || content, toolCalls };
          };

          const conversation: AgentMessage[] = toAgentMessages(toolMessages);
          const maxSteps = 8;

          for (let step = 0; step < maxSteps; step += 1) {
            const stepRes = await runAgentStep(conversation);
            const assistantContent = stepRes.assistantContent;
            const stepToolCalls = stepRes.toolCalls;

            if (stepToolCalls.length === 0) {
              content = assistantContent;
              break;
            }

            // Append assistant tool call message.
            conversation.push({
              role: "assistant",
              content: assistantContent ? assistantContent : null,
              tool_calls: stepToolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: {
                  name: call.name,
                  arguments: safeJsonStringify(call.arguments),
                },
              })),
            });

            for (const call of stepToolCalls) {
              const logExisting =
                toolLogs.find((l) => l.id === call.id) ??
                ({
                  id: call.id,
                  tool: call.name,
                  args: call.arguments,
                  status: "running",
                  startedAt: nowMs(),
                } satisfies ToolCallLog);
              upsertLog(logExisting);
              flush();

              try {
                const result = await executeTool(call);
                upsertLog({
                  ...logExisting,
                  status: "success",
                  endedAt: nowMs(),
                  result,
                });
                flush();
                conversation.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: safeJsonStringify(result),
                });
              } catch (err) {
                const error = err instanceof Error ? err.message : "Tool failed";
                upsertLog({
                  ...logExisting,
                  status: "error",
                  endedAt: nowMs(),
                  error,
                });
                flush();
                conversation.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: safeJsonStringify({ error }),
                });
              }
            }

            if (step === maxSteps - 1) {
              throw new Error("Agent exceeded max steps.");
            }
          }

          if (agentError) {
            throw new Error(agentError);
          }
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
        const updated = await deps.nodeService.update(assistantNode.id, {
          content,
          metadata: { toolLogs },
        });
        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(updated.id, updated);
          return { nodes };
        });
        return updated;
      }

      if (request.supportsStreaming) {
        const assistantNode = await deps.nodeService.create({
          type: NodeType.ASSISTANT,
          parentId,
          ...(typeof request.createdAt === "number" ? { createdAt: request.createdAt } : {}),
          content: "",
          metadata: {
            tags: [],
            metaInstructions: {},
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
            messages: injectToolInstructionMessages(messages, toolUses, toolSettings),
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

      const assistantNode = await deps.nodeService.create({
        type: NodeType.ASSISTANT,
        parentId,
        ...(typeof request.createdAt === "number" ? { createdAt: request.createdAt } : {}),
        content: "",
        metadata: {
          tags: [],
          metaInstructions: {},
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

      try {
        const content = await deps.llmService.chat({
          messages: injectToolInstructionMessages(messages, toolUses, toolSettings),
          model: request.modelId,
          temperature: get().temperature,
          maxTokens: get().maxTokens,
          apiKey: request.apiKey,
          baseUrl: request.baseUrl,
        });

        const updated = await deps.nodeService.update(assistantNode.id, { content });
        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(updated.id, updated);
          return { nodes };
        });
        return updated;
      } catch (err) {
        await deps.nodeService.delete(assistantNode.id);
        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.delete(assistantNode.id);
          return { nodes };
        });
        throw err;
      }
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
      hydrateLLMSettingsFromStorage: () => {
        const stored = getStoredLLMSettings();
        if (!stored) return;
        set({
          model: stored.model,
          temperature: stored.temperature,
          maxTokens: stored.maxTokens,
          selectedModels: stored.selectedModels,
          compressionModel: stored.compressionModel,
          summaryModel: stored.summaryModel,
        });
      },
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
      if (!tree) throw new Error("errors.noActiveConversationTree");

      set({ isSending: true, llmError: null });
      try {
        const hadPriorUserMessages = Array.from(get().nodes.values()).some(
          (n) => n.type === NodeType.USER,
        );

        const ensureRecentMessagesInjected = async () => {
          const settings = get().longTermMemorySettings;
          if (!settings.enabled || !settings.autoInjectRecentMessagesOnFirstMessage) return;
          if (settings.autoInjectRecentMessagesCount <= 0) return;

          if (hadPriorUserMessages) return;

          const box = get().contextBox;
          if (!box) return;

          const folderId = tree.folderId ?? null;
          const sourceTree = Array.from(get().trees.values())
            .filter((candidate) => candidate.id !== tree.id)
            .filter((candidate) => (candidate.folderId ?? null) === folderId)
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)[0];
          if (!sourceTree) return;

          const { nodes } = await deps.treeService.loadTreeNodes(sourceTree.id);
          const messages = nodes
            .filter((n) => n.type === NodeType.USER || n.type === NodeType.ASSISTANT)
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt);
          if (messages.length === 0) return;

          const count = Math.min(50, Math.max(0, Math.round(settings.autoInjectRecentMessagesCount)));
          if (count === 0) return;

          const selected = messages.slice(-count);
          const anchorNodeId = tree.rootId;
          await get().upsertFileBlock(
            buildRecentMessagesContextBlock({
              sourceTitle: sourceTree.title,
              sourceTreeId: sourceTree.id,
              messageNodes: selected,
            }),
            anchorNodeId,
          );
        };

        const ensureLongTermMemoryBaseInjected = async () => {
          const settings = get().longTermMemorySettings;
          if (!settings.enabled || !settings.autoInjectOnFirstMessage) return;

          if (hadPriorUserMessages) return;

          const box = get().contextBox;
          if (!box) return;

          const anchorNodeId = tree.rootId;

          const profile = await deps.userProfileService.read();
          const profileMarkdown = renderUserProfileMarkdown(profile);
          await get().upsertFileBlock(buildProfileContextBlock(profileMarkdown), anchorNodeId);

          const folderId = tree.folderId ?? null;
          if (folderId) {
            const doc = await deps.folderDocService.read(folderId);
            const docMarkdown = renderFolderDocMarkdown(doc);
            await get().upsertFileBlock(
              buildFolderDocContextBlock({ folderId, markdown: docMarkdown }),
              anchorNodeId,
            );
          }
        };

        const refreshLongTermMemoryRag = async () => {
          const settings = get().longTermMemorySettings;
          if (!settings.enabled || !settings.autoInjectOnFirstMessage) return;

          const box = get().contextBox;
          if (!box) return;

          const folderId = tree.folderId ?? null;
          const anchorNodeId = tree.rootId;
          const memories = await searchRelevantMemories({
            query: trimmed,
            folderId,
          });
          const autoBlocks = memories.map((item) =>
            buildMemoryContextBlock({ item, pinned: false }),
          );
          await get().replaceAutoMemoryBlocks(autoBlocks, anchorNodeId);
        };

        await ensureRecentMessagesInjected();
        await ensureLongTermMemoryBaseInjected();
        await refreshLongTermMemoryRag();

        const allowMemoryTool =
          get().longTermMemorySettings.enabled &&
          get().longTermMemorySettings.enableMemorySearchTool;
        const toolUses = (get().draftToolUses ?? []).filter(
          (id) => id !== "search_memory" || allowMemoryTool,
        );
        const toolSettings = get().toolSettings;

        const parentId = get().activeNodeId ?? tree.rootId;

        const contextBlocks: ContextBlock[] = (() => {
          const blocks = get().contextBox?.blocks ?? [];
          const byId = new Map(blocks.map((b) => [b.id, b]));
          if (!contextNodeIds?.length) return blocks;
          return contextNodeIds.map((id) => byId.get(id) ?? ({ id, kind: "node", nodeId: id } as ContextBlock));
        })();

        const hasImages = contextBlocks.some(
          (block) => block.kind === "file" && block.fileKind === "image",
        );

        const messages: ChatMessage[] = [];
        for (const block of contextBlocks) {
          if (block.kind === "file") {
            messages.push(fileBlockToChatMessage(block));
            continue;
          }
          const node = get().nodes.get(block.nodeId) ?? (await deps.nodeService.read(block.nodeId));
          if (!node) continue;
          const msg = nodeToChatMessage(node);
          if (msg) messages.push(msg);
        }

        const last = messages[messages.length - 1];
        if (!last || last.role !== "user" || last.content !== trimmed) {
          messages.push({ role: "user", content: trimmed });
        }

        const selectedModels = get().selectedModels;
        let requests = selectedModels
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

        const visionErrors: string[] = [];
        if (hasImages) {
          requests = requests.filter((request) => {
            const ok = getModelVisionSupport(request.providerId, request.modelId);
            if (!ok) {
              visionErrors.push(`${request.modelName}: Model does not support vision.`);
            }
            return ok;
          });

          if (requests.length === 0) {
            throw new Error(
              visionErrors[0] ?? "Selected models do not support vision.",
            );
          }
        }

        const userNode = await deps.nodeService.create({
          type: NodeType.USER,
          parentId,
          content: trimmed,
          metadata: { toolUses },
        });

        set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(userNode.id, userNode);
          return { nodes, activeNodeId: userNode.id };
        });

        await get().addToContext(userNode.id);

        enqueueMemoryWriterJob(() =>
          runMemoryWriterJob({
            treeId: tree.id,
            folderId: tree.folderId ?? null,
            latestUserNodeId: userNode.id,
            latestUserCreatedAt: userNode.createdAt,
            latestUserText: trimmed,
            isFirstUserMessageInThread: !hadPriorUserMessages,
          }),
        );

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

        const baseCreatedAt = Date.now();
        const orderedRequests = requests.map((request, index) => ({
          ...request,
          createdAt: baseCreatedAt + index,
        }));

        const results = await Promise.allSettled(
          orderedRequests.map(async (request) => {
            const node = await runModelRequest(
              request,
              userNode.id,
              messages,
              toolUses,
              toolSettings,
            );
            return { request, node };
          }),
        );

        const assistantNodes: Node[] = [];
        const errors: string[] = [...visionErrors];

        for (const [index, result] of results.entries()) {
          const request = orderedRequests[index];
          if (result.status === "rejected") {
            const reason =
              result.reason instanceof Error ? result.reason.message : "errors.failedToSendMessage";
            errors.push(`${request.modelName}: ${reason}`);
            continue;
          }
          assistantNodes.push(result.value.node);
        }

        if (assistantNodes.length === 0) {
          throw new Error(errors[0] ?? "errors.failedToSendMessage");
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
          err instanceof Error ? err.message : "errors.failedToSendMessage";
        set({ llmError: message });
        throw err;
      } finally {
        set({ isSending: false });
      }
    },
    retryAssistant: async (nodeId) => {
      const tree = get().getCurrentTree();
      if (!tree) throw new Error("errors.noActiveConversationTree");

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
        const toolUses = userNode.metadata.toolUses ?? [];
        const toolSettings = get().toolSettings;

        const messages: ChatMessage[] = [];
        const contextBlocks = get().contextBox?.blocks ?? [];
        const hasImages = contextBlocks.some(
          (block) => block.kind === "file" && block.fileKind === "image",
        );

        if (contextBlocks.length > 0) {
          for (const block of contextBlocks) {
            if (block.kind === "file") {
              messages.push(fileBlockToChatMessage(block));
              continue;
            }
            const node =
              get().nodes.get(block.nodeId) ?? (await deps.nodeService.read(block.nodeId));
            if (!node) continue;
            const msg = nodeToChatMessage(node);
            if (msg) messages.push(msg);
          }
        } else {
          const contextNodes = await deps.nodeService.getPath(userNode.id);
          for (const node of contextNodes) {
            const msg = nodeToChatMessage(node);
            if (msg) messages.push(msg);
          }
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
            headers: provider.headers,
            timeout: provider.timeout,
            supportsStreaming: getModelStreamingSupport(provider.id, modelId),
          } satisfies ModelRequest;
        })();

        if (hasImages && !getModelVisionSupport(request.providerId, request.modelId)) {
          throw new Error(`${request.modelName}: Model does not support vision.`);
        }
        const assistantReply = await runModelRequest(
          request,
          userNode.id,
          messages,
          toolUses,
          toolSettings,
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
          err instanceof Error ? err.message : "errors.failedToRetryMessage";
        set({ llmError: message });
        throw err;
      } finally {
        set({ isSending: false });
      }
    },
    compressNodes: async (nodeIds, options) => {
      const treeId = get().currentTreeId;
      if (!treeId) throw new Error("errors.noActiveConversationTree");

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
          const nextBlocks: ContextBlock[] = [];
          let inserted = false;

          for (const block of box.blocks) {
            if (block.kind === "node" && selected.has(block.nodeId)) {
              if (!inserted) {
                nextBlocks.push({ id: compressed.id, kind: "node", nodeId: compressed.id });
                inserted = true;
              }
              continue;
            }
            nextBlocks.push(block);
          }

          const unique: ContextBlock[] = [];
          const seen = new Set<string>();
          for (const block of nextBlocks) {
            if (seen.has(block.id)) continue;
            if (block.kind === "node") {
              if (!block.nodeId || !get().nodes.has(block.nodeId)) continue;
              // For node blocks we use nodeId as id, so de-dupe on id is enough.
              seen.add(block.id);
              unique.push(block);
              continue;
            }
            seen.add(block.id);
            unique.push(block);
          }

          if (inserted) {
            const totalTokens = unique.reduce((sum, block) => {
              if (block.kind === "node") {
                return sum + (get().nodes.get(block.nodeId)?.tokenCount ?? 0);
              }
              return sum + block.tokenCount;
            }, 0);

            const nextBox = { ...box, blocks: unique, totalTokens };
            set({ contextBox: nextBox });
            await deps.contextBoxService.put(nextBox);
          }
        }

        return compressed;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "errors.failedToCompressNodes";
        set({ compressionError: message });
        throw err;
      } finally {
        set({ isCompressing: false });
      }
    },
    decompressNode: async (nodeId) => {
      const treeId = get().currentTreeId;
      if (!treeId) throw new Error("errors.noActiveConversationTree");

      const priorBoxBlocks = get().contextBox?.blocks ?? [];

      set({ isCompressing: true, compressionError: null });
      try {
        const restored = await deps.compressionService.decompress(nodeId);
        const restoredIds = restored.map((n) => n.id);

        await deps.treeService.touch(treeId);
        await get().loadTree(treeId);

        const box = get().contextBox;
        if (
          box &&
          priorBoxBlocks.some((block) => block.kind === "node" && block.nodeId === nodeId)
        ) {
          const nextBlocks: ContextBlock[] = [];
          for (const block of priorBoxBlocks) {
            if (block.kind === "node" && block.nodeId === nodeId) {
              nextBlocks.push(
                ...restoredIds.map((id) => ({ id, kind: "node", nodeId: id }) satisfies ContextBlock),
              );
              continue;
            }
            nextBlocks.push(block);
          }

          const unique: ContextBlock[] = [];
          const seen = new Set<string>();
          for (const block of nextBlocks) {
            if (seen.has(block.id)) continue;
            if (block.kind === "node") {
              if (!block.nodeId || !get().nodes.has(block.nodeId)) continue;
              seen.add(block.id);
              unique.push(block);
              continue;
            }
            seen.add(block.id);
            unique.push(block);
          }

          const totalTokens = unique.reduce((sum, block) => {
            if (block.kind === "node") {
              return sum + (get().nodes.get(block.nodeId)?.tokenCount ?? 0);
            }
            return sum + block.tokenCount;
          }, 0);

          const nextBox = { ...box, blocks: unique, totalTokens };
          set({ contextBox: nextBox });
          await deps.contextBoxService.put(nextBox);
        }

        return restored;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "errors.failedToDecompressNode";
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
          err instanceof Error ? err.message : "errors.failedToGenerateSuggestion";
        set({ compressionError: message });
        throw err;
      } finally {
        set({ isCompressing: false });
      }
    },
    generateSummary: async (content) => {
      const locale = get().locale;
      const prompt =
        locale === "zh-CN"
          ? [
              "你是一个标题生成器。",
              "请根据下面的内容生成不超过 20 个汉字的主题标题。",
              "只输出标题本身，不要解释，不要标点。",
              "",
              content,
            ].join("\n")
          : [
              "You are a title generator.",
              "Based on the content below, generate a concise topic title in 2–20 words.",
              "Output only the title. No explanation. No quotes. No punctuation.",
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

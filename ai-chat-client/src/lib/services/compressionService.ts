import { NodeType, type Node, type NodeMetaInstructions } from "@/types";

import type { ChatParams, ILLMService } from "./llmService";
import { NodeService } from "./nodeService";

export interface CompressionSuggestion {
  summary: string;
  metaInstructions: NodeMetaInstructions;
}

export interface CompressOptions {
  summary?: string;
  metaInstructions?: NodeMetaInstructions;
  collapsed?: boolean;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function orderCompressedChainIds(
  nodeIds: string[],
  nodesById: Map<string, Node>,
): string[] {
  const unique = uniqueIds(nodeIds).filter((id) => nodesById.has(id));
  if (unique.length < 2) {
    throw new Error("Select at least 2 nodes from the same path to compress.");
  }

  const selected = new Set(unique);
  const entries: string[] = [];

  for (const id of selected) {
    const node = nodesById.get(id);
    if (!node) continue;
    if (!node.parentId || !selected.has(node.parentId)) entries.push(id);
  }

  if (entries.length !== 1) {
    throw new Error("Selection must be a single continuous path (no branches).");
  }

  const entryId = entries[0]!;
  const ordered: string[] = [];
  const visited = new Set<string>();
  let current = entryId;

  while (current) {
    if (visited.has(current)) {
      throw new Error("Selection contains a cycle.");
    }
    visited.add(current);
    ordered.push(current);

    const children = unique.filter((id) => nodesById.get(id)?.parentId === current);
    if (children.length > 1) {
      throw new Error("Selection contains branches; pick a linear chain.");
    }

    const next = children[0];
    if (!next) break;
    current = next;
  }

  if (ordered.length !== selected.size) {
    throw new Error("Selection must be a single continuous path (no gaps).");
  }

  return ordered;
}

function formatConversation(nodes: Node[]): string {
  return nodes
    .map((node) => {
      const role =
        node.type === NodeType.USER
          ? "user"
          : node.type === NodeType.ASSISTANT
            ? "assistant"
            : "system";
      return `${role}: ${node.content}`;
    })
    .join("\n\n");
}

function buildFallbackSummary(nodes: Node[]): string {
  const first = nodes.find((n) => n.content.trim())?.content.trim() ?? "";
  const last =
    nodes.slice().reverse().find((n) => n.content.trim())?.content.trim() ?? "";

  if (!first && !last) return "Compressed conversation segment.";
  if (first === last) return first.slice(0, 240);
  const combined = `${first}\n...\n${last}`.trim();
  return combined.length > 320 ? `${combined.slice(0, 320)}...` : combined;
}

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate) return candidate;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

function safeParseJson(text: string): unknown {
  const candidate = extractJsonCandidate(text);
  if (!candidate) throw new Error("Model returned empty JSON payload.");
  try {
    return JSON.parse(candidate) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse JSON response: ${message}`);
  }
}

function normalizeMetaInstructions(value: unknown): NodeMetaInstructions {
  if (typeof value !== "object" || value === null) return {};
  const obj = value as Record<string, unknown>;
  const next: NodeMetaInstructions = {};

  for (const [key, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim()) next[key] = v.trim();
  }

  return next;
}

function detectLanguage(text: string): string | undefined {
  const clean = text.replace(/\s+/g, "");
  if (!clean) return undefined;
  const chinese = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  const ratio = chinese / clean.length;
  if (ratio > 0.2) return "zh-CN";
  return "en";
}

function detectFormat(text: string): string | undefined {
  if (/\bmarkdown\b/i.test(text) || /用\s*markdown|以\s*markdown/i.test(text)) {
    return "markdown";
  }
  if (/\bjson\b/i.test(text) || /返回\s*json|以\s*json/i.test(text)) {
    return "json";
  }
  if (text.includes("```")) return "markdown";
  return undefined;
}

function detectRole(text: string): string | undefined {
  if (/\bexpert\b/i.test(text) || /专家/.test(text)) return "expert";
  if (/\bmentor\b/i.test(text) || /导师/.test(text)) return "mentor";
  return undefined;
}

export class CompressionService {
  constructor(private readonly nodeService: NodeService = new NodeService()) {}

  buildCompressionPrompt(nodes: Node[]): string {
    const conversation = formatConversation(nodes);
    return [
      "You are a helpful assistant designed to output JSON.",
      "Task: Compress the conversation segment into a reusable summary and extract any implicit meta instructions.",
      "Return ONLY valid JSON with this shape:",
      '{"summary":"...","metaInstructions":{"language":"zh-CN","format":"markdown","role":"expert"}}',
      "Rules:",
      "- summary: 2-3 short sentences, capture goals, decisions, constraints.",
      "- metaInstructions: include keys only when clearly implied by the conversation (language/format/role).",
      "- Do not wrap the JSON in markdown fences.",
      "",
      "Conversation:",
      conversation,
    ].join("\n");
  }

  extractMetaInstructions(nodes: Node[]): NodeMetaInstructions {
    const text = nodes.map((n) => n.content).join("\n\n");
    const meta: NodeMetaInstructions = {};

    const language = detectLanguage(text);
    if (language) meta.language = language;

    const format = detectFormat(text);
    if (format) meta.format = format;

    const role = detectRole(text);
    if (role) meta.role = role;

    return meta;
  }

  async generateSuggestion(
    llmService: ILLMService,
    nodes: Node[],
    params?: Omit<ChatParams, "messages">,
  ): Promise<CompressionSuggestion> {
    const heuristicMeta = this.extractMetaInstructions(nodes);
    const prompt = this.buildCompressionPrompt(nodes);

    const baseParams: ChatParams = {
      messages: [{ role: "user", content: prompt }],
      model: params?.model,
      temperature: params?.temperature ?? 0.2,
      maxTokens: params?.maxTokens ?? 512,
      responseFormat:
        (params as { responseFormat?: unknown } | undefined)?.responseFormat ??
        ({ type: "json_object" } as const),
    };

    let content: string;
    try {
      content = await llmService.chat(baseParams);
    } catch {
      const retryParams: ChatParams = { ...baseParams };
      delete (retryParams as { responseFormat?: unknown }).responseFormat;
      content = await llmService.chat(retryParams);
    }

    const parsed = safeParseJson(content);
    const obj =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};

    const summaryRaw = typeof obj.summary === "string" ? obj.summary.trim() : "";
    const metaRaw = normalizeMetaInstructions(obj.metaInstructions);

    return {
      summary: summaryRaw || buildFallbackSummary(nodes),
      metaInstructions: { ...heuristicMeta, ...metaRaw },
    };
  }

  async compress(nodeIds: string[], options?: CompressOptions): Promise<Node> {
    const unique = uniqueIds(nodeIds);

    const resolved = await Promise.all(unique.map((id) => this.nodeService.read(id)));
    const nodes = resolved.filter((n): n is Node => Boolean(n));
    if (nodes.length !== unique.length) {
      throw new Error("Some selected nodes are missing.");
    }

    if (nodes.some((n) => n.type === NodeType.COMPRESSED)) {
      throw new Error("Cannot compress an already compressed node.");
    }

    const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
    const orderedIds = orderCompressedChainIds(unique, nodesById);
    const ordered = orderedIds.map((id) => nodesById.get(id)!);

    const entry = ordered[0]!;
    const tail = ordered[ordered.length - 1]!;
    if (!entry.parentId) {
      throw new Error("Cannot compress the root node.");
    }

    const summary = options?.summary?.trim() || buildFallbackSummary(ordered);
    const metaInstructions = options?.metaInstructions ?? this.extractMetaInstructions(ordered);
    const collapsed = options?.collapsed ?? true;

    const compressedNode = await this.nodeService.create({
      type: NodeType.COMPRESSED,
      parentId: tail.id,
      content: "",
      summary,
      position: tail.position ?? entry.position,
      metadata: {
        tags: ["compressed"],
        metaInstructions,
        compressedNodeIds: orderedIds,
        collapsed,
      },
    });

    // Move any children of the tail to the compressed node so the compressed node
    // becomes the continuation point of the conversation.
    const tailChildren = await this.nodeService.getChildren(tail.id);
    for (const child of tailChildren) {
      if (child.id === compressedNode.id) continue;
      if (orderedIds.includes(child.id)) continue;
      await this.nodeService.update(child.id, { parentId: compressedNode.id });
    }

    return compressedNode;
  }

  async decompress(nodeId: string): Promise<Node[]> {
    const compressed = await this.nodeService.read(nodeId);
    if (!compressed) throw new Error(`Node ${nodeId} not found`);
    if (compressed.type !== NodeType.COMPRESSED) {
      throw new Error("Node is not a compressed node.");
    }

    const compressedIds = compressed.metadata.compressedNodeIds ?? [];
    if (compressedIds.length === 0) {
      throw new Error("Compressed node has no compressedNodeIds.");
    }

    const nodes = await Promise.all(compressedIds.map((id) => this.nodeService.read(id)));
    const restored = nodes.filter((n): n is Node => Boolean(n));
    if (restored.length !== compressedIds.length) {
      throw new Error("Some nodes referenced by the compressed node are missing.");
    }

    const nodesById = new Map(restored.map((n) => [n.id, n] as const));
    const orderedIds = orderCompressedChainIds(compressedIds, nodesById);
    const ordered = orderedIds.map((id) => nodesById.get(id)!);

    const tail = ordered[ordered.length - 1]!;

    const children = await this.nodeService.getChildren(compressed.id);
    for (const child of children) {
      await this.nodeService.update(child.id, { parentId: tail.id });
    }

    await this.nodeService.delete(compressed.id);

    return ordered;
  }
}

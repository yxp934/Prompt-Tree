import { NextResponse } from "next/server";

import type { AgentMessage, AgentStreamEvent, MCPServerEntry, ToolSettings, ToolUseId } from "@/types";

export const runtime = "nodejs";

type OpenAIToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
};

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAIMessage = AgentMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isOpenAIContentPart(value: unknown): value is OpenAIContentPart {
  if (!isRecord(value)) return false;
  if (value.type === "text") return typeof value.text === "string";
  if (value.type === "image_url") {
    if (!isRecord(value.image_url)) return false;
    return typeof value.image_url.url === "string" && value.image_url.url.length > 0;
  }
  return false;
}

function normalizeUrl(value: unknown): string | null {
  const raw = normalizeString(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) return "https://api.openai.com/v1/chat/completions";
  if (normalized.endsWith("/chat/completions")) return normalized;
  return `${normalized}/chat/completions`;
}

function toSseLine(data: string): Uint8Array {
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Unserializable payload." });
  }
}

function parseToolArgs(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { _raw: raw };
  }
}

function buildTools(params: {
  toolUses: ToolUseId[];
  toolSettings: ToolSettings;
}): OpenAIToolDefinition[] {
  const set = new Set(params.toolUses);
  const tools: OpenAIToolDefinition[] = [];

  if (set.has("search_memory")) {
    tools.push({
      type: "function",
      function: {
        name: "search_memory",
        description:
          "Search the user's long-term memory bank and return relevant memories.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query." },
            topK: { type: "number", minimum: 1, maximum: 20 },
            scope: { type: "string", enum: ["user", "folder", "both"] },
            tagsAny: { type: "array", items: { type: "string" } },
            folderId: { type: "string", description: "Optional folder id when scope includes folder." },
            timeFrom: {
              type: "string",
              description:
                "Optional inclusive lower bound for memory updatedAt (ISO-8601 datetime string or unix ms as a string).",
            },
            timeTo: {
              type: "string",
              description:
                "Optional inclusive upper bound for memory updatedAt (ISO-8601 datetime string or unix ms as a string).",
            },
          },
          required: ["query"],
          additionalProperties: true,
        },
      },
    });
  }

  if (set.has("web_search")) {
    tools.push({
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for up-to-date information and sources.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query." },
            provider: { type: "string", enum: ["tavily", "exa"] },
            maxResults: { type: "number", minimum: 1, maximum: 20 },
            searchDepth: { type: "string", enum: ["basic", "advanced"] },
          },
          required: ["query"],
          additionalProperties: true,
        },
      },
    });
  }

  if (set.has("python")) {
    tools.push({
      type: "function",
      function: {
        name: "exec_python",
        description: "Execute Python code and return stdout/stderr/result metadata.",
        parameters: {
          type: "object",
          properties: {
            code: { type: "string", description: "Python code to execute." },
          },
          required: ["code"],
          additionalProperties: false,
        },
      },
    });
  }

  // MCP tools mirror /api/agent.
  const enabledMcpServers = (() => {
    const all = params.toolSettings.mcp.servers.slice();
    if (set.has("mcp")) return all;
    const byId = new Map(all.map((s) => [s.id, s]));
    const ids = params.toolUses
      .filter((id) => id.startsWith("mcp:"))
      .map((id) => id.slice("mcp:".length).trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const out: MCPServerEntry[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const server = byId.get(id);
      if (server) out.push(server);
    }
    return out;
  })();

  if (enabledMcpServers.length > 0) {
    tools.push({
      type: "function",
      function: {
        name: "mcp_list_tools",
        description: "List tools for an enabled MCP server.",
        parameters: {
          type: "object",
          properties: {
            serverId: { type: "string", description: "MCP server id." },
          },
          required: ["serverId"],
          additionalProperties: false,
        },
      },
    });

    tools.push({
      type: "function",
      function: {
        name: "mcp_call",
        description: "Call a tool on an enabled MCP server.",
        parameters: {
          type: "object",
          properties: {
            serverId: { type: "string", description: "MCP server id." },
            name: { type: "string", description: "Tool name." },
            arguments: { description: "Tool arguments." },
          },
          required: ["serverId", "name"],
          additionalProperties: true,
        },
      },
    });
  }

  return tools;
}

function parseToolUses(value: unknown): ToolUseId[] {
  if (!Array.isArray(value)) return [];
  const unique: ToolUseId[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id) continue;

    const normalized: ToolUseId | null =
      id === "web_search" || id === "python" || id === "search_memory" || id === "mcp"
        ? (id as ToolUseId)
        : id.startsWith("mcp:") && id.slice("mcp:".length).trim()
          ? (`mcp:${id.slice("mcp:".length).trim()}` as ToolUseId)
          : null;

    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  if (unique.includes("mcp")) {
    return unique.filter(
      (id) => id === "web_search" || id === "python" || id === "search_memory" || id === "mcp",
    );
  }

  return unique;
}

function parseToolSettings(value: unknown): ToolSettings | null {
  if (!isRecord(value)) return null;
  const search = isRecord(value.search) ? value.search : {};
  const python = isRecord(value.python) ? value.python : {};
  const mcp = isRecord(value.mcp) ? value.mcp : {};

  const serversRaw = isRecord(mcp) && Array.isArray(mcp.servers) ? mcp.servers : [];
  const normalizedServers = serversRaw
    .map((s) => {
      if (!isRecord(s)) return null;
      const id = normalizeString(s.id);
      const name = normalizeString(s.name);
      const transport =
        s.transport === "stdio" || s.transport === "sse" ? s.transport : "http";
      const token = normalizeString(s.token);
      const configJson = normalizeString(s.configJson);
      const createdAt = typeof s.createdAt === "number" ? s.createdAt : Date.now();
      const updatedAt = typeof s.updatedAt === "number" ? s.updatedAt : Date.now();
      if (!id.trim() || !name.trim()) return null;
      return { id, name, transport, token, configJson, createdAt, updatedAt };
    })
    .filter((s): s is MCPServerEntry => Boolean(s));

  return {
    search: {
      provider: search.provider === "exa" ? "exa" : "tavily",
      exaApiKey: normalizeString(search.exaApiKey),
      tavilyApiKey: normalizeString(search.tavilyApiKey),
      maxResults: typeof search.maxResults === "number" ? search.maxResults : 5,
      searchDepth: search.searchDepth === "advanced" ? "advanced" : "basic",
    },
    mcp: {
      servers: normalizedServers,
    },
    python: {
      timeoutMs: typeof python.timeoutMs === "number" ? python.timeoutMs : 15000,
      maxOutputChars: typeof python.maxOutputChars === "number" ? python.maxOutputChars : 20000,
      pythonCommand: normalizeString(python.pythonCommand) || "python3",
    },
  };
}

function normalizeAgentMessages(value: unknown): OpenAIMessage[] | null {
  if (!Array.isArray(value)) return null;
  const out: OpenAIMessage[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const role = normalizeString(item.role);
    if (role === "system") {
      if (typeof item.content !== "string") return null;
      out.push({ role: "system", content: item.content });
      continue;
    }
    if (role === "assistant") {
      const content =
        item.content == null ? null : typeof item.content === "string" ? item.content : null;
      const tool_calls = Array.isArray(item.tool_calls)
        ? (item.tool_calls as unknown[]).filter((c) => isRecord(c)) as OpenAIToolCall[]
        : undefined;
      out.push({ role: "assistant", content, ...(tool_calls ? { tool_calls } : {}) });
      continue;
    }
    if (role === "user") {
      if (typeof item.content === "string") {
        out.push({ role: "user", content: item.content });
        continue;
      }
      if (Array.isArray(item.content) && item.content.every(isOpenAIContentPart)) {
        out.push({ role: "user", content: item.content });
        continue;
      }
      return null;
    }
    if (role === "tool") {
      const tool_call_id = normalizeString(item.tool_call_id).trim();
      const content = normalizeString(item.content);
      if (!tool_call_id) return null;
      out.push({ role: "tool", tool_call_id, content });
      continue;
    }
    return null;
  }
  return out;
}

async function callChatCompletion(params: {
  apiKey: string;
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  model: string;
  temperature: number;
  maxTokens?: number;
  messages: OpenAIMessage[];
  tools: OpenAIToolDefinition[];
  stream: boolean;
  onDelta?: (delta: string) => void;
}): Promise<{ content: string; toolCalls: OpenAIToolCall[] }> {
  const url = buildChatCompletionsUrl(params.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  const headers: Record<string, string> = {
    ...params.headers,
    "Content-Type": "application/json",
    Authorization: `Bearer ${params.apiKey}`,
  };

  const body = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    tools: params.tools.length ? params.tools : undefined,
    tool_choice: params.tools.length ? "auto" : undefined,
    stream: params.stream,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`LLM error (${response.status}): ${text || response.statusText}`);
    }

    if (!params.stream) {
      const json = (await response.json().catch(() => null)) as
        | {
            choices?: Array<{
              message?: { content?: string | null; tool_calls?: OpenAIToolCall[] };
            }>;
          }
        | null;
      const message = json?.choices?.[0]?.message;
      const content = message?.content ?? "";
      const toolCalls = Array.isArray(message?.tool_calls) ? message!.tool_calls! : [];
      return { content, toolCalls };
    }

    if (!response.body) {
      throw new Error("LLM returned empty stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let content = "";
    const toolCallsByIndex = new Map<number, { id: string; name: string; args: string }>();
    let sawDone = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split(/\r?\n/);
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.replace(/^data:\s*/, "").trim();
          if (!data) continue;
          if (data === "[DONE]") {
            sawDone = true;
            break;
          }

          try {
            const json = JSON.parse(data) as {
              choices?: Array<{
                delta?: {
                  content?: string | null;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    type?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
              }>;
            };

            const delta = json.choices?.[0]?.delta;
            const deltaContent = delta?.content ?? "";
            if (deltaContent) {
              content += deltaContent;
              params.onDelta?.(deltaContent);
            }

            const deltaCalls = delta?.tool_calls ?? [];
            for (const call of deltaCalls) {
              const index = typeof call.index === "number" ? call.index : 0;
              const existing = toolCallsByIndex.get(index) ?? { id: "", name: "", args: "" };
              const next = {
                id: call.id ?? existing.id,
                name: call.function?.name ?? existing.name,
                args: `${existing.args}${call.function?.arguments ?? ""}`,
              };
              toolCallsByIndex.set(index, next);
            }
          } catch {
            // ignore malformed chunk
          }
        }
        if (sawDone) break;
      }
      if (sawDone) break;
    }

    const toolCalls: OpenAIToolCall[] = Array.from(toolCallsByIndex.entries())
      .sort(([a], [b]) => a - b)
      .map(([, t]): OpenAIToolCall => ({
        id: t.id,
        type: "function",
        function: { name: t.name, arguments: t.args },
      }))
      .filter((t) => t.id && t.function.name);

    return { content, toolCalls };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const apiKey = normalizeString(body.apiKey).trim();
  const baseUrl = normalizeUrl(body.baseUrl) ?? normalizeString(body.baseUrl).trim();
  const model = normalizeString(body.model).trim();

  const messages = normalizeAgentMessages(body.messages);
  if (!apiKey || !baseUrl || !model || !messages) {
    return NextResponse.json(
      { error: "Missing required fields (apiKey/baseUrl/model/messages)." },
      { status: 400 },
    );
  }

  const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : undefined;
  const timeoutMs = typeof body.timeout === "number" ? body.timeout : 30000;
  const headers = normalizeHeaders(body.headers);
  const stream = typeof body.stream === "boolean" ? body.stream : true;

  const toolUses = parseToolUses(body.toolUses);
  const toolSettings = parseToolSettings(body.toolSettings);
  if (!toolSettings) {
    return NextResponse.json({ error: "Invalid toolSettings." }, { status: 400 });
  }

  const tools = buildTools({ toolUses, toolSettings });

  const encoder = new TextEncoder();
  const streamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${safeJsonStringify(event)}\n\n`));
      };
      const done = () => controller.enqueue(toSseLine("[DONE]"));

      void (async () => {
        try {
          let assistantDelta = "";
          const modelRes = await callChatCompletion({
            apiKey,
            baseUrl,
            headers,
            timeoutMs,
            model,
            temperature,
            maxTokens,
            messages,
            tools,
            stream,
            onDelta: (delta) => {
              assistantDelta += delta;
              send({ type: "assistant_delta", delta });
            },
          });

          const toolCalls = modelRes.toolCalls ?? [];
          const assistantContent = modelRes.content ?? assistantDelta;

          send({ type: "assistant_final", content: assistantContent });

          for (const call of toolCalls) {
            send({
              type: "tool_call",
              call: {
                id: call.id,
                name: call.function.name,
                arguments: parseToolArgs(call.function.arguments),
              },
            });
          }

          done();
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Agent step failed";
          send({ type: "error", message });
          done();
          controller.close();
        }
      })();
    },
  });

  return new Response(streamBody, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

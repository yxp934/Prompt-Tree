import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { MCPServerEntry } from "@/types";

type JsonRpcId = number | string;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpListToolsResult = { tools: McpTool[] };

export type McpCallToolResult = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  [key: string]: unknown;
};

type McpClient = {
  listTools: () => Promise<McpListToolsResult>;
  callTool: (name: string, args: unknown) => Promise<McpCallToolResult>;
  close: () => Promise<void>;
};

export type McpLogEvent = { stream: "stdout" | "stderr"; text: string };
export type McpLogCallback = (event: McpLogEvent) => void;

type McpConfig = {
  protocolVersion?: string;
  headers?: Record<string, string>;
} & Record<string, unknown>;

type HttpConfig = McpConfig & { url?: string };
type SseConfig = McpConfig & { sseUrl?: string; messagesUrl?: string; sessionId?: string };
type StdioConfig = McpConfig & {
  command?: string;
  args?: unknown;
  cwd?: string;
  env?: unknown;
  stdioFraming?: "content-length" | "newline";
  requestTimeoutMs?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
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
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && v.trim()) headers[k] = v;
  }
  return headers;
}

function parseConfigJson(entry: MCPServerEntry): McpConfig {
  const raw = entry.configJson.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `Invalid MCP configJson for server ${entry.id || "(unknown)"} (must be JSON).`,
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(
      `Invalid MCP configJson for server ${entry.id || "(unknown)"} (must be a JSON object).`,
    );
  }

  const looksLikeMcpConfig = (value: Record<string, unknown>): boolean =>
    typeof value.command === "string" ||
    typeof value.url === "string" ||
    typeof value.sseUrl === "string" ||
    typeof value.messagesUrl === "string";

  const maybeServers = parsed.mcpServers;
  if (isRecord(maybeServers)) {
    const servers = maybeServers as Record<string, unknown>;

    const fromKey = (key: string): McpConfig | null => {
      const candidate = servers[key];
      return isRecord(candidate) ? (candidate as McpConfig) : null;
    };

    const byId = fromKey(entry.id);
    if (byId) return byId;

    const byName = fromKey(entry.name);
    if (byName) return byName;

    const candidates = Object.values(servers).filter(isRecord);
    if (candidates.length === 1) return candidates[0] as McpConfig;

    throw new Error(
      `MCP configJson contains "mcpServers", but no matching entry for "${entry.id}" (or "${entry.name}"). Paste the single server object instead, or set the MCP server id/name to match a key inside "mcpServers".`,
    );
  }

  // Accept a common shorthand: { "<serverKey>": { ...actual config... } }
  // This appears in some client configs where each server is keyed by name.
  if (!looksLikeMcpConfig(parsed)) {
    const entries = Object.entries(parsed);
    if (entries.length === 1) {
      const onlyValue = entries[0]?.[1];
      if (isRecord(onlyValue) && looksLikeMcpConfig(onlyValue)) {
        return onlyValue as McpConfig;
      }
    }
  }

  return parsed as McpConfig;
}

function buildInitializeRequest(protocolVersion: string, id: JsonRpcId): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "Prompt Tree", version: "0.1.0" },
    },
  };
}

function buildInitializedNotification(): JsonRpcNotification {
  return { jsonrpc: "2.0", method: "notifications/initialized" };
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!isRecord(value)) return false;
  if (value.jsonrpc !== "2.0") return false;
  if (!("id" in value)) return false;
  return true;
}

function ensureResult<T>(res: JsonRpcResponse): T {
  if (res.error) {
    throw new Error(res.error.message || "MCP error");
  }
  return res.result as T;
}

function normalizeTool(value: unknown): McpTool | null {
  if (!isRecord(value)) return null;
  const name = normalizeString(value.name).trim();
  if (!name) return null;
  const description = typeof value.description === "string" ? value.description : undefined;
  return {
    name,
    description,
    inputSchema: value.inputSchema,
  };
}

function normalizeToolsList(value: unknown): McpListToolsResult {
  if (!isRecord(value)) return { tools: [] };
  const tools = Array.isArray(value.tools) ? value.tools : [];
  return {
    tools: tools.map(normalizeTool).filter((t): t is McpTool => Boolean(t)),
  };
}

class StreamableHttpMcpClient implements McpClient {
  private sessionId: string | null = null;
  private nextId = 1;
  private initialized = false;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly config: McpConfig,
  ) {}

  private async send(request: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | null> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...normalizeHeaders(this.config.headers),
    };
    if (this.token.trim()) headers.Authorization = `Bearer ${this.token.trim()}`;
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`MCP HTTP error (${response.status}): ${text || response.statusText}`);
    }

    const sid = response.headers.get("mcp-session-id");
    if (sid && !this.sessionId) this.sessionId = sid;

    const json = (await response.json().catch(() => null)) as unknown;
    if (!json) return null;
    if (!isJsonRpcResponse(json)) {
      throw new Error("Invalid MCP response payload.");
    }
    return json;
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    const protocolVersion =
      normalizeString(this.config.protocolVersion).trim() || "2024-11-05";
    const init = buildInitializeRequest(protocolVersion, this.nextId++);
    const initRes = await this.send(init);
    if (!initRes) throw new Error("Missing initialize response.");
    // Ignore init result; just ensure no error.
    ensureResult(initRes);
    await this.send(buildInitializedNotification());
    this.initialized = true;
  }

  async listTools(): Promise<McpListToolsResult> {
    await this.ensureInitialized();
    const res = await this.send({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/list",
      params: {},
    });
    if (!res) throw new Error("Missing tools/list response.");
    return normalizeToolsList(ensureResult(res));
  }

  async callTool(name: string, args: unknown): Promise<McpCallToolResult> {
    await this.ensureInitialized();
    const res = await this.send({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    });
    if (!res) throw new Error("Missing tools/call response.");
    return ensureResult(res) as McpCallToolResult;
  }

  async close(): Promise<void> {
    // best-effort session close for Streamable HTTP
    if (!this.sessionId) return;
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...normalizeHeaders(this.config.headers),
        "mcp-session-id": this.sessionId,
      };
      if (this.token.trim()) headers.Authorization = `Bearer ${this.token.trim()}`;
      await fetch(this.url, { method: "DELETE", headers }).catch(() => null);
    } finally {
      this.sessionId = null;
      this.initialized = false;
    }
  }
}

class LegacySseMcpClient implements McpClient {
  private readonly pending = new Map<JsonRpcId, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private initialized = false;
  private sessionId: string | null = null;
  private streamAbort: AbortController | null = null;

  constructor(
    private readonly sseUrl: string,
    private readonly messagesUrl: string,
    private readonly token: string,
    private readonly config: McpConfig,
  ) {
    this.sessionId = normalizeString((config as SseConfig).sessionId).trim() || null;
  }

  private async ensureStream() {
    if (this.streamAbort) return;

    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      ...normalizeHeaders(this.config.headers),
    };
    if (this.token.trim()) headers.Authorization = `Bearer ${this.token.trim()}`;
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;

    const controller = new AbortController();
    this.streamAbort = controller;

    const response = await fetch(this.sseUrl, { headers, signal: controller.signal });
    if (!response.ok || !response.body) {
      this.streamAbort = null;
      const text = await response.text().catch(() => "");
      throw new Error(`MCP SSE error (${response.status}): ${text || response.statusText}`);
    }

    const sid = response.headers.get("mcp-session-id");
    if (sid && !this.sessionId) this.sessionId = sid;

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const pump = async () => {
      try {
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
              try {
                const msg = JSON.parse(data) as unknown;
                if (!isJsonRpcResponse(msg)) continue;
                const id = msg.id;
                if (id == null) continue;
                const pending = this.pending.get(id);
                if (!pending) continue;
                this.pending.delete(id);
                pending.resolve(msg);
              } catch {
                // ignore malformed message
              }
            }
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("SSE stream error");
        for (const [, pending] of this.pending) pending.reject(error);
        this.pending.clear();
      }
    };

    void pump();
  }

  private async sendMessage(request: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | null> {
    await this.ensureStream();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...normalizeHeaders(this.config.headers),
    };
    if (this.token.trim()) headers.Authorization = `Bearer ${this.token.trim()}`;
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;

    if ("id" in request) {
      const id = (request as JsonRpcRequest).id;
      const requestTimeoutMs = (() => {
        const raw = (this.config as SseConfig).requestTimeoutMs;
        return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 60000;
      })();
      const promise = new Promise<JsonRpcResponse>((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (!this.pending.has(id)) return;
          this.pending.delete(id);
          reject(new Error("MCP request timed out."));
        }, requestTimeoutMs);
      });

      const response = await fetch(this.messagesUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        this.pending.delete(id);
        const text = await response.text().catch(() => "");
        throw new Error(`MCP messages error (${response.status}): ${text || response.statusText}`);
      }

      return await promise;
    }

    const response = await fetch(this.messagesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`MCP messages error (${response.status}): ${text || response.statusText}`);
    }

    return null;
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    const protocolVersion =
      normalizeString(this.config.protocolVersion).trim() || "2024-11-05";
    const init = buildInitializeRequest(protocolVersion, this.nextId++);
    const initRes = await this.sendMessage(init);
    if (!initRes) throw new Error("Missing initialize response.");
    ensureResult(initRes);
    await this.sendMessage(buildInitializedNotification());
    this.initialized = true;
  }

  async listTools(): Promise<McpListToolsResult> {
    await this.ensureInitialized();
    const res = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/list",
      params: {},
    });
    if (!res) throw new Error("Missing tools/list response.");
    return normalizeToolsList(ensureResult(res));
  }

  async callTool(name: string, args: unknown): Promise<McpCallToolResult> {
    await this.ensureInitialized();
    const res = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    });
    if (!res) throw new Error("Missing tools/call response.");
    return ensureResult(res) as McpCallToolResult;
  }

  async close(): Promise<void> {
    if (this.streamAbort) {
      this.streamAbort.abort();
      this.streamAbort = null;
    }
    this.initialized = false;
    this.sessionId = null;
    for (const [, pending] of this.pending) pending.reject(new Error("MCP client closed."));
    this.pending.clear();
  }
}

class StdioMcpClient implements McpClient {
  private readonly pending = new Map<JsonRpcId, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private initialized = false;
  private buffer = Buffer.alloc(0);

  constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly config: StdioConfig,
  ) {
    child.stdout.on("data", (chunk: Buffer) => this.onStdout(chunk));
    child.on("exit", () => this.closePending(new Error("MCP stdio process exited.")));
    child.on("error", (err) => this.closePending(err instanceof Error ? err : new Error("MCP stdio error")));
  }

  private closePending(error: Error) {
    for (const [, pending] of this.pending) pending.reject(error);
    this.pending.clear();
  }

  private tryParseContentLengthFrames(): unknown[] {
    const messages: unknown[] = [];

    while (true) {
      const headerStart = this.buffer.indexOf("Content-Length:");
      if (headerStart === -1) break;

      if (headerStart > 0) {
        // Drop any non-protocol output before the header.
        this.buffer = this.buffer.slice(headerStart);
      }

      let headerEnd = this.buffer.indexOf("\r\n\r\n");
      let separatorLength = 4;
      if (headerEnd === -1) {
        headerEnd = this.buffer.indexOf("\n\n");
        separatorLength = 2;
      }
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Malformed header; discard and continue.
        this.buffer = this.buffer.slice(headerEnd + separatorLength);
        continue;
      }

      const length = Number(match[1]);
      if (!Number.isFinite(length) || length < 0) {
        this.buffer = this.buffer.slice(headerEnd + separatorLength);
        continue;
      }

      const bodyStart = headerEnd + separatorLength;
      const bodyEnd = bodyStart + length;
      if (this.buffer.length < bodyEnd) break;

      const body = this.buffer.slice(bodyStart, bodyEnd).toString("utf8");
      this.buffer = this.buffer.slice(bodyEnd);

      try {
        messages.push(JSON.parse(body) as unknown);
      } catch {
        // ignore malformed message
      }
    }

    return messages;
  }

  private tryParseNewlineFrames(): unknown[] {
    const text = this.buffer.toString("utf8");
    const lines = text.split(/\r?\n/);
    const tail = lines.pop() ?? "";
    this.buffer = Buffer.from(tail, "utf8");
    const messages: unknown[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed) as unknown);
      } catch {
        // ignore
      }
    }
    return messages;
  }

  private onStdout(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    const framing = this.config.stdioFraming ?? "content-length";
    if (this.buffer.length > 1_000_000 && this.buffer.indexOf("Content-Length:") === -1) {
      // Prevent unbounded growth from non-protocol output.
      this.buffer = this.buffer.slice(-64_000);
    }

    const messages =
      framing === "newline"
        ? this.tryParseNewlineFrames()
        : (() => {
            const parsed = this.tryParseContentLengthFrames();
            if (parsed.length > 0) return parsed;
            // Fall back to newline framing only if we don't see any Content-Length header at all.
            if (this.buffer.indexOf("Content-Length:") === -1) {
              return this.tryParseNewlineFrames();
            }
            return parsed;
          })();

    for (const msg of messages) {
      if (!isJsonRpcResponse(msg)) continue;
      const id = msg.id;
      if (id == null) continue;
      const pending = this.pending.get(id);
      if (!pending) continue;
      this.pending.delete(id);
      pending.resolve(msg);
    }
  }

  private write(payload: JsonRpcRequest | JsonRpcNotification) {
    const json = JSON.stringify(payload);
    const framing = this.config.stdioFraming ?? "content-length";
    if (framing === "newline") {
      this.child.stdin.write(`${json}\n`);
      return;
    }
    const bytes = Buffer.byteLength(json, "utf8");
    const frame = `Content-Length: ${bytes}\r\n\r\n${json}`;
    this.child.stdin.write(frame);
  }

  private async request(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const payload: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    const requestTimeoutMs = (() => {
      const raw = this.config.requestTimeoutMs;
      return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 60000;
    })();
    const promise = new Promise<JsonRpcResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error("MCP request timed out."));
      }, requestTimeoutMs);
    });
    this.write(payload);
    return promise;
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    const protocolVersion =
      normalizeString(this.config.protocolVersion).trim() || "2024-11-05";
    const initRes = await this.request("initialize", {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "Prompt Tree", version: "0.1.0" },
    });
    ensureResult(initRes);
    await this.notify(buildInitializedNotification().method);
    this.initialized = true;
  }

  async listTools(): Promise<McpListToolsResult> {
    await this.ensureInitialized();
    const res = await this.request("tools/list", {});
    return normalizeToolsList(ensureResult(res));
  }

  async callTool(name: string, args: unknown): Promise<McpCallToolResult> {
    await this.ensureInitialized();
    const res = await this.request("tools/call", { name, arguments: args });
    return ensureResult(res) as McpCallToolResult;
  }

  async close(): Promise<void> {
    this.closePending(new Error("MCP client closed."));
    try {
      this.child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

type CachedClient = { updatedAt: number; client: McpClient };

const clientCache = new Map<string, CachedClient>();

async function createClient(
  entry: MCPServerEntry,
  options?: {
    onLog?: McpLogCallback;
    defaultStdioFraming?: "content-length" | "newline";
    forceStdioFraming?: "content-length" | "newline";
  },
): Promise<McpClient> {
  const config = parseConfigJson(entry);

  if (entry.transport === "http") {
    const url = normalizeUrl((config as HttpConfig).url);
    if (!url) throw new Error("Missing MCP http url in configJson.");
    return new StreamableHttpMcpClient(url, entry.token, config);
  }

  if (entry.transport === "sse") {
    const sseUrl = normalizeUrl((config as SseConfig).sseUrl);
    const messagesUrl = normalizeUrl((config as SseConfig).messagesUrl);
    if (!sseUrl || !messagesUrl) {
      throw new Error("Missing MCP sseUrl/messagesUrl in configJson.");
    }
    return new LegacySseMcpClient(sseUrl, messagesUrl, entry.token, config);
  }

  const command = normalizeString((config as StdioConfig).command).trim();
  if (!command) {
    throw new Error(
      'Missing MCP stdio command in configJson. Expected a JSON object like {"command":"npx","args":[...]} (or paste only the nested server object from {"mcpServers":{...}}).',
    );
  }
  const rawArgs = (config as StdioConfig).args;
  const args = Array.isArray(rawArgs)
    ? rawArgs.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const cwd = normalizeString((config as StdioConfig).cwd).trim() || undefined;
  const env = normalizeHeaders((config as StdioConfig).env);

  const stdioConfig = config as StdioConfig;
  const effectiveStdioFraming =
    options?.forceStdioFraming ??
    (stdioConfig.stdioFraming ?? options?.defaultStdioFraming);
  const effectiveConfig: StdioConfig = effectiveStdioFraming
    ? { ...stdioConfig, stdioFraming: effectiveStdioFraming }
    : stdioConfig;

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (options?.onLog) {
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("Content-Length:")) return;
      if (!text.trim()) return;
      options.onLog?.({ stream: "stdout", text });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (!text.trim()) return;
      options.onLog?.({ stream: "stderr", text });
    });
  }

  const requestTimeoutMs =
    typeof effectiveConfig.requestTimeoutMs === "number" &&
    Number.isFinite(effectiveConfig.requestTimeoutMs)
      ? Math.round(effectiveConfig.requestTimeoutMs)
      : command === "npx"
        ? 180000
        : 60000;

  return new StdioMcpClient(child, { ...effectiveConfig, requestTimeoutMs });
}

async function getClient(entry: MCPServerEntry): Promise<McpClient> {
  const cached = clientCache.get(entry.id);
  if (cached && cached.updatedAt === entry.updatedAt) return cached.client;

  if (cached) {
    await cached.client.close().catch(() => null);
  }
  const client = await createClient(entry);
  clientCache.set(entry.id, { updatedAt: entry.updatedAt, client });
  return client;
}

export async function mcpListTools(entry: MCPServerEntry): Promise<McpListToolsResult> {
  const client = await getClient(entry);
  return client.listTools();
}

export async function mcpCallTool(
  entry: MCPServerEntry,
  name: string,
  args: unknown,
): Promise<McpCallToolResult> {
  const client = await getClient(entry);
  return client.callTool(name, args);
}

export async function mcpTestListTools(
  entry: MCPServerEntry,
  onLog?: McpLogCallback,
): Promise<McpListToolsResult> {
  const client = await createClient(entry, { onLog, defaultStdioFraming: "newline" });
  try {
    return await client.listTools();
  } finally {
    await client.close().catch(() => null);
  }
}

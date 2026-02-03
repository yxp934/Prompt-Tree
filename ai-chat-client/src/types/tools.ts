/**
 * Tool toggles that the user can enable per message.
 *
 * Note: "mcp" is a legacy aggregate toggle kept for backwards compatibility.
 * New selections use `mcp:${serverId}` per MCP server.
 */
export type ToolUseId = "web_search" | "python" | "mcp" | `mcp:${string}`;

export type SearchProvider = "tavily" | "exa";

export type MCPTransport = "stdio" | "http" | "sse";

export interface ToolCallLog {
  id: string;
  tool: string;
  args: unknown;
  status: "running" | "success" | "error";
  startedAt: number;
  endedAt?: number;
  result?: unknown;
  error?: string;
}

export type AgentStreamEvent =
  | { type: "assistant_delta"; delta: string }
  | { type: "assistant_final"; content: string }
  | { type: "tool_call"; call: { id: string; name: string; arguments: unknown } }
  | { type: "tool_result"; callId: string; name: string; result: unknown }
  | { type: "tool_error"; callId: string; name: string; error: string }
  | { type: "debug"; message: string }
  | { type: "error"; message: string };

export interface SearchSettings {
  provider: SearchProvider;
  exaApiKey: string;
  tavilyApiKey: string;
  maxResults: number;
  searchDepth: "basic" | "advanced";
}

export interface MCPServerEntry {
  id: string;
  name: string;
  transport: MCPTransport;
  token: string;
  /**
   * Raw JSON provided by the user (no validation).
   * Parsed at runtime by transports.
   */
  configJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface MCPSettings {
  servers: MCPServerEntry[];
}

export interface PythonExecSettings {
  timeoutMs: number;
  maxOutputChars: number;
  pythonCommand: string;
}

export interface ToolSettings {
  search: SearchSettings;
  mcp: MCPSettings;
  python: PythonExecSettings;
}

import type { ToolSettings, ToolUseId, MCPServerEntry } from "@/types";

const TOOL_SETTINGS_KEY = "prompt-tree.tools.v1";
const DRAFT_TOOL_USES_KEY = "prompt-tree.draft_tool_uses.v1";

const LEGACY_TOOL_SETTINGS_KEYS = ["new-chat.tools.v1"];
const LEGACY_DRAFT_TOOL_USES_KEYS = ["new-chat.draft_tool_uses.v1"];

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  search: {
    provider: "tavily",
    exaApiKey: "",
    tavilyApiKey: "",
    maxResults: 5,
    searchDepth: "basic",
  },
  mcp: {
    servers: [],
  },
  python: {
    timeoutMs: 15000,
    maxOutputChars: 20000,
    pythonCommand: "python3",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function normalizeSearchDepth(value: unknown): "basic" | "advanced" {
  return value === "advanced" ? "advanced" : "basic";
}

function normalizeSearchProvider(value: unknown): "tavily" | "exa" {
  return value === "exa" ? "exa" : "tavily";
}

function normalizeMcpTransport(value: unknown): "stdio" | "http" | "sse" {
  if (value === "stdio" || value === "sse") return value;
  return "http";
}

function normalizeMcpServerEntry(value: unknown): MCPServerEntry | null {
  if (!isRecord(value)) return null;
  const id = normalizeString(value.id).trim();
  const name = normalizeString(value.name).trim();
  const transport = normalizeMcpTransport(value.transport);
  const token = normalizeString(value.token);
  const configJson = normalizeString(value.configJson);
  const createdAt = normalizeNumber(value.createdAt, Date.now());
  const updatedAt = normalizeNumber(value.updatedAt, Date.now());

  if (!id || !name) return null;
  return { id, name, transport, token, configJson, createdAt, updatedAt };
}

function normalizeToolSettings(value: unknown): ToolSettings {
  if (!isRecord(value)) return DEFAULT_TOOL_SETTINGS;

  const searchRaw = isRecord(value.search) ? value.search : {};
  const mcpRaw = isRecord(value.mcp) ? value.mcp : {};
  const pythonRaw = isRecord(value.python) ? value.python : {};

  const serversRaw = Array.isArray(mcpRaw.servers) ? mcpRaw.servers : [];
  const servers = serversRaw
    .map(normalizeMcpServerEntry)
    .filter((entry): entry is MCPServerEntry => Boolean(entry))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const maxResults = Math.round(
    normalizeNumber(searchRaw.maxResults, DEFAULT_TOOL_SETTINGS.search.maxResults),
  );

  return {
    search: {
      provider: normalizeSearchProvider(searchRaw.provider),
      exaApiKey: normalizeString(searchRaw.exaApiKey),
      tavilyApiKey: normalizeString(searchRaw.tavilyApiKey),
      maxResults: Math.min(20, Math.max(1, maxResults)),
      searchDepth: normalizeSearchDepth(searchRaw.searchDepth),
    },
    mcp: {
      servers,
    },
    python: {
      timeoutMs: Math.min(
        120000,
        Math.max(
          1000,
          Math.round(
            normalizeNumber(pythonRaw.timeoutMs, DEFAULT_TOOL_SETTINGS.python.timeoutMs),
          ),
        ),
      ),
      maxOutputChars: Math.min(
        200_000,
        Math.max(
          1000,
          Math.round(
            normalizeNumber(
              pythonRaw.maxOutputChars,
              DEFAULT_TOOL_SETTINGS.python.maxOutputChars,
            ),
          ),
        ),
      ),
      pythonCommand: normalizeString(pythonRaw.pythonCommand).trim() || "python3",
    },
  };
}

export function getStoredToolSettings(): ToolSettings {
  if (typeof window === "undefined") return DEFAULT_TOOL_SETTINGS;
  const stored = window.localStorage.getItem(TOOL_SETTINGS_KEY);
  if (stored) {
    try {
      return normalizeToolSettings(JSON.parse(stored) as unknown);
    } catch {
      // fall through to legacy keys
    }
  }

  for (const legacyKey of LEGACY_TOOL_SETTINGS_KEYS) {
    const legacy = window.localStorage.getItem(legacyKey);
    if (!legacy) continue;
    try {
      const normalized = normalizeToolSettings(JSON.parse(legacy) as unknown);
      window.localStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(normalized));
      window.localStorage.removeItem(legacyKey);
      return normalized;
    } catch {
      continue;
    }
  }

  return DEFAULT_TOOL_SETTINGS;
}

export function setStoredToolSettings(settings: ToolSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(settings));
  for (const legacyKey of LEGACY_TOOL_SETTINGS_KEYS) {
    window.localStorage.removeItem(legacyKey);
  }
}

export function getStoredDraftToolUses(): ToolUseId[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(DRAFT_TOOL_USES_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is ToolUseId => {
        if (typeof id !== "string") return false;
        if (id === "web_search" || id === "python" || id === "search_memory" || id === "mcp") {
          return true;
        }
        if (id.startsWith("mcp:")) return Boolean(id.slice("mcp:".length).trim());
        return false;
      });
    } catch {
      // fall through to legacy keys
    }
  }

  for (const legacyKey of LEGACY_DRAFT_TOOL_USES_KEYS) {
    const legacy = window.localStorage.getItem(legacyKey);
    if (!legacy) continue;
    try {
      const parsed = JSON.parse(legacy) as unknown;
      if (!Array.isArray(parsed)) continue;
      const normalized = parsed.filter((id): id is ToolUseId => {
        if (typeof id !== "string") return false;
        if (id === "web_search" || id === "python" || id === "search_memory" || id === "mcp") {
          return true;
        }
        if (id.startsWith("mcp:")) return Boolean(id.slice("mcp:".length).trim());
        return false;
      });
      window.localStorage.setItem(DRAFT_TOOL_USES_KEY, JSON.stringify(normalized));
      window.localStorage.removeItem(legacyKey);
      return normalized;
    } catch {
      continue;
    }
  }

  // Default: enable search_memory for new installs (can be toggled off per message).
  return ["search_memory"];
}

export function setStoredDraftToolUses(toolUses: ToolUseId[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_TOOL_USES_KEY, JSON.stringify(toolUses));
  for (const legacyKey of LEGACY_DRAFT_TOOL_USES_KEYS) {
    window.localStorage.removeItem(legacyKey);
  }
}

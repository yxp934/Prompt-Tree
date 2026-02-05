import type { StateCreator } from "zustand";

import {
  DEFAULT_TOOL_SETTINGS,
  getStoredDraftToolUses,
  getStoredToolSettings,
  setStoredDraftToolUses,
  setStoredToolSettings,
} from "@/lib/services/toolSettingsService";
import { NodeType, type MCPServerEntry, type ToolSettings, type ToolUseId } from "@/types";

import type { AppStoreState } from "./useStore";

export interface ToolSlice {
  toolSettings: ToolSettings;
  draftToolUses: ToolUseId[];
  hydrateToolsFromStorage: () => void;

  setToolSettings: (next: ToolSettings) => void;
  setDraftToolUses: (toolUses: ToolUseId[]) => void;
  toggleDraftToolUse: (toolUse: ToolUseId) => void;

  upsertMcpServer: (entry: Omit<MCPServerEntry, "createdAt" | "updatedAt">) => void;
  deleteMcpServer: (id: string) => void;

  syncToolsToNode: (nodeId: string) => void;
}

function normalizeToolUses(value: ToolUseId[]): ToolUseId[] {
  const unique: ToolUseId[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    const id = typeof raw === "string" ? raw.trim() : "";
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

  // Legacy aggregate MCP selection: prefer explicit server toggles.
  if (unique.includes("mcp")) {
    return unique.filter(
      (id) => id === "web_search" || id === "python" || id === "search_memory" || id === "mcp",
    );
  }

  return unique;
}

function expandLegacyMcpToolUses(toolUses: ToolUseId[], settings: ToolSettings): ToolUseId[] {
  if (!toolUses.includes("mcp")) return toolUses;
  const servers = settings.mcp.servers;
  const serverToolUses = servers.map((s) => `mcp:${s.id}` as ToolUseId);
  const base = toolUses.filter((id) => id !== "mcp");
  return normalizeToolUses([...base, ...serverToolUses]);
}

function pruneToolUses(toolUses: ToolUseId[], settings: ToolSettings): ToolUseId[] {
  const serverIds = new Set(settings.mcp.servers.map((s) => s.id));
  return toolUses.filter((id) => {
    if (id === "web_search" || id === "python" || id === "search_memory" || id === "mcp") {
      return true;
    }
    if (!id.startsWith("mcp:")) return false;
    const serverId = id.slice("mcp:".length).trim();
    return Boolean(serverId && serverIds.has(serverId));
  });
}

export function createToolSlice(): StateCreator<AppStoreState, [], [], ToolSlice> {
  return (set, get) => ({
    toolSettings: DEFAULT_TOOL_SETTINGS,
    draftToolUses: [],
    hydrateToolsFromStorage: () => {
      const settings = getStoredToolSettings();
      const storedDraftUses = getStoredDraftToolUses();
      const draftToolUses = pruneToolUses(
        expandLegacyMcpToolUses(normalizeToolUses(storedDraftUses), settings),
        settings,
      );
      set({ toolSettings: settings, draftToolUses });
    },

    setToolSettings: (next) => {
      setStoredToolSettings(next);
      set((state) => {
        const draftToolUses = pruneToolUses(
          expandLegacyMcpToolUses(state.draftToolUses, next),
          next,
        );
        setStoredDraftToolUses(draftToolUses);
        return { toolSettings: next, draftToolUses };
      });
    },

    setDraftToolUses: (toolUses) => {
      const settings = get().toolSettings;
      const normalized = pruneToolUses(
        expandLegacyMcpToolUses(normalizeToolUses(toolUses), settings),
        settings,
      );
      const memoryToolAllowed =
        get().longTermMemorySettings.enabled && get().longTermMemorySettings.enableMemorySearchTool;
      const gated = memoryToolAllowed
        ? normalized
        : normalized.filter((id) => id !== "search_memory");
      setStoredDraftToolUses(gated);
      set({ draftToolUses: gated });
    },

    toggleDraftToolUse: (toolUse) => {
      const current = get().draftToolUses;
      const next = current.includes(toolUse)
        ? current.filter((id) => id !== toolUse)
        : [...current, toolUse];
      get().setDraftToolUses(next);
    },

    upsertMcpServer: (entry) => {
      const now = Date.now();
      const id = entry.id.trim();

      set((state) => {
        const prev = state.toolSettings;
        const servers = prev.mcp.servers.slice();
        const index = servers.findIndex((item) => item.id === id);
        const nextEntry: MCPServerEntry = {
          ...entry,
          id,
          createdAt: index >= 0 ? servers[index]!.createdAt : now,
          updatedAt: now,
        };
        if (index >= 0) servers[index] = nextEntry;
        else servers.push(nextEntry);

        const next: ToolSettings = {
          ...prev,
          mcp: { ...prev.mcp, servers: servers.sort((a, b) => b.updatedAt - a.updatedAt) },
        };
        setStoredToolSettings(next);
        return { toolSettings: next };
      });
    },

    deleteMcpServer: (id) => {
      set((state) => {
        const prev = state.toolSettings;
        const next: ToolSettings = {
          ...prev,
          mcp: { ...prev.mcp, servers: prev.mcp.servers.filter((s) => s.id !== id) },
        };
        const draftToolUses = pruneToolUses(state.draftToolUses, next);
        setStoredToolSettings(next);
        setStoredDraftToolUses(draftToolUses);
        return { toolSettings: next, draftToolUses };
      });
    },

    syncToolsToNode: (nodeId) => {
      const node = get().nodes.get(nodeId);
      if (!node) return;

      if (node.type === NodeType.USER) {
        const toolUses = node.metadata.toolUses ?? [];
        get().setDraftToolUses(toolUses);
        return;
      }

      if (node.type === NodeType.ASSISTANT) {
        const parentId = node.parentId;
        if (!parentId) return;
        const parent = get().nodes.get(parentId);
        if (!parent || parent.type !== NodeType.USER) return;
        const toolUses = parent.metadata.toolUses ?? [];
        get().setDraftToolUses(toolUses);
      }
    },
  });
}

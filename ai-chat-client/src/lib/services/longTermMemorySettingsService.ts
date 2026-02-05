import type { LongTermMemorySettings } from "@/types";
import type { ProviderModelSelection } from "@/types/provider";

export const DEFAULT_LONG_TERM_MEMORY_SETTINGS: LongTermMemorySettings = {
  enabled: true,
  autoInjectOnFirstMessage: true,
  enableMemorySearchTool: true,

  memoryWriterModel: null,
  embeddingModel: null,

  maxAutoMemoriesPerThread: 25,
  maxPinnedMemoriesPerThread: 25,

  enableProfileUpdates: true,
  enableFolderDocUpdates: true,
  enableMemoryUpdates: true,

  forceFirstMessageMemoryUpsert: true,
  forceFirstMessageFolderDocUpsert: true,
};

const STORAGE_KEY = "prompt-tree.long_term_memory_settings.v1";
const LEGACY_KEYS = ["new-chat.long_term_memory_settings.v1"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeModelSelection(value: unknown): ProviderModelSelection | null {
  if (!isRecord(value)) return null;
  const providerId = typeof value.providerId === "string" ? value.providerId : "";
  const modelId = typeof value.modelId === "string" ? value.modelId : "";
  if (!providerId.trim() || !modelId.trim()) return null;
  return { providerId: providerId.trim(), modelId: modelId.trim() };
}

export function normalizeLongTermMemorySettings(
  value: unknown,
  fallback: LongTermMemorySettings = DEFAULT_LONG_TERM_MEMORY_SETTINGS,
): LongTermMemorySettings {
  if (!isRecord(value)) return fallback;

  return {
    enabled: normalizeBoolean(value.enabled, fallback.enabled),
    autoInjectOnFirstMessage: normalizeBoolean(
      value.autoInjectOnFirstMessage,
      fallback.autoInjectOnFirstMessage,
    ),
    enableMemorySearchTool: normalizeBoolean(
      value.enableMemorySearchTool,
      fallback.enableMemorySearchTool,
    ),

    memoryWriterModel: Object.prototype.hasOwnProperty.call(value, "memoryWriterModel")
      ? normalizeModelSelection(value.memoryWriterModel)
      : fallback.memoryWriterModel,
    embeddingModel: Object.prototype.hasOwnProperty.call(value, "embeddingModel")
      ? normalizeModelSelection(value.embeddingModel)
      : fallback.embeddingModel,

    maxAutoMemoriesPerThread: Math.min(
      200,
      Math.max(0, Math.round(normalizeNumber(value.maxAutoMemoriesPerThread, fallback.maxAutoMemoriesPerThread))),
    ),
    maxPinnedMemoriesPerThread: Math.min(
      200,
      Math.max(0, Math.round(normalizeNumber(value.maxPinnedMemoriesPerThread, fallback.maxPinnedMemoriesPerThread))),
    ),

    enableProfileUpdates: normalizeBoolean(value.enableProfileUpdates, fallback.enableProfileUpdates),
    enableFolderDocUpdates: normalizeBoolean(value.enableFolderDocUpdates, fallback.enableFolderDocUpdates),
    enableMemoryUpdates: normalizeBoolean(value.enableMemoryUpdates, fallback.enableMemoryUpdates),

    forceFirstMessageMemoryUpsert: normalizeBoolean(
      value.forceFirstMessageMemoryUpsert,
      fallback.forceFirstMessageMemoryUpsert,
    ),
    forceFirstMessageFolderDocUpsert: normalizeBoolean(
      value.forceFirstMessageFolderDocUpsert,
      fallback.forceFirstMessageFolderDocUpsert,
    ),
  };
}

export function getStoredLongTermMemorySettings(): LongTermMemorySettings | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return normalizeLongTermMemorySettings(JSON.parse(raw));
    } catch {
      // fallthrough
    }
  }

  for (const key of LEGACY_KEYS) {
    const legacy = localStorage.getItem(key);
    if (!legacy) continue;
    try {
      const parsed = JSON.parse(legacy) as unknown;
      const normalized = normalizeLongTermMemorySettings(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      localStorage.removeItem(key);
      return normalized;
    } catch {
      continue;
    }
  }

  return null;
}

export function setStoredLongTermMemorySettings(settings: LongTermMemorySettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}


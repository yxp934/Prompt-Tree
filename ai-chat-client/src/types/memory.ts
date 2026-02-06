import type { ProviderModelSelection } from "./provider";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type MemoryScope = "user" | "folder";
export type MemoryStatus = "active" | "superseded" | "deleted";
export type MemoryConfidence = "low" | "medium" | "high";

export interface MemorySourceRef {
  treeId: string;
  nodeId: string;
  createdAt: number;
}

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  folderId?: string | null;
  text: string;
  tags: string[];
  confidence: MemoryConfidence;
  status: MemoryStatus;
  createdAt: number;
  updatedAt: number;
  sources: MemorySourceRef[];
  embedding?: number[];
  embeddingModelKey?: string;
}

export interface UserProfileDoc {
  id: string;
  version: number;
  updatedAt: number;
  data: JsonObject;
}

export interface FolderDoc {
  folderId: string;
  version: number;
  updatedAt: number;
  data: JsonObject;
}

export type JsonPatchOp =
  | { op: "set"; path: string; value: JsonValue }
  | { op: "merge"; path: string; value: JsonObject }
  | { op: "append_unique"; path: string; value: JsonValue }
  | { op: "remove"; path: string };

export interface MemoryUpsertInput {
  text: string;
  tags: string[];
  scope: MemoryScope;
  folderId?: string | null;
  confidence?: MemoryConfidence;
  supersedes?: string[];
}

export interface MemoryWriterPlan {
  profilePatch?: JsonPatchOp[];
  folderDocPatch?: JsonPatchOp[];
  memoryUpserts?: MemoryUpsertInput[];
  notes?: string;
}

export interface LongTermMemorySettings {
  enabled: boolean;
  autoInjectOnFirstMessage: boolean;
  autoInjectRecentMessagesOnFirstMessage: boolean;
  autoInjectRecentMessagesCount: number;
  enableMemorySearchTool: boolean;

  memoryWriterModel: ProviderModelSelection | null;
  embeddingModel: ProviderModelSelection | null;

  maxAutoMemoriesPerThread: number;
  maxPinnedMemoriesPerThread: number;

  enableProfileUpdates: boolean;
  enableFolderDocUpdates: boolean;
  enableMemoryUpdates: boolean;

  forceFirstMessageMemoryUpsert: boolean;
  forceFirstMessageFolderDocUpsert: boolean;
}

import type { CSSProperties } from "react";

export enum NodeType {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
  COMPRESSED = "compressed",
}

export interface NodeMetaInstructions {
  language?: string;
  format?: string;
  role?: string;
  [key: string]: unknown;
}

export interface NodeMetadata {
  tags: string[];
  metaInstructions: NodeMetaInstructions;
  compressedNodeIds?: string[];
  collapsed?: boolean;
  branchLabel?: string;
  modelId?: string;
  modelName?: string;
  providerId?: string;
  providerName?: string;
  toolUses?: import("./tools").ToolUseId[];
  toolLogs?: import("./tools").ToolCallLog[];
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: NodeType;
  createdAt: number;
  updatedAt: number;
  parentId: string | null;
  content: string;
  summary?: string;
  metadata: NodeMetadata;
  tokenCount: number;
  position?: NodePosition;
  style?: CSSProperties;
}

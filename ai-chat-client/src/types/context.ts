export interface ContextBox {
  id: string;
  blocks: ContextBlock[];
  totalTokens: number;
  maxTokens: number;
  createdAt: number;
}

export type ContextBlock = ContextNodeBlock | ContextFileBlock;

export interface ContextNodeBlock {
  /**
   * Block id. For node blocks, we use nodeId as id for easy interop with drag/drop.
   */
  id: string;
  kind: "node";
  nodeId: string;
}

export type SupportedImageMime = "image/png" | "image/jpeg" | "image/webp";

export type ContextFileKind = "text" | "markdown" | "pdf" | "image";

export interface ContextFileBlockBase {
  id: string;
  kind: "file";
  fileKind: ContextFileKind;
  filename: string;
  mimeType: string;
  createdAt: number;
  tokenCount: number;
}

export interface ContextTextFileBlock extends ContextFileBlockBase {
  fileKind: "text" | "markdown" | "pdf";
  content: string;
  truncated: boolean;
}

export interface ContextImageFileBlock extends ContextFileBlockBase {
  fileKind: "image";
  mimeType: SupportedImageMime;
  dataUrl: string;
  size: number;
}

export type ContextFileBlock = ContextTextFileBlock | ContextImageFileBlock;

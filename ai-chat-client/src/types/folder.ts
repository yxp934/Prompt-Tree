import type { ProviderModelSelection } from "./provider";

export interface ConversationFolder {
  id: string;
  name: string;
  systemPrompt: string;
  memoryRag?: {
    topKFolder: number;
    topKUser: number;
  };
  /**
   * Folder-scoped enabled models (picked from globally enabled provider models).
   * - null/undefined: inherit all globally enabled models
   * - []: none selected
   */
  enabledModels?: ProviderModelSelection[] | null;
  createdAt: number;
  updatedAt: number;
}

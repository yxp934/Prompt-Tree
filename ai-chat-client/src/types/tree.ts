export interface ConversationTree {
  id: string;
  rootId: string;
  title: string;
  folderId?: string | null;
  createdAt: number;
  updatedAt: number;
}

import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils/uuid";
import type { ConversationFolder } from "@/types";
import type { ProviderModelSelection } from "@/types/provider";

const DEFAULT_FOLDER_NAME = "Folder";
const DEFAULT_SYSTEM_PROMPT = "You are Prompt Tree, a helpful assistant.";
const MAX_FOLDER_NAME_CHARS = 20;
const DEFAULT_MEMORY_RAG = { topKFolder: 5, topKUser: 5 };

function truncateChars(input: string, maxChars: number): string {
  const chars = Array.from(input);
  if (chars.length <= maxChars) return input;
  return chars.slice(0, maxChars).join("");
}

export class FolderService {
  async create(name?: string): Promise<ConversationFolder> {
    const now = Date.now();
    const trimmed = name?.trim() ?? "";

    const folder: ConversationFolder = {
      id: generateUUID(),
      name: truncateChars(trimmed || DEFAULT_FOLDER_NAME, MAX_FOLDER_NAME_CHARS),
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      memoryRag: DEFAULT_MEMORY_RAG,
      enabledModels: null,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).put(folder);
    await transactionToPromise(tx);
    return folder;
  }

  async read(id: string): Promise<ConversationFolder | null> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.folders.name);
    const folder = await requestToPromise<ConversationFolder | undefined>(
      store.get(id) as IDBRequest<ConversationFolder | undefined>,
    );
    await transactionToPromise(tx);
    return folder ?? null;
  }

  async list(): Promise<ConversationFolder[]> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.folders.name);
    const all = await requestToPromise<ConversationFolder[]>(
      store.getAll() as IDBRequest<ConversationFolder[]>,
    );
    await transactionToPromise(tx);
    return (all ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateName(id: string, name: string): Promise<ConversationFolder> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Folder ${id} not found`);

    const next: ConversationFolder = {
      ...existing,
      name: truncateChars(name.trim() || existing.name, MAX_FOLDER_NAME_CHARS),
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async updateSystemPrompt(id: string, systemPrompt: string): Promise<ConversationFolder> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Folder ${id} not found`);

    const next: ConversationFolder = {
      ...existing,
      systemPrompt,
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async updateEnabledModels(
    id: string,
    enabledModels: ProviderModelSelection[] | null,
  ): Promise<ConversationFolder> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Folder ${id} not found`);

    const next: ConversationFolder = {
      ...existing,
      enabledModels,
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async updateMemoryRag(
    id: string,
    memoryRag: ConversationFolder["memoryRag"],
  ): Promise<ConversationFolder> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Folder ${id} not found`);

    const next: ConversationFolder = {
      ...existing,
      memoryRag: memoryRag ?? existing.memoryRag ?? DEFAULT_MEMORY_RAG,
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async touch(id: string): Promise<ConversationFolder> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Folder ${id} not found`);

    const next: ConversationFolder = { ...existing, updatedAt: Date.now() };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async delete(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folders.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folders.name).delete(id);
    await transactionToPromise(tx);
  }
}

import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import type { ContextBox, ContextNodeBlock } from "@/types";

type LegacyContextBox = {
  id: string;
  nodeIds: string[];
  totalTokens: number;
  maxTokens: number;
  createdAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyContextBox(value: unknown): value is LegacyContextBox {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    Array.isArray(value.nodeIds) &&
    typeof value.totalTokens === "number" &&
    typeof value.maxTokens === "number" &&
    typeof value.createdAt === "number"
  );
}

function isContextBox(value: unknown): value is ContextBox {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    Array.isArray(value.blocks) &&
    typeof value.totalTokens === "number" &&
    typeof value.maxTokens === "number" &&
    typeof value.createdAt === "number"
  );
}

function migrateLegacyContextBox(box: LegacyContextBox): ContextBox {
  const blocks: ContextNodeBlock[] = box.nodeIds
    .filter((id) => typeof id === "string" && id.trim())
    .map((nodeId) => ({
      id: nodeId,
      kind: "node",
      nodeId,
    }));
  return {
    id: box.id,
    blocks,
    totalTokens: box.totalTokens,
    maxTokens: box.maxTokens,
    createdAt: box.createdAt,
  };
}

export class ContextBoxService {
  async read(id: string): Promise<ContextBox | null> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.contextBoxes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.contextBoxes.name);
    const raw = await requestToPromise<unknown>(
      store.get(id) as IDBRequest<unknown>,
    );
    await transactionToPromise(tx);
    if (raw == null) return null;
    if (isContextBox(raw)) return raw;
    if (isLegacyContextBox(raw)) {
      const migrated = migrateLegacyContextBox(raw);
      await this.put(migrated);
      return migrated;
    }
    throw new Error(`Invalid ContextBox payload for ${id}`);
  }

  async put(box: ContextBox): Promise<ContextBox> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.contextBoxes.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.contextBoxes.name).put(box);
    await transactionToPromise(tx);
    return box;
  }

  async update(id: string, updates: Partial<ContextBox>): Promise<ContextBox> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`ContextBox ${id} not found`);

    const next: ContextBox = {
      ...existing,
      ...updates,
      id,
    };

    await this.put(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.contextBoxes.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.contextBoxes.name).delete(id);
    await transactionToPromise(tx);
  }
}

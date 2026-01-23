import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import type { ContextBox } from "@/types";

export class ContextBoxService {
  async read(id: string): Promise<ContextBox | null> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.contextBoxes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.contextBoxes.name);
    const box = await requestToPromise<ContextBox | undefined>(
      store.get(id) as IDBRequest<ContextBox | undefined>,
    );
    await transactionToPromise(tx);
    return box ?? null;
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


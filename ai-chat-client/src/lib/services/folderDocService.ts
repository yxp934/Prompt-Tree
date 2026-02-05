import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import type { FolderDoc, JsonPatchOp } from "@/types";

import { applyJsonPatch } from "./jsonPatch";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFolderDoc(value: unknown): value is FolderDoc {
  if (!isRecord(value)) return false;
  return (
    typeof value.folderId === "string" &&
    typeof value.version === "number" &&
    typeof value.updatedAt === "number" &&
    isRecord(value.data)
  );
}

export class FolderDocService {
  async read(folderId: string): Promise<FolderDoc> {
    const id = folderId.trim();
    if (!id) {
      throw new Error("FolderDocService.read: missing folderId");
    }

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folderDocs.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.folderDocs.name);
    const raw = await requestToPromise<unknown>(
      store.get(id) as IDBRequest<unknown>,
    );
    await transactionToPromise(tx);

    if (raw && isFolderDoc(raw)) return raw;

    const created: FolderDoc = {
      folderId: id,
      version: 1,
      updatedAt: Date.now(),
      data: {
        summary: "",
        keyFacts: [],
        conventions: [],
        openLoops: [],
        notes: [],
      },
    };
    await this.put(created);
    return created;
  }

  async put(doc: FolderDoc): Promise<FolderDoc> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.folderDocs.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.folderDocs.name).put(doc);
    await transactionToPromise(tx);
    return doc;
  }

  async patch(folderId: string, ops: JsonPatchOp[]): Promise<FolderDoc> {
    const existing = await this.read(folderId);
    const next: FolderDoc = {
      ...existing,
      version: existing.version + 1,
      updatedAt: Date.now(),
      data: applyJsonPatch(existing.data, ops),
    };
    await this.put(next);
    return next;
  }

  async replaceData(folderId: string, data: FolderDoc["data"]): Promise<FolderDoc> {
    const existing = await this.read(folderId);
    const next: FolderDoc = {
      ...existing,
      version: existing.version + 1,
      updatedAt: Date.now(),
      data,
    };
    await this.put(next);
    return next;
  }
}


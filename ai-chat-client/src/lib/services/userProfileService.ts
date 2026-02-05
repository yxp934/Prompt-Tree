import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import type { JsonPatchOp, UserProfileDoc } from "@/types";

import { applyJsonPatch } from "./jsonPatch";

const DEFAULT_PROFILE_ID = "default";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUserProfileDoc(value: unknown): value is UserProfileDoc {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.version === "number" &&
    typeof value.updatedAt === "number" &&
    isRecord(value.data)
  );
}

export class UserProfileService {
  async read(): Promise<UserProfileDoc> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.userProfiles.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.userProfiles.name);
    const raw = await requestToPromise<unknown>(
      store.get(DEFAULT_PROFILE_ID) as IDBRequest<unknown>,
    );
    await transactionToPromise(tx);

    if (raw && isUserProfileDoc(raw)) return raw;

    const created: UserProfileDoc = {
      id: DEFAULT_PROFILE_ID,
      version: 1,
      updatedAt: Date.now(),
      data: {
        identity: {},
        preferences: {},
        constraints: [],
        goals: [],
        notes: [],
      },
    };
    await this.put(created);
    return created;
  }

  async put(doc: UserProfileDoc): Promise<UserProfileDoc> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.userProfiles.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.userProfiles.name).put(doc);
    await transactionToPromise(tx);
    return doc;
  }

  async patch(ops: JsonPatchOp[]): Promise<UserProfileDoc> {
    const existing = await this.read();
    const next: UserProfileDoc = {
      ...existing,
      version: existing.version + 1,
      updatedAt: Date.now(),
      data: applyJsonPatch(existing.data, ops),
    };
    await this.put(next);
    return next;
  }

  async replaceData(data: UserProfileDoc["data"]): Promise<UserProfileDoc> {
    const existing = await this.read();
    const next: UserProfileDoc = {
      ...existing,
      version: existing.version + 1,
      updatedAt: Date.now(),
      data,
    };
    await this.put(next);
    return next;
  }
}


import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils/uuid";
import type {
  MemoryItem,
  MemoryScope,
  MemorySourceRef,
  MemoryStatus,
  MemoryUpsertInput,
} from "@/types";

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, "-").toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    a2 += av * av;
    b2 += bv * bv;
  }
  const denom = Math.sqrt(a2) * Math.sqrt(b2);
  if (!denom) return 0;
  return dot / denom;
}

function lexicalScore(query: string, item: MemoryItem): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const text = `${item.text} ${item.tags.join(" ")}`.toLowerCase();
  if (text.includes(q)) return 1;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 0;
  let hits = 0;
  for (const p of parts) {
    if (p.length < 2) continue;
    if (text.includes(p)) hits += 1;
  }
  return hits / Math.max(1, parts.length);
}

export interface MemoryListParams {
  scope?: MemoryScope;
  folderId?: string | null;
  status?: MemoryStatus;
  tagsAny?: string[];
}

export interface MemorySearchParams {
  query: string;
  topK: number;
  scope?: MemoryScope | "both";
  folderId?: string | null;
  tagsAny?: string[];
  queryEmbedding?: number[] | null;
  embeddingModelKey?: string | null;
}

export class MemoryBankService {
  async list(params?: MemoryListParams): Promise<MemoryItem[]> {
    const scope = params?.scope;
    const folderId = params?.folderId ?? null;
    const status = params?.status;
    const tagsAny = (params?.tagsAny ?? []).map(normalizeTag).filter(Boolean);

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.memoryItems.name);

    const raw = await (async () => {
      if (scope) {
        const index = store.index("scope");
        return requestToPromise<MemoryItem[]>(
          index.getAll(scope) as IDBRequest<MemoryItem[]>,
        );
      }
      return requestToPromise<MemoryItem[]>(store.getAll() as IDBRequest<MemoryItem[]>);
    })();

    await transactionToPromise(tx);

    const filtered = (raw ?? []).filter((item) => {
      if (status && item.status !== status) return false;
      if (scope && item.scope !== scope) return false;
      if (folderId != null) {
        if ((item.folderId ?? null) !== folderId) return false;
      }
      if (tagsAny.length > 0) {
        const set = new Set(item.tags.map(normalizeTag));
        if (!tagsAny.some((t) => set.has(t))) return false;
      }
      return true;
    });

    filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    return filtered;
  }

  async upsert(input: {
    item: MemoryUpsertInput;
    source?: MemorySourceRef;
    embedding?: number[] | null;
    embeddingModelKey?: string | null;
  }): Promise<MemoryItem> {
    const now = Date.now();
    const normalizedText = normalizeText(input.item.text);
    if (!normalizedText) {
      throw new Error("Memory text is empty.");
    }

    const tags = uniqueStrings(input.item.tags.map(normalizeTag));
    const scope = input.item.scope;
    const folderId = scope === "folder" ? (input.item.folderId ?? null) : null;

    const existing = await this.findDuplicate({
      scope,
      folderId,
      normalizedText,
    });

    const nextSource = input.source ? [input.source] : [];
    const confidence = input.item.confidence ?? "medium";

    const upserted: MemoryItem = existing
      ? {
          ...existing,
          text: normalizedText,
          tags: uniqueStrings([...existing.tags, ...tags]),
          confidence,
          status: existing.status === "deleted" ? "active" : existing.status,
          updatedAt: now,
          sources: mergeSources(existing.sources, nextSource),
          ...(input.embedding && input.embeddingModelKey
            ? { embedding: input.embedding, embeddingModelKey: input.embeddingModelKey }
            : {}),
        }
      : {
          id: generateUUID(),
          scope,
          folderId,
          text: normalizedText,
          tags,
          confidence,
          status: "active",
          createdAt: now,
          updatedAt: now,
          sources: nextSource,
          ...(input.embedding && input.embeddingModelKey
            ? { embedding: input.embedding, embeddingModelKey: input.embeddingModelKey }
            : {}),
        };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.memoryItems.name).put(upserted);
    await transactionToPromise(tx);

    if (input.item.supersedes?.length) {
      await this.markSuperseded(input.item.supersedes);
    }

    return upserted;
  }

  async updateEmbedding(params: {
    id: string;
    embedding: number[];
    embeddingModelKey: string;
  }): Promise<void> {
    const id = params.id.trim();
    if (!id) return;
    const existing = await this.read(id);
    if (!existing) return;

    const next: MemoryItem = {
      ...existing,
      embedding: params.embedding,
      embeddingModelKey: params.embeddingModelKey,
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.memoryItems.name).put(next);
    await transactionToPromise(tx);
  }

  async edit(params: { id: string; text: string; tags: string[] }): Promise<MemoryItem> {
    const existing = await this.read(params.id);
    if (!existing) throw new Error(`Memory item not found: ${params.id}`);
    const next: MemoryItem = {
      ...existing,
      text: normalizeText(params.text),
      tags: uniqueStrings(params.tags.map(normalizeTag)),
      updatedAt: Date.now(),
    };
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.memoryItems.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.read(id);
    if (!existing) return;
    if (existing.status === "deleted") return;
    const next: MemoryItem = { ...existing, status: "deleted", updatedAt: Date.now() };
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.memoryItems.name).put(next);
    await transactionToPromise(tx);
  }

  async restore(id: string): Promise<void> {
    const existing = await this.read(id);
    if (!existing) return;
    if (existing.status !== "deleted") return;
    const next: MemoryItem = { ...existing, status: "active", updatedAt: Date.now() };
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.memoryItems.name).put(next);
    await transactionToPromise(tx);
  }

  async search(params: MemorySearchParams): Promise<Array<MemoryItem & { score: number }>> {
    const topK = Math.max(1, Math.min(50, Math.round(params.topK)));
    const scope = params.scope ?? "both";
    const folderId = params.folderId ?? null;
    const tagsAny = (params.tagsAny ?? []).map(normalizeTag).filter(Boolean);
    const query = params.query.trim();
    if (!query) return [];

    const candidates = await this.list({
      ...(scope === "both" ? {} : { scope }),
      ...(scope === "folder" ? { folderId } : {}),
      status: "active",
      ...(tagsAny.length ? { tagsAny } : {}),
    });

    const embeddingOk =
      Array.isArray(params.queryEmbedding) &&
      params.queryEmbedding.length > 0 &&
      typeof params.embeddingModelKey === "string" &&
      params.embeddingModelKey.trim().length > 0;

    const scored = candidates
      .filter((item) => {
        if (scope === "folder") return item.scope === "folder" && (item.folderId ?? null) === folderId;
        if (scope === "user") return item.scope === "user";
        if (scope === "both") {
          if (folderId == null) return true;
          // When folderId is set and scope is both, include folder mems for that folder plus user mems.
          if (item.scope === "user") return true;
          return (item.folderId ?? null) === folderId;
        }
        return true;
      })
      .map((item) => {
        const score = (() => {
          if (
            embeddingOk &&
            item.embeddingModelKey === params.embeddingModelKey &&
            Array.isArray(item.embedding) &&
            item.embedding.length > 0
          ) {
            return cosineSimilarity(params.queryEmbedding as number[], item.embedding);
          }
          return lexicalScore(query, item);
        })();
        return { ...item, score };
      })
      .filter((item) => item.score > 0);

    scored.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
    return scored.slice(0, topK);
  }

  private async read(id: string): Promise<MemoryItem | null> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.memoryItems.name);
    const raw = await requestToPromise<MemoryItem | undefined>(
      store.get(id) as IDBRequest<MemoryItem | undefined>,
    );
    await transactionToPromise(tx);
    return raw ?? null;
  }

  private async findDuplicate(params: {
    scope: MemoryScope;
    folderId: string | null;
    normalizedText: string;
  }): Promise<MemoryItem | null> {
    const list = await this.list({
      scope: params.scope,
      ...(params.scope === "folder" ? { folderId: params.folderId } : {}),
    });
    const hit = list.find((item) => normalizeText(item.text) === params.normalizedText) ?? null;
    return hit;
  }

  private async markSuperseded(ids: string[]): Promise<void> {
    const unique = uniqueStrings(ids);
    if (unique.length === 0) return;

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.memoryItems.name], "readwrite");
    const store = tx.objectStore(DB_CONFIG.stores.memoryItems.name);

    for (const id of unique) {
      const existing = await requestToPromise<MemoryItem | undefined>(
        store.get(id) as IDBRequest<MemoryItem | undefined>,
      );
      if (!existing) continue;
      if (existing.status === "superseded") continue;
      store.put({ ...existing, status: "superseded", updatedAt: Date.now() });
    }

    await transactionToPromise(tx);
  }
}

function mergeSources(existing: MemorySourceRef[], incoming: MemorySourceRef[]): MemorySourceRef[] {
  if (incoming.length === 0) return existing;
  const next = existing.slice();
  const key = (s: MemorySourceRef) => `${s.treeId}:${s.nodeId}`;
  const seen = new Set(next.map(key));
  for (const s of incoming) {
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    next.push(s);
  }
  next.sort((a, b) => a.createdAt - b.createdAt);
  return next;
}

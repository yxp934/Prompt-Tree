import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { estimateTokens } from "@/lib/utils/tokens";
import { generateUUID } from "@/lib/utils/uuid";
import { NodeType, type Node, type NodeMetadata } from "@/types";

function normalizeMetadata(metadata: Partial<NodeMetadata> | undefined): NodeMetadata {
  return {
    tags: metadata?.tags ?? [],
    metaInstructions: metadata?.metaInstructions ?? {},
    compressedNodeIds: metadata?.compressedNodeIds,
    collapsed: metadata?.collapsed,
  };
}

function shouldRecomputeTokens(updates: Partial<Node>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(updates, "content") ||
    Object.prototype.hasOwnProperty.call(updates, "summary") ||
    Object.prototype.hasOwnProperty.call(updates, "type")
  );
}

export class NodeService {
  async create(data: Partial<Node>): Promise<Node> {
    const now = Date.now();
    const createdAt = data.createdAt ?? now;
    const updatedAt = data.updatedAt ?? createdAt;
    const type = data.type ?? NodeType.USER;
    const content = data.content ?? "";
    const summary = data.summary;

    const tokenBasis =
      type === NodeType.COMPRESSED ? summary ?? content : content;

    const node: Node = {
      id: data.id ?? generateUUID(),
      type,
      createdAt,
      updatedAt,
      parentId: data.parentId ?? null,
      content,
      summary,
      metadata: normalizeMetadata(data.metadata),
      tokenCount: data.tokenCount ?? estimateTokens(tokenBasis),
      position: data.position,
      style: data.style,
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readwrite");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    store.put(node);
    await transactionToPromise(tx);
    return node;
  }

  async read(id: string): Promise<Node | null> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    const node = await requestToPromise<Node | undefined>(
      store.get(id) as IDBRequest<Node | undefined>,
    );
    await transactionToPromise(tx);
    return node ?? null;
  }

  async update(id: string, updates: Partial<Node>): Promise<Node> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Node ${id} not found`);

    const type = updates.type ?? existing.type;
    const content = Object.prototype.hasOwnProperty.call(updates, "content")
      ? updates.content ?? ""
      : existing.content;
    const summary = Object.prototype.hasOwnProperty.call(updates, "summary")
      ? updates.summary
      : existing.summary;

    const tokenBasis =
      type === NodeType.COMPRESSED ? summary ?? content : content;

    const next: Node = {
      ...existing,
      ...updates,
      id,
      type,
      content,
      summary,
      metadata: updates.metadata
        ? {
            ...existing.metadata,
            ...updates.metadata,
            metaInstructions: {
              ...existing.metadata.metaInstructions,
              ...updates.metadata.metaInstructions,
            },
          }
        : existing.metadata,
      tokenCount:
        updates.tokenCount ??
        (shouldRecomputeTokens(updates) ? estimateTokens(tokenBasis) : existing.tokenCount),
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readwrite");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    store.put(next);
    await transactionToPromise(tx);
    return next;
  }

  async delete(id: string): Promise<void> {
    const children = await this.getChildren(id);
    for (const child of children) {
      await this.delete(child.id);
    }

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readwrite");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    store.delete(id);
    await transactionToPromise(tx);
  }

  async getChildren(parentId: string): Promise<Node[]> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    const index = store.index("parentId");
    const children = await requestToPromise<Node[]>(
      index.getAll(parentId) as IDBRequest<Node[]>,
    );
    await transactionToPromise(tx);
    return (children ?? []).slice().sort((a, b) => a.createdAt - b.createdAt);
  }

  async getPath(nodeId: string): Promise<Node[]> {
    const path: Node[] = [];
    let current = await this.read(nodeId);

    while (current) {
      path.unshift(current);
      if (!current.parentId) break;
      current = await this.read(current.parentId);
    }

    return path;
  }

  async search(query: string): Promise<Node[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    const all = await requestToPromise<Node[]>(store.getAll() as IDBRequest<Node[]>);
    await transactionToPromise(tx);

    return (all ?? []).filter((n) => {
      const contentHit = n.content.toLowerCase().includes(q);
      const tagHit = n.metadata.tags.some((t) => t.toLowerCase().includes(q));
      return contentHit || tagHit;
    });
  }

  async batchCreate(items: Partial<Node>[]): Promise<Node[]> {
    const now = Date.now();
    const nodes: Node[] = [];

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readwrite");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);

    for (const item of items) {
      const createdAt = item.createdAt ?? now;
      const updatedAt = item.updatedAt ?? createdAt;
      const type = item.type ?? NodeType.USER;
      const content = item.content ?? "";
      const summary = item.summary;
      const tokenBasis =
        type === NodeType.COMPRESSED ? summary ?? content : content;

      const node: Node = {
        id: item.id ?? generateUUID(),
        type,
        createdAt,
        updatedAt,
        parentId: item.parentId ?? null,
        content,
        summary,
        metadata: normalizeMetadata(item.metadata),
        tokenCount: item.tokenCount ?? estimateTokens(tokenBasis),
        position: item.position,
        style: item.style,
      };

      nodes.push(node);
      store.put(node);
    }

    await transactionToPromise(tx);
    return nodes;
  }
}

import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import { estimateTokens } from "@/lib/utils/tokens";
import { generateUUID } from "@/lib/utils/uuid";
import { NodeType, type ContextBox, type ConversationTree, type Node } from "@/types";

import { NodeService } from "./nodeService";

const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_SYSTEM_PROMPT = "You are Cortex, a helpful assistant.";

export class TreeService {
  private readonly nodeService = new NodeService();

  async create(title?: string): Promise<ConversationTree> {
    const now = Date.now();

    const rootNode: Node = {
      id: generateUUID(),
      type: NodeType.SYSTEM,
      createdAt: now,
      updatedAt: now,
      parentId: null,
      content: DEFAULT_SYSTEM_PROMPT,
      metadata: { tags: [], metaInstructions: {} },
      tokenCount: estimateTokens(DEFAULT_SYSTEM_PROMPT),
    };

    const tree: ConversationTree = {
      id: generateUUID(),
      rootId: rootNode.id,
      title: title?.trim() ? title.trim() : "New Chat",
      createdAt: now,
      updatedAt: now,
    };

    const contextBox: ContextBox = {
      id: tree.id,
      nodeIds: [rootNode.id],
      totalTokens: rootNode.tokenCount,
      maxTokens: DEFAULT_MAX_TOKENS,
      createdAt: now,
    };

    const db = await getDB();
    const tx = db.transaction(
      [
        DB_CONFIG.stores.nodes.name,
        DB_CONFIG.stores.trees.name,
        DB_CONFIG.stores.contextBoxes.name,
      ],
      "readwrite",
    );

    tx.objectStore(DB_CONFIG.stores.nodes.name).put(rootNode);
    tx.objectStore(DB_CONFIG.stores.trees.name).put(tree);
    tx.objectStore(DB_CONFIG.stores.contextBoxes.name).put(contextBox);

    await transactionToPromise(tx);
    return tree;
  }

  async read(id: string): Promise<ConversationTree | null> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.trees.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.trees.name);
    const tree = await requestToPromise<ConversationTree | undefined>(
      store.get(id) as IDBRequest<ConversationTree | undefined>,
    );
    await transactionToPromise(tx);
    return tree ?? null;
  }

  async list(): Promise<ConversationTree[]> {
    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.trees.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.trees.name);
    const all = await requestToPromise<ConversationTree[]>(
      store.getAll() as IDBRequest<ConversationTree[]>,
    );
    await transactionToPromise(tx);
    return (all ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateTitle(id: string, title: string): Promise<ConversationTree> {
    const existing = await this.read(id);
    if (!existing) throw new Error(`Tree ${id} not found`);

    const next: ConversationTree = {
      ...existing,
      title: title.trim() || existing.title,
      updatedAt: Date.now(),
    };

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.trees.name], "readwrite");
    tx.objectStore(DB_CONFIG.stores.trees.name).put(next);
    await transactionToPromise(tx);
    return next;
  }

  async delete(id: string): Promise<void> {
    const tree = await this.read(id);
    if (!tree) return;

    await this.nodeService.delete(tree.rootId);

    const db = await getDB();
    const tx = db.transaction(
      [DB_CONFIG.stores.trees.name, DB_CONFIG.stores.contextBoxes.name],
      "readwrite",
    );
    tx.objectStore(DB_CONFIG.stores.trees.name).delete(id);
    tx.objectStore(DB_CONFIG.stores.contextBoxes.name).delete(id);
    await transactionToPromise(tx);
  }

  async loadTreeNodes(treeId: string): Promise<{
    tree: ConversationTree;
    nodes: Node[];
  }> {
    const tree = await this.read(treeId);
    if (!tree) throw new Error(`Tree ${treeId} not found`);

    const db = await getDB();
    const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readonly");
    const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
    const all = await requestToPromise<Node[]>(store.getAll() as IDBRequest<Node[]>);
    await transactionToPromise(tx);

    const nodesByParent = new Map<string | null, Node[]>();
    for (const node of all ?? []) {
      const key = node.parentId ?? null;
      const bucket = nodesByParent.get(key);
      if (bucket) bucket.push(node);
      else nodesByParent.set(key, [node]);
    }

    for (const bucket of nodesByParent.values()) {
      bucket.sort((a, b) => a.createdAt - b.createdAt);
    }

    const result: Node[] = [];
    const queue: string[] = [tree.rootId];
    const seen = new Set<string>();

    const allById = new Map<string, Node>();
    for (const node of all ?? []) allById.set(node.id, node);

    while (queue.length) {
      const id = queue.shift();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const node = allById.get(id);
      if (!node) continue;

      result.push(node);
      const children = nodesByParent.get(id) ?? [];
      for (const child of children) queue.push(child.id);
    }

    return { tree, nodes: result };
  }
}


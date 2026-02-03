import { getDB } from "@/lib/db/indexedDB";
import { requestToPromise, transactionToPromise } from "@/lib/db/objectStore";
import { DB_CONFIG } from "@/lib/db/schema";
import type { ConversationTree, Node } from "@/types";

export async function computeNodeCountsForTrees(
  trees: ConversationTree[],
): Promise<Record<string, number>> {
  if (typeof indexedDB === "undefined") return {};
  if (trees.length === 0) return {};

  const db = await getDB();
  const tx = db.transaction([DB_CONFIG.stores.nodes.name], "readonly");
  const store = tx.objectStore(DB_CONFIG.stores.nodes.name);
  const all = await requestToPromise<Node[]>(store.getAll() as IDBRequest<Node[]>);
  await transactionToPromise(tx);

  const byId = new Set<string>();
  const childrenByParent = new Map<string, string[]>();

  for (const node of all ?? []) {
    byId.add(node.id);
    if (!node.parentId) continue;
    const bucket = childrenByParent.get(node.parentId);
    if (bucket) bucket.push(node.id);
    else childrenByParent.set(node.parentId, [node.id]);
  }

  const counts: Record<string, number> = {};

  for (const tree of trees) {
    const rootId = tree.rootId;
    if (!byId.has(rootId)) continue;

    let count = 0;
    const queue: string[] = [rootId];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const id = queue.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      if (!byId.has(id)) continue;
      count += 1;

      const children = childrenByParent.get(id) ?? [];
      for (const childId of children) queue.push(childId);
    }

    counts[tree.id] = count;
  }

  return counts;
}

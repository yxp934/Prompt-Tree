import { DB_CONFIG } from "./schema";

let dbPromise: Promise<IDBDatabase> | null = null;

function assertIndexedDBAvailable(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
}

export function openDB(): Promise<IDBDatabase> {
  assertIndexedDBAvailable();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      if (!tx) throw new Error("Missing upgrade transaction for IndexedDB.");

      for (const storeKey of Object.keys(DB_CONFIG.stores) as Array<
        keyof typeof DB_CONFIG.stores
      >) {
        const storeConfig = DB_CONFIG.stores[storeKey];
        const storeExists = db.objectStoreNames.contains(storeConfig.name);
        const store = storeExists
          ? tx.objectStore(storeConfig.name)
          : db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
            });

        for (const [indexName, indexConfig] of Object.entries(
          storeConfig.indexes,
        )) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, indexConfig.keyPath, indexConfig.options);
          }
        }
      }
    };
  });
}

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

export async function closeDB(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export async function deleteDB(): Promise<void> {
  assertIndexedDBAvailable();
  await closeDB();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_CONFIG.name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error("deleteDatabase() was blocked."));
  });
}


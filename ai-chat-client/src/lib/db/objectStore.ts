export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

export class ObjectStore<T> {
  constructor(
    private readonly db: IDBDatabase,
    private readonly storeName: string,
  ) {}

  private tx(mode: IDBTransactionMode): { store: IDBObjectStore; tx: IDBTransaction } {
    const tx = this.db.transaction([this.storeName], mode);
    return { store: tx.objectStore(this.storeName), tx };
  }

  async get(key: IDBValidKey): Promise<T | undefined> {
    const { store, tx } = this.tx("readonly");
    const value = await requestToPromise<T | undefined>(
      store.get(key) as IDBRequest<T | undefined>,
    );
    await transactionToPromise(tx);
    return value;
  }

  async getAll(): Promise<T[]> {
    const { store, tx } = this.tx("readonly");
    const value = await requestToPromise<T[]>(
      store.getAll() as IDBRequest<T[]>,
    );
    await transactionToPromise(tx);
    return value ?? [];
  }

  async put(value: T): Promise<IDBValidKey> {
    const { store, tx } = this.tx("readwrite");
    const key = await requestToPromise<IDBValidKey>(
      store.put(value) as IDBRequest<IDBValidKey>,
    );
    await transactionToPromise(tx);
    return key;
  }

  async add(value: T): Promise<IDBValidKey> {
    const { store, tx } = this.tx("readwrite");
    const key = await requestToPromise<IDBValidKey>(
      store.add(value) as IDBRequest<IDBValidKey>,
    );
    await transactionToPromise(tx);
    return key;
  }

  async delete(key: IDBValidKey): Promise<void> {
    const { store, tx } = this.tx("readwrite");
    await requestToPromise(store.delete(key));
    await transactionToPromise(tx);
  }

  async clear(): Promise<void> {
    const { store, tx } = this.tx("readwrite");
    await requestToPromise(store.clear());
    await transactionToPromise(tx);
  }

  async getByIndex(
    indexName: string,
    query: IDBValidKey | IDBKeyRange,
  ): Promise<T | undefined> {
    const { store, tx } = this.tx("readonly");
    const index = store.index(indexName);
    const value = await requestToPromise<T | undefined>(
      index.get(query) as IDBRequest<T | undefined>,
    );
    await transactionToPromise(tx);
    return value;
  }

  async getAllByIndex(
    indexName: string,
    query: IDBValidKey | IDBKeyRange,
  ): Promise<T[]> {
    const { store, tx } = this.tx("readonly");
    const index = store.index(indexName);
    const value = await requestToPromise<T[]>(
      index.getAll(query) as IDBRequest<T[]>,
    );
    await transactionToPromise(tx);
    return value ?? [];
  }
}


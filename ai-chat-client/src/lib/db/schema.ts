export const DB_CONFIG = {
  name: "AIChatClientDB",
  version: 2,
  stores: {
    nodes: {
      name: "nodes",
      keyPath: "id",
      indexes: {
        parentId: { keyPath: "parentId", options: { unique: false } },
        type: { keyPath: "type", options: { unique: false } },
        createdAt: { keyPath: "createdAt", options: { unique: false } },
      },
    },
    trees: {
      name: "trees",
      keyPath: "id",
      indexes: {
        rootId: { keyPath: "rootId", options: { unique: false } },
        folderId: { keyPath: "folderId", options: { unique: false } },
        updatedAt: { keyPath: "updatedAt", options: { unique: false } },
      },
    },
    folders: {
      name: "folders",
      keyPath: "id",
      indexes: {
        createdAt: { keyPath: "createdAt", options: { unique: false } },
        updatedAt: { keyPath: "updatedAt", options: { unique: false } },
      },
    },
    contextBoxes: {
      name: "contextBoxes",
      keyPath: "id",
      indexes: {
        createdAt: { keyPath: "createdAt", options: { unique: false } },
      },
    },
  },
} as const;

export type DBStoreName = keyof typeof DB_CONFIG.stores;

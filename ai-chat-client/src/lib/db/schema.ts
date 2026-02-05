export const DB_CONFIG = {
  name: "AIChatClientDB",
  version: 3,
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
    userProfiles: {
      name: "userProfiles",
      keyPath: "id",
      indexes: {
        updatedAt: { keyPath: "updatedAt", options: { unique: false } },
        version: { keyPath: "version", options: { unique: false } },
      },
    },
    folderDocs: {
      name: "folderDocs",
      keyPath: "folderId",
      indexes: {
        updatedAt: { keyPath: "updatedAt", options: { unique: false } },
        version: { keyPath: "version", options: { unique: false } },
      },
    },
    memoryItems: {
      name: "memoryItems",
      keyPath: "id",
      indexes: {
        scope: { keyPath: "scope", options: { unique: false } },
        folderId: { keyPath: "folderId", options: { unique: false } },
        status: { keyPath: "status", options: { unique: false } },
        createdAt: { keyPath: "createdAt", options: { unique: false } },
        updatedAt: { keyPath: "updatedAt", options: { unique: false } },
        tags: { keyPath: "tags", options: { unique: false, multiEntry: true } },
      },
    },
  },
} as const;

export type DBStoreName = keyof typeof DB_CONFIG.stores;

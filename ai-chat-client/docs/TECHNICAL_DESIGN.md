# 技术设计文档：AI 对话客户端 (ai-chat-client)

## 1. 系统架构概述

### 1.1 整体架构

本系统采用**三层架构**设计，将应用分为数据层、业务逻辑层和展示层：

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Tree View│  │ Chat View│  │ Context  │  │Sidebar  │ │
│  │ (React   │  │ (React   │  │ Panel    │  │(React   │ │
│  │  Flow)   │  │  Component) │ (React   │  │Component)│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│                   Business Logic Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Node Manager │  │ DAG Service  │  │ Context      │  │
│  │ (节点CRUD)   │  │ (图结构管理) │  │ Builder      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ LLM Service  │  │ Token        │  │ Compression  │  │
│  │ (OpenAI API) │  │ Counter      │  │ Service      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                      (Zustand Store)                     │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│                      Data Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ IndexedDB    │  │ IDB Wrapper  │  │ React Flow   │  │
│  │ (浏览器持久化)│  │ (类型安全封装)│  │ State        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选型理由

| 技术 | 用途 | 选型理由 |
|------|------|---------|
| **Next.js 14** | 应用框架 | - App Router提供更好的性能<br>- Server/Client Component分离<br>- 内置优化和类型安全 |
| **React 18** | UI框架 | - 生态成熟，组件丰富<br>- Concurrent模式支持复杂交互<br>- 与React Flow完美集成 |
| **TypeScript** | 类型系统 | - 编译时类型检查<br>- 更好的IDE支持<br>- 减少运行时错误 |
| **Zustand** | 状态管理 | - 轻量级（~1KB）<br>- Boilerplate少<br>- 支持Redux DevTools<br>- 易于与React Flow集成 |
| **React Flow** | 树图可视化 | - 专为节点图设计<br>- 内置拖拽、缩放、平移<br>- 高度可定制<br>- TypeScript原生支持 |
| **IndexedDB** | 数据存储 | - 浏览器原生支持<br>- 存储容量大（几百MB）<br>- 异步操作不阻塞UI<br>- 支持索引和事务 |
| **Tailwind CSS** | 样式框架 | - 原子化CSS，快速开发<br>- 深色模式支持<br>- 高度可定制<br>- 生产环境自动清理无用样式 |
| **Vite** | 构建工具 | - 极快的冷启动速度<br>- HMR速度极快<br>- 原生ESM支持 |

## 2. 数据模型设计

### 2.1 核心数据结构

```typescript
/**
 * 节点类型枚举
 */
enum NodeType {
  USER = 'user',           // 用户输入节点
  ASSISTANT = 'assistant', // AI回复节点
  SYSTEM = 'system',       // 系统指令节点
  COMPRESSED = 'compressed' // 压缩节点
}

/**
 * 节点状态
 */
interface Node {
  // 基础身份
  id: string;                    // 唯一标识符 (UUID)
  type: NodeType;               // 节点类型
  createdAt: number;            // 创建时间戳
  updatedAt: number;            // 更新时间戳

  // 血缘关系
  parentId: string | null;      // 父节点ID，根节点为null

  // 内容载荷
  content: string;              // 原始文本内容
  summary?: string;             // 摘要（压缩节点专用）
  metadata: NodeMetadata;       // 元数据

  // 资源属性
  tokenCount: number;           // Token数量估算

  // 视觉属性
  position?: {                  // React Flow位置
    x: number;
    y: number;
  };
  style?: React.CSSProperties;  // 自定义样式
}

/**
 * 节点元数据
 */
interface NodeMetadata {
  tags: string[];               // 用户自定义标签
  metaInstructions: {           // 元指令（压缩节点）
    language?: string;          // 语言，如 "zh-CN"
    format?: string;            // 格式，如 "markdown"
    role?: string;              // 角色，如 "expert"
    [key: string]: any;
  };
  compressedNodeIds?: string[]; // 压缩节点包含的子节点ID列表
}

/**
 * 上下文箱子（Context Box）
 */
interface ContextBox {
  id: string;                   // 上下文箱子ID
  nodeIds: string[];            // 包含的节点ID列表
  totalTokens: number;          // 总Token数
  maxTokens: number;            // 最大Token限制（如4096）
  createdAt: number;            // 创建时间
}

/**
 * 对话树（Conversation Tree）
 */
interface ConversationTree {
  id: string;                   // 树ID
  rootId: string;               // 根节点ID
  nodes: Map<string, Node>;     // 所有节点的映射
  metadata: {
    title: string;              // 树标题
    createdAt: number;
    updatedAt: number;
  };
}
```

### 2.2 IndexedDB Schema设计

```typescript
/**
 * 数据库配置
 */
const DB_CONFIG = {
  name: 'AIChatClientDB',
  version: 1,
  stores: {
    nodes: {
      name: 'nodes',
      keyPath: 'id',
      indexes: {
        parentId: 'parentId',
        type: 'type',
        createdAt: 'createdAt'
      }
    },
    trees: {
      name: 'trees',
      keyPath: 'id',
      indexes: {
        rootId: 'rootId',
        updatedAt: 'updatedAt'
      }
    },
    contextBoxes: {
      name: 'contextBoxes',
      keyPath: 'id',
      indexes: {
        createdAt: 'createdAt'
      }
    }
  }
};

/**
 * IndexedDB初始化
 */
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建nodes存储
      if (!db.objectStoreNames.contains('nodes')) {
        const nodeStore = db.createObjectStore('nodes', { keyPath: 'id' });
        nodeStore.createIndex('parentId', 'parentId', { unique: false });
        nodeStore.createIndex('type', 'type', { unique: false });
        nodeStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 创建trees存储
      if (!db.objectStoreNames.contains('trees')) {
        const treeStore = db.createObjectStore('trees', { keyPath: 'id' });
        treeStore.createIndex('rootId', 'rootId', { unique: false });
        treeStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 创建contextBoxes存储
      if (!db.objectStoreNames.contains('contextBoxes')) {
        const contextStore = db.createObjectStore('contextBoxes', { keyPath: 'id' });
        contextStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}
```

### 2.3 Zustand状态管理架构

```typescript
/**
 * 全局Store结构
 */
interface AppState {
  // 节点状态
  nodes: Map<string, Node>;
  activeNodeId: string | null;
  selectedNodeIds: string[];

  // 树状态
  currentTreeId: string | null;
  trees: Map<string, ConversationTree>;

  // 上下文状态
  contextBox: ContextBox | null;

  // UI状态
  sidebarOpen: boolean;
  theme: 'light' | 'dark';

  // Actions
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  setActiveNode: (id: string) => void;
  toggleNodeSelection: (id: string) => void;

  // 树操作
  createTree: () => string;
  loadTree: (id: string) => Promise<void>;
  deleteTree: (id: string) => void;

  // 上下文操作
  addToContext: (nodeId: string) => void;
  removeFromContext: (nodeId: string) => void;
  clearContext: () => void;

  // LLM操作
  sendMessage: (content: string, contextNodeIds: string[]) => Promise<Node>;
  compressNodes: (nodeIds: string[]) => Promise<Node>;
}

/**
 * Store实现
 */
const useStore = create<AppState>((set, get) => ({
  // 初始状态
  nodes: new Map(),
  activeNodeId: null,
  selectedNodeIds: [],
  currentTreeId: null,
  trees: new Map(),
  contextBox: null,
  sidebarOpen: true,
  theme: 'light',

  // Actions实现...
}));
```

## 3. 组件架构

### 3.1 组件层次结构

```
src/
├── app/
│   ├── layout.tsx                 # 根布局
│   ├── page.tsx                   # 主页面
│   └── globals.css                # 全局样式
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx             # 顶部导航栏
│   │   ├── Sidebar.tsx            # 左侧边栏（树列表）
│   │   └── MainLayout.tsx         # 主布局容器
│   │
│   ├── tree/
│   │   ├── TreeView.tsx           # 树状图容器
│   │   ├── TreeNode.tsx           # 自定义节点组件
│   │   ├── TreeEdge.tsx           # 自定义连线组件
│   │   └── TreeControls.tsx       # 树操作控制栏
│   │
│   ├── chat/
│   │   ├── ChatView.tsx           # 对话视图
│   │   ├── MessageList.tsx        # 消息列表
│   │   ├── MessageItem.tsx        # 单条消息
│   │   └── InputArea.tsx          # 输入区域
│   │
│   ├── context/
│   │   ├── ContextPanel.tsx       # 上下文面板容器
│   │   ├── ContextBox.tsx         # 上下文箱子
│   │   ├── TokenMeter.tsx         # Token计量器
│   │   └── ContextPreview.tsx     # 上下文预览
│   │
│   └── common/
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Tooltip.tsx
│       └── ContextMenu.tsx
│
├── lib/
│   ├── db/
│   │   ├── indexedDB.ts           # IndexedDB封装
│   │   └── schema.ts              # 数据模型定义
│   │
│   ├── services/
│   │   ├── nodeService.ts         # 节点CRUD服务
│   │   ├── dagService.ts          # DAG图服务
│   │   ├── llmService.ts          # LLM API服务
│   │   ├── tokenService.ts        # Token计算服务
│   │   └── compressionService.ts  # 压缩服务
│   │
│   ├── hooks/
│   │   ├── useTree.ts             # 树操作Hook
│   │   ├── useNode.ts             # 节点操作Hook
│   │   ├── useContext.ts          # 上下文操作Hook
│   │   └── useLLM.ts              # LLM调用Hook
│   │
│   └── utils/
│       ├── uuid.ts                # UUID生成
│       ├── token.ts               # Token估算
│       └── graph.ts               # 图算法工具
│
└── store/
    └── useStore.ts                # Zustand Store
```

### 3.2 React Flow集成方案

```typescript
/**
 * TreeView组件
 */
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  EdgeTypes
} from 'reactflow';

import 'reactflow/dist/style.css';

// 自定义节点类型
const nodeTypes: NodeTypes = {
  messageNode: TreeNode,
  systemNode: TreeNode,
  compressedNode: TreeNode,
};

// 自定义边类型
const edgeTypes: EdgeTypes = {
  customEdge: TreeEdge,
};

export function TreeView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { activeNodeId, selectedNodeIds } = useStore();

  // 连接节点（创建分支）
  const onConnect = useCallback(
    (connection: Connection) => {
      // 创建新节点并连接
      const edge = { ...connection, animated: true };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  // 节点点击事件
  const onNodeClick = useCallback((event, node) => {
    useStore.getState().setActiveNode(node.id);
  }, []);

  // 节点选择事件
  const onNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    // 同步到Store
    const selectedIds = nodes
      .filter(n => n.selected)
      .map(n => n.id);
    useStore.getState().selectedNodeIds = selectedIds;
  }, [nodes, onNodesChange]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

### 3.3 主要React组件接口

```typescript
/**
 * TreeNode组件Props
 */
interface TreeNodeProps {
  data: {
    id: string;
    type: NodeType;
    content: string;
    summary?: string;
    tokenCount: number;
    metadata: NodeMetadata;
    isActive: boolean;
    isSelected: boolean;
  };
}

/**
 * ContextPanel组件Props
 */
interface ContextPanelProps {
  contextBox: ContextBox | null;
  onAddNode: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onClear: () => void;
  onPreview: () => void;
}

/**
 * ChatView组件Props
 */
interface ChatViewProps {
  activeNodeId: string | null;
  onSendMessage: (content: string) => Promise<void>;
}
```

## 4. 核心功能实现方案

### 4.1 节点CRUD操作

```typescript
/**
 * 节点服务
 */
class NodeService {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  /**
   * 创建节点
   */
  async createNode(data: Partial<Node>): Promise<Node> {
    const node: Node = {
      id: generateUUID(),
      type: data.type || NodeType.USER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: data.parentId || null,
      content: data.content || '',
      summary: data.summary,
      metadata: data.metadata || { tags: [], metaInstructions: {} },
      tokenCount: await estimateTokens(data.content || ''),
      position: data.position,
      style: data.style
    };

    await this.putNode(node);
    return node;
  }

  /**
   * 更新节点
   */
  async updateNode(id: string, updates: Partial<Node>): Promise<Node> {
    const node = await this.getNode(id);
    if (!node) {
      throw new Error(`Node ${id} not found`);
    }

    const updated: Node = {
      ...node,
      ...updates,
      id, // 确保ID不被修改
      updatedAt: Date.now()
    };

    await this.putNode(updated);
    return updated;
  }

  /**
   * 删除节点
   */
  async deleteNode(id: string): Promise<void> {
    // 递归删除所有子节点
    const children = await this.getChildren(id);
    for (const child of children) {
      await this.deleteNode(child.id);
    }

    // 删除节点本身
    await this.removeFromDB(id);
  }

  /**
   * 获取节点
   */
  async getNode(id: string): Promise<Node | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['nodes'], 'readonly');
      const store = tx.objectStore('nodes');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取子节点
   */
  async getChildren(parentId: string): Promise<Node[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['nodes'], 'readonly');
      const store = tx.objectStore('nodes');
      const index = store.index('parentId');
      const request = index.getAll(parentId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取路径（从根到指定节点）
   */
  async getPath(nodeId: string): Promise<Node[]> {
    const path: Node[] = [];
    let currentNode = await this.getNode(nodeId);

    while (currentNode) {
      path.unshift(currentNode);
      if (currentNode.parentId) {
        currentNode = await this.getNode(currentNode.parentId);
      } else {
        break;
      }
    }

    return path;
  }

  private async putNode(node: Node): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['nodes'], 'readwrite');
      const store = tx.objectStore('nodes');
      const request = store.put(node);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async removeFromDB(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['nodes'], 'readwrite');
      const store = tx.objectStore('nodes');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 4.2 树状图渲染和交互

```typescript
/**
 * DAG服务 - 负责图的布局和渲染
 */
class DAGService {
  private nodeService: NodeService;

  constructor(nodeService: NodeService) {
    this.nodeService = nodeService;
  }

  /**
   * 将节点树转换为React Flow节点和边
   */
  async buildFlowGraph(rootId: string): Promise<{
    nodes: Node[];
    edges: Edge[];
  }> {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // BFS遍历树
    const queue: { nodeId: string; level: number; index: number }[] = [{
      nodeId: rootId,
      level: 0,
      index: 0
    }];
    const levelCounts = new Map<number, number>();

    while (queue.length > 0) {
      const { nodeId, level, index } = queue.shift()!;
      const node = await this.nodeService.getNode(nodeId);

      if (!node) continue;

      // 计算节点位置
      const x = level * 300; // 水平间距
      const y = index * 150; // 垂直间距

      nodes.push({
        id: node.id,
        type: this.getNodeTypeComponent(node.type),
        position: { x, y },
        data: {
          ...node,
          isActive: useStore.getState().activeNodeId === node.id,
          isSelected: useStore.getState().selectedNodeIds.includes(node.id)
        }
      });

      // 如果有父节点，创建边
      if (node.parentId) {
        edges.push({
          id: `${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'customEdge',
          animated: false
        });
      }

      // 添加子节点到队列
      const children = await this.nodeService.getChildren(node.id);
      const currentLevelCount = levelCounts.get(level) || 0;
      levelCounts.set(level, currentLevelCount + 1);

      children.forEach((child, i) => {
        queue.push({
          nodeId: child.id,
          level: level + 1,
          index: i
        });
      });
    }

    return { nodes, edges };
  }

  /**
   * 获取节点对应的React Flow组件类型
   */
  private getNodeTypeComponent(type: NodeType): string {
    switch (type) {
      case NodeType.SYSTEM:
        return 'systemNode';
      case NodeType.COMPRESSED:
        return 'compressedNode';
      default:
        return 'messageNode';
    }
  }

  /**
   * 高亮路径
   */
  highlightPath(nodeId: string): Edge[] {
    // 返回高亮的边
    return [];
  }
}
```

### 4.3 分支创建机制

```typescript
/**
 * 在指定节点上创建新分支
 */
async function createBranch(parentNodeId: string): Promise<Node> {
  const store = useStore.getState();

  // 创建新的系统节点作为分支起点
  const branchNode = await nodeService.createNode({
    type: NodeType.USER,
    parentId: parentNodeId,
    content: '',
    metadata: {
      tags: ['branch'],
      metaInstructions: {}
    }
  });

  // 更新Store
  store.addNode(branchNode);

  return branchNode;
}

/**
 * 在指定节点处继续对话
 */
async function continueFromNode(nodeId: string): Promise<void> {
  const store = useStore.getState();
  const node = await nodeService.getNode(nodeId);

  if (!node) {
    throw new Error(`Node ${nodeId} not found`);
  }

  // 将该节点设置为活动节点
  store.setActiveNode(nodeId);

  // 用户可以在ChatView中继续输入
}
```

### 4.4 Token计算逻辑

```typescript
/**
 * Token服务
 */
class TokenService {
  /**
   * 估算文本的Token数量
   * 使用简单的启发式规则：1 Token ≈ 4 字符（英文）或 2 字符（中文）
   */
  async estimateTokens(text: string): Promise<number> {
    // 移除空白字符
    const cleanText = text.trim().replace(/\s+/g, ' ');

    // 统计中文字符
    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;

    // 统计英文字符
    const englishChars = cleanText.length - chineseChars;

    // 中文字符：约2字符=1Token
    // 英文字符：约4字符=1Token
    const tokens = Math.ceil(chineseChars / 2) + Math.ceil(englishChars / 4);

    return tokens;
  }

  /**
   * 计算上下文箱子的总Token数
   */
  async calculateContextTokens(nodeIds: string[]): Promise<number> {
    let total = 0;

    for (const id of nodeIds) {
      const node = await nodeService.getNode(id);
      if (node) {
        total += node.tokenCount;
      }
    }

    return total;
  }

  /**
   * 构建发送给LLM的完整上下文
   */
  async buildLLMContext(nodeIds: string[]): Promise<string> {
    const nodeService = new NodeService(db);
    const contexts: string[] = [];

    for (const id of nodeIds) {
      const node = await nodeService.getNode(id);
      if (!node) continue;

      if (node.type === NodeType.COMPRESSED) {
        // 压缩节点使用摘要
        contexts.push(`[Compressed Context: ${node.summary}]`);
      } else {
        // 普通节点使用完整内容
        const role = node.type === NodeType.USER ? 'User' : 'Assistant';
        contexts.push(`${role}: ${node.content}`);
      }
    }

    return contexts.join('\n\n');
  }
}
```

### 4.5 AI辅助压缩流程

```typescript
/**
 * 压缩服务
 */
class CompressionService {
  private llmService: LLMService;
  private tokenService: TokenService;

  constructor(llmService: LLMService, tokenService: TokenService) {
    this.llmService = llmService;
    this.tokenService = tokenService;
  }

  /**
   * 压缩节点列表为单个压缩节点
   */
  async compressNodes(nodeIds: string[]): Promise<Node> {
    const nodeService = new NodeService(db);

    // 1. 获取所有要压缩的节点
    const nodes = await Promise.all(
      nodeIds.map(id => nodeService.getNode(id))
    ).then(results => results.filter(n => n !== null) as Node[]);

    if (nodes.length === 0) {
      throw new Error('No nodes to compress');
    }

    // 2. 找到共同的父节点
    const firstNode = nodes[0];
    const parentId = firstNode.parentId;

    // 3. 构建压缩提示词
    const compressionPrompt = this.buildCompressionPrompt(nodes);

    // 4. 调用LLM生成摘要和元指令
    const summary = await this.llmService.generateSummary(compressionPrompt);

    // 5. 提取元指令
    const metaInstructions = this.extractMetaInstructions(nodes);

    // 6. 创建压缩节点
    const compressedNode = await nodeService.createNode({
      type: NodeType.COMPRESSED,
      parentId,
      content: '', // 压缩节点content为空
      summary,
      metadata: {
        tags: ['compressed'],
        metaInstructions,
        compressedNodeIds: nodeIds
      }
    });

    // 7. 更新被压缩节点的子节点的父节点
    for (const node of nodes) {
      const children = await nodeService.getChildren(node.id);
      for (const child of children) {
        await nodeService.updateNode(child.id, {
          parentId: compressedNode.id
        });
      }
    }

    // 8. 删除原始节点
    for (const node of nodes) {
      await nodeService.deleteNode(node.id);
    }

    return compressedNode;
  }

  /**
   * 构建压缩提示词
   */
  private buildCompressionPrompt(nodes: Node[]): string {
    const conversation = nodes.map(node => {
      const role = node.type === NodeType.USER ? 'User' : 'Assistant';
      return `${role}: ${node.content}`;
    }).join('\n\n');

    return `
请总结以下对话，提取关键信息和上下文：

${conversation}

请提供：
1. 简洁的摘要（2-3句话）
2. 提取的元指令（语言、格式、角色等）
`;
  }

  /**
   * 从节点中提取元指令
   */
  private extractMetaInstructions(nodes: Node[]): NodeMetadata['metaInstructions'] {
    const metaInstructions: NodeMetadata['metaInstructions'] = {};

    // 分析所有节点的标签和内容，提取模式
    const allTags = nodes.flatMap(n => n.metadata.tags || []);

    // 语言检测
    if (allTags.includes('chinese') || allTags.includes('中文')) {
      metaInstructions.language = 'zh-CN';
    } else if (allTags.includes('english') || allTags.includes('英文')) {
      metaInstructions.language = 'en';
    }

    // 格式检测
    if (allTags.includes('markdown')) {
      metaInstructions.format = 'markdown';
    } else if (allTags.includes('json')) {
      metaInstructions.format = 'json';
    }

    // 角色检测
    if (allTags.includes('expert')) {
      metaInstructions.role = 'expert';
    }

    return metaInstructions;
  }
}
```

## 5. 开发规范

### 5.1 代码组织结构

```
原则：
1. 按功能模块组织，而非按文件类型
2. 每个组件有独立的文件夹（如需要）
3. 共享工具函数放在lib/utils
4. 类型定义集中管理
5. 保持目录扁平，避免过深嵌套
```

### 5.2 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `TreeNode.tsx`, `ChatView.tsx` |
| Hook | camelCase with 'use' prefix | `useTree.ts`, `useNode.ts` |
| 工具函数 | camelCase | `generateUUID()`, `estimateTokens()` |
| 常量 | UPPER_SNAKE_CASE | `DB_CONFIG`, `MAX_TOKENS` |
| 接口/类型 | PascalCase | `Node`, `ContextBox` |
| 私有方法 | camelCase with underscore | `_privateMethod()` |

### 5.3 TypeScript使用规范

```typescript
/**
 * 1. 始终使用显式类型注解（公共API）
 */
public async createNode(data: Partial<Node>): Promise<Node> {
  // ...
}

/**
 * 2. 使用interface定义对象结构
 */
interface Node {
  id: string;
  content: string;
  // ...
}

/**
 * 3. 使用type定义联合类型或别名
 */
type NodeType = 'user' | 'assistant' | 'system' | 'compressed';

/**
 * 4. 避免使用any，使用unknown代替
 */
function parseInput(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  throw new Error('Invalid input');
}

/**
 * 5. 使用泛型增强类型安全
 */
function createMap<K extends string, V>(keys: K[], values: V[]): Map<K, V> {
  // ...
}
```

### 5.4 错误处理规范

```typescript
/**
 * 统一错误处理
 */
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 错误边界
 */
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // 可以在这里发送错误日志
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 5.5 性能优化指南

```typescript
/**
 * 1. 使用React.memo避免不必要的重渲染
 */
const TreeNode = React.memo(({ data }: TreeNodeProps) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id &&
         prevProps.data.isActive === nextProps.data.isActive;
});

/**
 * 2. 使用useMemo缓存计算结果
 */
const processedNodes = useMemo(() => {
  return nodes.filter(n => n.type === NodeType.USER);
}, [nodes]);

/**
 * 3. 使用useCallback缓存回调函数
 */
const handleNodeClick = useCallback((nodeId: string) => {
  setActiveNode(nodeId);
}, [setActiveNode]);

/**
 * 4. 懒加载路由和组件
 */
const TreeView = lazy(() => import('@/components/tree/TreeView'));

/**
 * 5. 虚拟滚动处理大量节点
 */
import { FixedSizeList } from 'react-window';
```

## 6. 技术风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| IndexedDB兼容性问题 | 高 | 提供localStorage降级方案 |
| React Flow性能瓶颈（大量节点） | 中 | 实现虚拟化渲染，限制视图节点数 |
| Token估算不准确 | 低 | 定期校准估算算法，提供手动调整 |
| LLM API调用失败 | 高 | 实现重试机制和错误提示 |
| 浏览器存储容量限制 | 中 | 实现数据清理和归档机制 |

## 7. 下一步行动

1. ✅ 完成技术设计文档
2. ⏳ 创建API设计文档
3. ⏳ 创建开发路线图
4. ⏳ 初始化Next.js项目
5. ⏳ 实现第一个里程碑（单分支对话）

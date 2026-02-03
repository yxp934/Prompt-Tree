# API 设计文档：AI 对话客户端

## 1. API 概述

本文档定义了AI对话客户端的内部API接口规范，包括：
- **前端组件API**：React组件间的接口定义
- **服务层API**：业务逻辑层的抽象接口
- **数据层API**：IndexedDB和存储接口
- **外部API集成**：OpenAI API集成方案

## 2. 前端组件API

### 2.1 Store API (Zustand)

全局状态管理API，所有组件通过此API访问和修改应用状态。

```typescript
/**
 * 全局Store接口
 */
interface IAppStore {
  // ==================== 状态查询 ====================

  /**
   * 获取所有节点
   */
  getNodes(): Map<string, Node>;

  /**
   * 获取单个节点
   */
  getNode(id: string): Node | undefined;

  /**
   * 获取当前活动的节点
   */
  getActiveNode(): Node | null;

  /**
   * 获取选中的节点列表
   */
  getSelectedNodes(): Node[];

  /**
   * 获取当前对话树
   */
  getCurrentTree(): ConversationTree | null;

  /**
   * 获取上下文箱子
   */
  getContextBox(): ContextBox | null;

  // ==================== 节点操作 ====================

  /**
   * 创建新节点
   * @param data 节点数据（不含id和时间戳）
   * @returns 创建的节点
   */
  createNode(data: Partial<Omit<Node, 'id' | 'createdAt' | 'updatedAt'>>>): Promise<Node>;

  /**
   * 更新节点
   * @param id 节点ID
   * @param updates 要更新的字段
   * @returns 更新后的节点
   */
  updateNode(id: string, updates: Partial<Node>): Promise<Node>;

  /**
   * 删除节点（包括所有子节点）
   * @param id 节点ID
   */
  deleteNode(id: string): Promise<void>;

  /**
   * 设置活动节点
   * @param id 节点ID
   */
  setActiveNode(id: string): void;

  /**
   * 切换节点选中状态
   * @param id 节点ID
   */
  toggleNodeSelection(id: string): void;

  /**
   * 清除所有选中
   */
  clearSelection(): void;

  // ==================== 树操作 ====================

  /**
   * 创建新的对话树
   * @param title 树标题
   * @returns 创建的树ID
   */
  createTree(title?: string): Promise<string>;

  /**
   * 加载对话树
   * @param id 树ID
   */
  loadTree(id: string): Promise<void>;

  /**
   * 删除对话树
   * @param id 树ID
   */
  deleteTree(id: string): Promise<void>;

  /**
   * 更新树标题
   * @param id 树ID
   * @param title 新标题
   */
  updateTreeTitle(id: string, title: string): Promise<void>;

  // ==================== 上下文操作 ====================

  /**
   * 添加节点到上下文箱子
   * @param nodeId 节点ID
   */
  addToContext(nodeId: string): Promise<void>;

  /**
   * 从上下文箱子移除节点
   * @param nodeId 节点ID
   */
  removeFromContext(nodeId: string): void;

  /**
   * 清空上下文箱子
   */
  clearContext(): void;

  /**
   * 获取上下文箱子中所有节点的内容（用于发送给LLM）
   * @returns 构建的上下文字符串
   */
  buildContextContent(): Promise<string>;

  // ==================== LLM操作 ====================

  /**
   * 发送消息给LLM
   * @param content 用户输入内容
   * @param contextNodeIds 上下文节点ID列表（默认使用当前上下文箱子）
   * @returns AI回复的节点
   */
  sendMessage(content: string, contextNodeIds?: string[]): Promise<Node>;

  /**
   * 压缩节点列表
   * @param nodeIds 要压缩的节点ID列表
   * @returns 压缩后的节点
   */
  compressNodes(nodeIds: string[]): Promise<Node>;

  /**
   * 生成摘要（用于压缩节点）
   * @param content 原始内容
   * @returns 摘要文本
   */
  generateSummary(content: string): Promise<string>;

  // ==================== UI状态 ====================

  /**
   * 切换侧边栏
   */
  toggleSidebar(): void;

  /**
   * 切换主题
   */
  toggleTheme(): void;
}
```

### 2.2 React Hooks API

#### useTree

```typescript
/**
 * 树操作Hook
 */
interface UseTreeReturn {
  // 状态
  currentTree: ConversationTree | null;
  trees: ConversationTree[];
  isLoading: boolean;
  error: Error | null;

  // 操作
  createTree: (title?: string) => Promise<string>;
  loadTree: (id: string) => Promise<void>;
  deleteTree: (id: string) => Promise<void>;
  updateTreeTitle: (id: string, title: string) => Promise<void>;
}

export function useTree(): UseTreeReturn;
```

#### useNode

```typescript
/**
 * 节点操作Hook
 */
interface UseNodeReturn {
  // 状态
  nodes: Map<string, Node>;
  activeNode: Node | null;
  selectedNodes: Node[];
  isLoading: boolean;
  error: Error | null;

  // CRUD操作
  createNode: (data: Partial<Node>) => Promise<Node>;
  updateNode: (id: string, updates: Partial<Node>) => Promise<Node>;
  deleteNode: (id: string) => Promise<void>;

  // 选择操作
  setActiveNode: (id: string) => void;
  toggleNodeSelection: (id: string) => void;
  clearSelection: () => void;

  // 路径操作
  getNodePath: (nodeId: string) => Promise<Node[]>;
  getChildren: (nodeId: string) => Promise<Node[]>;
}

export function useNode(): UseNodeReturn;
```

#### useContext

```typescript
/**
 * 上下文操作Hook
 */
interface UseContextReturn {
  // 状态
  contextBox: ContextBox | null;
  totalTokens: number;
  tokenPercentage: number; // 0-100

  // 操作
  addToContext: (nodeId: string) => Promise<void>;
  removeFromContext: (nodeId: string) => void;
  clearContext: () => void;
  buildContextContent: () => Promise<string>;

  // Token计算
  estimateNodeTokens: (nodeId: string) => Promise<number>;
  calculateContextTokens: (nodeIds: string[]) => Promise<number>;
}

export function useContext(): UseContextReturn;
```

#### useLLM

```typescript
/**
 * LLM调用Hook
 */
interface UseLLMReturn {
  // 状态
  isLoading: boolean;
  error: Error | null;
  streamContent: string; // 流式内容

  // 操作
  sendMessage: (content: string, contextNodeIds?: string[]) => Promise<Node>;
  sendMessageStream: (content: string, contextNodeIds?: string[]) => AsyncIterator<string>;
  compressNodes: (nodeIds: string[]) => Promise<Node>;

  // 配置
  setModel: (model: string) => void;
  setTemperature: (temperature: number) => void;
  setMaxTokens: (maxTokens: number) => void;
}

export function useLLM(): UseLLMReturn;
```

### 2.3 组件Props接口

#### TreeNode

```typescript
/**
 * TreeNode组件Props
 */
interface TreeNodeProps {
  // 节点数据
  id: string;
  type: NodeType;
  content: string;
  summary?: string;
  tokenCount: number;
  metadata: NodeMetadata;

  // 视觉状态
  isActive: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  position?: { x: number; y: number };

  // 事件处理
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onContextMenu: (id: string, event: MouseEvent) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: (id: string) => void;

  // 样式
  className?: string;
  style?: React.CSSProperties;
}
```

#### ChatView

```typescript
/**
 * ChatView组件Props
 */
interface ChatViewProps {
  // 当前活动节点
  activeNodeId: string | null;

  // 消息列表（从根到当前节点的路径）
  messages: Node[];

  // 事件处理
  onSendMessage: (content: string) => Promise<void>;
  onRetryMessage: (nodeId: string) => Promise<void>;

  // UI状态
  isLoading?: boolean;
  placeholder?: string;

  // 样式
  className?: string;
  style?: React.CSSProperties;
}
```

#### ContextPanel

```typescript
/**
 * ContextPanel组件Props
 */
interface ContextPanelProps {
  // 上下文箱子数据
  contextBox: ContextBox | null;

  // Token统计
  totalTokens: number;
  maxTokens: number;
  percentage: number;

  // 事件处理
  onAddNode: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onClear: () => void;
  onPreview: () => void;

  // UI状态
  isLoading?: boolean;
  showTokenMeter?: boolean;
  showPreview?: boolean;

  // 样式
  className?: string;
  style?: React.CSSProperties;
}
```

## 3. 服务层API

### 3.1 NodeService

```typescript
/**
 * 节点服务接口
 */
interface INodeService {
  /**
   * 创建节点
   */
  create(data: Partial<Node>): Promise<Node>;

  /**
   * 读取节点
   */
  read(id: string): Promise<Node | null>;

  /**
   * 更新节点
   */
  update(id: string, updates: Partial<Node>): Promise<Node>;

  /**
   * 删除节点（递归删除子节点）
   */
  delete(id: string): Promise<void>;

  /**
   * 获取子节点列表
   */
  getChildren(parentId: string): Promise<Node[]>;

  /**
   * 获取从根到指定节点的路径
   */
  getPath(nodeId: string): Promise<Node[]>;

  /**
   * 搜索节点（按内容或标签）
   */
  search(query: string): Promise<Node[]>;

  /**
   * 批量创建节点
   */
  batchCreate(items: Partial<Node>[]): Promise<Node[]>;
}
```

### 3.2 DAGService

```typescript
/**
 * DAG图服务接口
 */
interface IDAGService {
  /**
   * 构建React Flow图结构
   */
  buildFlowGraph(rootId: string): Promise<{
    nodes: Node[];
    edges: Edge[];
  }>;

  /**
   * 计算节点布局位置
   */
  calculateLayout(nodes: Node[]): Promise<Map<string, { x: number; y: number }>>;

  /**
   * 高亮路径
   */
  highlightPath(rootId: string, targetId: string): Edge[];

  /**
   * 查找最近公共祖先
   */
  findCommonAncestor(nodeId1: string, nodeId2: string): Promise<Node | null>;

  /**
   * 检测环（DAG不应该有环）
   */
  detectCycle(nodeId: string): Promise<boolean>;

  /**
   * 拓扑排序
   */
  topologicalSort(rootId: string): Promise<Node[]>;
}
```

### 3.3 LLMService

```typescript
/**
 * LLM服务接口
 */
interface ILLMService {
  /**
   * 发送聊天消息
   */
  chat(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<string>;

  /**
   * 流式聊天
   */
  chatStream(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterator<ChatChunk>;

  /**
   * 生成摘要
   */
  summarize(content: string): Promise<string>;

  /**
   * 提取元指令
   */
  extractMetaInstructions(content: string): Promise<NodeMetadata['metaInstructions']>;

  /**
   * 估算Token数
   */
  estimateTokens(text: string): Promise<number>;
}

/**
 * 聊天消息
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 流式响应块
 */
interface ChatChunk {
  delta: {
    content?: string;
  };
  finishReason: string | null;
}
```

### 3.4 TokenService

```typescript
/**
 * Token服务接口
 */
interface ITokenService {
  /**
   * 估算文本的Token数量
   */
  estimate(text: string): Promise<number>;

  /**
   * 批量估算
   */
  batchEstimate(texts: string[]): Promise<number[]>;

  /**
   * 计算上下文总Token数
   */
  calculateContextTotal(nodeIds: string[]): Promise<number>;

  /**
   * 构建发送给LLM的上下文
   */
  buildContext(nodeIds: string[]): Promise<{
    content: string;
    tokenCount: number;
  }>;

  /**
   * 检查是否超出限制
   */
  checkLimit(nodeIds: string[], maxTokens: number): Promise<boolean>;
}
```

### 3.5 CompressionService

```typescript
/**
 * 压缩服务接口
 */
interface ICompressionService {
  /**
   * 压缩节点列表
   */
  compress(nodeIds: string[]): Promise<Node>;

  /**
   * 解压缩节点
   */
  decompress(nodeId: string): Promise<Node[]>;

  /**
   * 生成压缩提示词
   */
  buildCompressionPrompt(nodes: Node[]): string;

  /**
   * 提取元指令
   */
  extractMetaInstructions(nodes: Node[]): NodeMetadata['metaInstructions']>;

  /**
   * 更新压缩节点的摘要
   */
  updateSummary(nodeId: string): Promise<void>;
}
```

## 4. 数据层API

### 4.1 IndexedDB封装

```typescript
/**
 * IndexedDB封装接口
 */
interface IDB {
  /**
   * 初始化数据库
   */
  init(): Promise<IDBDatabase>;

  /**
   * 获取数据库实例
   */
  getDB(): IDBDatabase | null;

  /**
   * 关闭数据库连接
   */
  close(): void;

  /**
   * 清空所有数据
   */
  clear(): Promise<void>;

  /**
   * 导出数据为JSON
   */
  export(): Promise<string>;

  /**
   * 从JSON导入数据
   */
  import(json: string): Promise<void>;
}

/**
 * ObjectStore封装
 */
interface IObjectStore<T> {
  /**
   * 添加记录
   */
  add(record: T): Promise<string>;

  /**
   * 更新记录
   */
  put(record: T): Promise<void>;

  /**
   * 获取记录
   */
  get(key: string): Promise<T | null>;

  /**
   * 删除记录
   */
  delete(key: string): Promise<void>;

  /**
   * 获取所有记录
   */
  getAll(): Promise<T[]>;

  /**
   * 使用索引查询
   */
  getByIndex(indexName: string, value: any): Promise<T[]>;

  /**
   * 清空store
   */
  clear(): Promise<void>;

  /**
   * 统计记录数
   */
  count(): Promise<number>;
}
```

### 4.2 存储Schema

```typescript
/**
 * 数据库配置
 */
interface IDBConfig {
  name: string;
  version: number;
  stores: {
    [key: string]: {
      name: string;
      keyPath: string;
      autoIncrement?: boolean;
      indexes: {
        [key: string]: {
          name: string;
          keyPath: string;
          options?: IDBIndexParameters;
        };
      };
    };
  };
}

/**
 * 实际配置
 */
const DB_CONFIG: IDBConfig = {
  name: 'AIChatClientDB',
  version: 1,
  stores: {
    nodes: {
      name: 'nodes',
      keyPath: 'id',
      indexes: {
        parentId: { name: 'parentId', keyPath: 'parentId' },
        type: { name: 'type', keyPath: 'type' },
        createdAt: { name: 'createdAt', keyPath: 'createdAt' }
      }
    },
    trees: {
      name: 'trees',
      keyPath: 'id',
      indexes: {
        rootId: { name: 'rootId', keyPath: 'rootId' },
        updatedAt: { name: 'updatedAt', keyPath: 'updatedAt' }
      }
    },
    contextBoxes: {
      name: 'contextBoxes',
      keyPath: 'id',
      indexes: {
        createdAt: { name: 'createdAt', keyPath: 'createdAt' }
      }
    }
  }
};
```

## 5. 外部API集成

### 5.1 OpenAI API集成

```typescript
/**
 * OpenAI API配置
 */
interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

/**
 * OpenAI API客户端
 */
class OpenAIClient {
  constructor(config: OpenAIConfig) {
    // 初始化
  }

  /**
   * 发送聊天请求
   */
  async chat(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<string | AsyncIterator<ChatChunk>>;

  /**
   * 流式聊天
   */
  async chatStream(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterator<ChatChunk>;

  /**
   * 生成摘要
   */
  async summarize(content: string): Promise<string>;

  /**
   * 估算Token
   */
  async estimateTokens(text: string): Promise<number>;

  /**
   * 设置API Key
   */
  setApiKey(apiKey: string): void;

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]>;
}
```

### 5.2 API调用示例

```typescript
/**
 * 发送消息的完整流程
 */
async function sendMessageFlow(
  userContent: string,
  contextNodeIds: string[]
): Promise<Node> {
  // 1. 构建上下文
  const tokenService = new TokenService();
  const contextContent = await tokenService.buildContext(contextNodeIds);

  // 2. 构建消息数组
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful AI assistant.'
    },
    ...contextNodeIds.map(id => {
      const node = await nodeService.read(id);
      return {
        role: node.type === NodeType.USER ? 'user' : 'assistant',
        content: node.content
      } as ChatMessage;
    }),
    {
      role: 'user',
      content: userContent
    }
  ];

  // 3. 调用OpenAI API
  const llmService = new LLMService(new OpenAIClient({ apiKey: '...' }));
  const response = await llmService.chat({
    messages,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000
  });

  // 4. 创建AI回复节点
  const activeNode = useStore.getState().activeNode;
  const aiNode = await nodeService.create({
    type: NodeType.ASSISTANT,
    parentId: activeNode?.id || null,
    content: response,
    metadata: {
      tags: [],
      metaInstructions: {}
    }
  });

  // 5. 更新状态
  useStore.getState().addNode(aiNode);

  return aiNode;
}
```

## 6. 事件系统

### 6.1 事件总线

```typescript
/**
 * 事件类型
 */
enum EventType {
  NODE_CREATED = 'node:created',
  NODE_UPDATED = 'node:updated',
  NODE_DELETED = 'node:deleted',
  NODE_SELECTED = 'node:selected',
  TREE_CREATED = 'tree:created',
  TREE_LOADED = 'tree:loaded',
  TREE_DELETED = 'tree:deleted',
  CONTEXT_CHANGED = 'context:changed',
  MESSAGE_SENT = 'message:sent',
  MESSAGE_RECEIVED = 'message:received',
  ERROR = 'error'
}

/**
 * 事件处理器
 */
type EventHandler = (data: any) => void;

/**
 * 事件总线接口
 */
interface IEventBus {
  /**
   * 订阅事件
   */
  on(event: EventType, handler: EventHandler): void;

  /**
   * 取消订阅
   */
  off(event: EventType, handler: EventHandler): void;

  /**
   * 触发事件
   */
  emit(event: EventType, data?: any): void;

  /**
   * 只订阅一次
   */
  once(event: EventType, handler: EventHandler): void;
}
```

## 7. 错误处理

### 7.1 错误类型

```typescript
/**
 * 错误码
 */
enum ErrorCode {
  // 节点错误 (1xxx)
  NODE_NOT_FOUND = 1001,
  NODE_CREATE_FAILED = 1002,
  NODE_UPDATE_FAILED = 1003,
  NODE_DELETE_FAILED = 1004,

  // 树错误 (2xxx)
  TREE_NOT_FOUND = 2001,
  TREE_LOAD_FAILED = 2002,
  TREE_DELETE_FAILED = 2003,

  // LLM错误 (3xxx)
  LLM_API_ERROR = 3001,
  LLM_RATE_LIMIT = 3002,
  LLM_TIMEOUT = 3003,
  LLM_QUOTA_EXCEEDED = 3004,

  // 存储错误 (4xxx)
  DB_INIT_FAILED = 4001,
  DB_READ_FAILED = 4002,
  DB_WRITE_FAILED = 4003,
  DB_QUOTA_EXCEEDED = 4004,

  // 上下文错误 (5xxx)
  CONTEXT_TOO_LONG = 5001,
  CONTEXT_INVALID = 5002,

  // 压缩错误 (6xxx)
  COMPRESS_FAILED = 6001,
  DECOMPRESS_FAILED = 6002
}

/**
 * 应用错误类
 */
class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### 7.2 错误处理策略

```typescript
/**
 * 错误处理中间件
 */
function withErrorHandling<T>(
  operation: () => Promise<T>,
  onError?: (error: AppError) => void
): Promise<T> {
  return operation().catch((error) => {
    const appError = error instanceof AppError
      ? error
      : new AppError(error.message, ErrorCode.LLM_API_ERROR);

    // 记录错误
    console.error('[Error]', appError);

    // 触发错误事件
    eventBus.emit(EventType.ERROR, appError);

    // 调用自定义错误处理
    if (onError) {
      onError(appError);
    }

    throw appError;
  });
}
```

## 8. 性能优化API

### 8.1 缓存策略

```typescript
/**
 * 缓存接口
 */
interface ICache<T> {
  /**
   * 获取缓存
   */
  get(key: string): T | null;

  /**
   * 设置缓存
   */
  set(key: string, value: T, ttl?: number): void;

  /**
   * 删除缓存
   */
  delete(key: string): void;

  /**
   * 清空缓存
   */
  clear(): void;

  /**
   * 获取缓存大小
   */
  size(): number;
}

/**
 * 内存缓存实现
 */
class MemoryCache<T> implements ICache<T> {
  private cache = new Map<string, { value: T; expiry?: number }>();

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      expiry: ttl ? Date.now() + ttl : undefined
    });
  }

  // ... 其他方法
}
```

### 8.2 批量操作

```typescript
/**
 * 批量操作接口
 */
interface IBatchOperation {
  /**
   * 批量创建节点
   */
  batchCreateNodes(items: Partial<Node>[]): Promise<Node[]>;

  /**
   * 批量更新节点
   */
  batchUpdateNodes(updates: Array<{ id: string; changes: Partial<Node> }>): Promise<Node[]>;

  /**
   * 批量删除节点
   */
  batchDeleteNodes(ids: string[]): Promise<void>;
}
```

## 9. 测试API

### 9.1 Mock服务

```typescript
/**
 * Mock LLM服务（用于测试）
 */
class MockLLMService implements ILLMService {
  async chat(params: { messages: ChatMessage[] }): Promise<string> {
    return 'This is a mock response';
  }

  async chatStream(params: { messages: ChatMessage[] }): AsyncIterator<ChatChunk> {
    // 返回模拟的流式响应
  }

  // ... 其他方法
}

/**
 * Mock存储服务（用于测试）
 */
class MockNodeService implements INodeService {
  private nodes = new Map<string, Node>();

  async create(data: Partial<Node>): Promise<Node> {
    const node: Node = {
      id: generateUUID(),
      type: data.type || NodeType.USER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: data.parentId || null,
      content: data.content || '',
      metadata: data.metadata || { tags: [], metaInstructions: {} },
      tokenCount: 0
    };

    this.nodes.set(node.id, node);
    return node;
  }

  // ... 其他方法
}
```

## 10. 安全性API

### 10.1 API Key管理

```typescript
/**
 * API Key存储接口
 */
interface IApiKeyManager {
  /**
   * 保存API Key（加密）
   */
  saveKey(provider: string, key: string): Promise<void>;

  /**
   * 获取API Key（解密）
   */
  getKey(provider: string): Promise<string | null>;

  /**
   * 删除API Key
   */
  deleteKey(provider: string): Promise<void>;

  /**
   * 检查是否有API Key
   */
  hasKey(provider: string): Promise<boolean>;
}
```

### 10.2 内容安全

```typescript
/**
 * 内容过滤接口
 */
interface IContentFilter {
  /**
   * 检查内容是否安全
   */
  check(content: string): Promise<{
    isSafe: boolean;
    reasons?: string[];
  }>;

  /**
   * 过滤敏感内容
   */
  filter(content: string): Promise<string>;
}
```

## 11. 导出/导入API

### 11.1 数据导出

```typescript
/**
 * 导出格式
 */
enum ExportFormat {
  JSON = 'json',
  MARKDOWN = 'markdown',
  TEXT = 'text'
}

/**
 * 导出服务接口
 */
interface IExportService {
  /**
   * 导出单个节点
   */
  exportNode(nodeId: string, format: ExportFormat): Promise<string>;

  /**
   * 导出对话树
   */
  exportTree(treeId: string, format: ExportFormat): Promise<string>;

  /**
   * 导出路径
   */
  exportPath(nodeId: string, format: ExportFormat): Promise<string>;

  /**
   * 下载文件
   */
  download(content: string, filename: string): void;
}
```

### 11.2 数据导入

```typescript
/**
 * 导入服务接口
 */
interface IImportService {
  /**
   * 从JSON导入
   */
  importFromJSON(json: string): Promise<{
    trees: number;
    nodes: number;
  }>;

  /**
   * 从文件导入
   */
  importFromFile(file: File): Promise<{
    trees: number;
    nodes: number;
  }>;

  /**
   * 验证导入数据
   */
  validate(json: string): Promise<{
    isValid: boolean;
    errors?: string[];
  }>;
}
```

## 12. API版本控制

```typescript
/**
 * API版本
 */
const API_VERSION = '1.0.0';

/**
 * 版本兼容性检查
 */
interface VersionCompatibility {
  minVersion: string;
  maxVersion: string;
  isCompatible(version: string): boolean;
}

/**
 * 迁移API
 */
interface IMigration {
  version: string;
  migrate(data: any): Promise<any>;
}
```

## 13. 总结

本文档定义了AI对话客户端的完整API接口规范，包括：
- ✅ 前端组件API（Store、Hooks、组件Props）
- ✅ 服务层API（Node、DAG、LLM、Token、压缩服务）
- ✅ 数据层API（IndexedDB封装、存储Schema）
- ✅ 外部API集成（OpenAI API）
- ✅ 事件系统和错误处理
- ✅ 性能优化、测试、安全性API
- ✅ 导出/导入API

所有API接口都使用TypeScript定义，确保类型安全和开发体验。

# Prompt Tree

<p align="center">
  <strong>中文</strong> · <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.6.3-7A8B6E?style=flat-square" alt="Version 0.6.3" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
</p>

Prompt Tree 是一个**本地优先（local-first）的 AI 对话客户端**：它将每一次对话建模为**节点化的 DAG（树 + 分支）**，并提供显式的 **Context Box**，用于可控地组装提示词上下文。

## 初衷与要解决的问题

多数聊天式 AI 产品是“线性对话”：

- 想探索不同思路时，经常需要复制粘贴、重开对话或丢失上下文
- 长对话难以回溯与定位，Token 成本也会越来越高
- “上下文管理”通常是隐式的，难以审计与复用

Prompt Tree 把对话变成一张**可视化画布**：可以分叉、对比、压缩、并精确控制上下文。

## 主要功能

- **对话 DAG（树 + 分支）**：从任意节点继续，对比不同分支结果。
- **画布 + Chat 一体**：在可视化结构中进行对话与回溯。
- **Context Box（上下文组装台）**：拖拽节点、排序、预览最终上下文、查看 Token 占用。
- **长期记忆（3 层架构）**：
  - **用户 Profile（JSON → 派生 Markdown）**：持久化的偏好/身份信息，在设置里完全可视化与可编辑。
  - **记忆库（Memory Bank 条目）**：原子记忆条目，包含 tags / 状态 / 置信度 / 来源；支持 user / folder 两种作用域。
  - **Folder Doc（JSON → 派生 Markdown）**：按 Folder 维护的长期文档，在 Folder 页面可视化与可编辑。
  - **首条基础注入 + 每轮记忆刷新**：在 thread 首条用户消息注入 Profile/Folder Doc 与初始 `topK(folder) + topK(user)`；之后每次用户消息都会刷新 Context Box 的自动记忆命中。
  - **最近消息连贯性（可选）**：每个 thread 的首条用户消息时，将同一 Folder（或非 Folder）最近一个 thread 的最后 N 条消息复制到 Context Box。
  - **异步记忆写入器（Memory Writer LLM）**：每次用户发送消息都会异步触发；读取系统提示词 + 当前 thread 全部用户消息 + 执行时实时解析的记忆快照；可更新 Profile / Folder Doc 并写入记忆（首条消息可强制至少写入 1 条）。
  - **`search_memory` 工具 + Pin**：模型可在工具循环中搜索全量记忆库；命中记忆会加入 Context Box 并可 Pin；单 thread 自动/Pin 上限受控（Pin 优先于自动）。
  - **Embedding（可选）**：Embedding 模型可配置；未启用/不可用时自动退化为词法匹配。
- **多模型并行分支**：选择多个模型，一次发送生成多条分支回复。
- **压缩/解压**：将选中的连续链路（或 Context）压缩成一个节点，需要时再解压恢复。
- **工具（可选）**：Web Search（Tavily/Exa）、MCP Servers、本地 Python 执行。
- **本地存储**：对话数据存 IndexedDB；提供商/工具设置存 localStorage。

## 安装

### 环境要求

- Node.js 18+

### 安装（npm / pnpm）

```bash
npm i -g @yxp934/prompt-tree
# 或
pnpm add -g @yxp934/prompt-tree
```

### 更新

```bash
npm i -g @yxp934/prompt-tree@latest
# 或
pnpm up -g @yxp934/prompt-tree
```

### 卸载

```bash
npm rm -g @yxp934/prompt-tree
# 或
pnpm rm -g @yxp934/prompt-tree
```

## 启动

启动应用：

```bash
tree
```

打开：`http://localhost:1666`

### 更改端口

```bash
tree --port 7777
```

### 查看帮助 / 版本

```bash
tree --help
tree --version
```

### 不做全局安装（可选）

如果你的系统里已经有 `tree` 命令（或希望一次性运行）：

```bash
npx -y --package @yxp934/prompt-tree tree
# 或
pnpm dlx --package @yxp934/prompt-tree tree
```

## 功能用法（详细）

### 1）文件夹与线程

- 新建 Folder（Library）用于归档与管理线程
- 可选：为 Folder 设置 **Unified System Prompt**（对该 Folder 下新建线程生效）

<img src="../folder-light.png" alt="Folders（浅色）" width="900" />
<img src="../folder-dark.png" alt="Folders（深色）" width="900" />

### 2）配置模型服务（Provider）

在 `Settings → Model Service` 中：

- 添加 Provider
- 添加一个或多个 API Key（可设置主 Key）
- 配置 Base URL（OpenAI 兼容）
- 拉取/启用模型并测试连接

### 3）选择默认模型

在 `Settings → Default Model` 中：

- 选择一个或多个已启用模型（一次发送可并行生成多个分支）
- 选择压缩模型（用于生成摘要/元指令建议）
- 选择标题模型（用于生成线程标题）

<img src="../settings-model.png" alt="设置 - 模型" width="900" />

### 4）对话与分支

- 发送一条消息；若选了多个模型，会生成多条 assistant 分支
- 可在分支列表切换，或从任意节点继续对话

<img src="../thread.png" alt="对话与分支" width="900" />

### 5）画布导航

- 画布展示当前线程的节点结构
- 常用操作：从此处继续、压缩分支、解压、编辑节点、删除子树

<img src="../canva.png" alt="画布" width="900" />

### 6）Context Box（上下文组装）

- 从顶部打开 Context 面板
- 将画布中的节点拖拽到 Context Box
- 支持排序、预览最终上下文、查看 Token 占用
- 支持压缩整个 Context 或压缩选中的连续链路（必须是同一路径的连续选择）

### 7）长期记忆（Profile / 记忆库 / Folder Doc）

- 在 `Settings → Memory` 中配置：
  - 开关长期记忆、首条消息自动注入、**首条消息自动加入最近消息（最后 N 条）**、以及 `search_memory` 工具。
  - 开启“首条消息自动加入最近消息”后，新 thread 的首条用户消息会将同一 Folder（或非 Folder）最近一个 thread 的最后 N 条消息加入 Context Box。
  - 在输入框旁的 `Tools` 菜单中，可对每次发送勾选/取消 `search_memory`（新安装默认勾选）；勾选后会在 Context Box 的 **Tool Blocks** 中可见，并且会出现在 **Context 预览**里。
  - 选择 **Memory Writer 模型** 与（可选）**Embedding 模型**。
  - 可视化/编辑 **用户 Profile JSON** 与派生 Markdown。
  - 浏览/编辑/删除/恢复记忆条目；更换 embedding 模型后可选择重算 embedding。
- 在 Folder 线程中：
  - 在 Folder 页面配置 **首条消息 RAG 比例**（`topKFolder/topKUser`）。
  - 可视化/编辑 **Folder Doc JSON**，并管理 **Folder 作用域记忆**。

### 8）工具（Web Search / MCP / Python）

在 `Settings → Tools` 中配置：

- Web Search：Tavily / Exa 的 API Key（按需）
- MCP：添加 Server JSON 与 Token
- Python：python 命令、超时与输出限制

<img src="../settings-tools.png" alt="设置 - 工具" width="900" />

## 隐私与数据（基于当前代码实现）

- **对话数据**存储在浏览器 IndexedDB：`AIChatClientDB`
- **长期记忆数据**（用户 Profile / Folder Doc / 记忆库 + 可选 embedding 向量）同样存储在该 IndexedDB 中
- **Provider 配置 / API Key / 工具设置**存储在浏览器 `localStorage`（键名以 `prompt-tree.*` 为前缀）
- 应用本地运行；当你生成回复或调用工具时，请求只会发往你配置的模型/工具服务端点（本仓库未发现内置的分析/遥测上报代码）
- 若启用 **Memory Writer** 或 **Embedding**，会调用你配置的模型端点来完成对应能力
- 若启用 **Python 工具**，会在本机通过启动 Python 进程执行代码，请在理解风险后再开启

## 开发者本地运行

```bash
npm install
npm run dev
```

打开：`http://localhost:1666`

常用脚本：

```bash
npm run build
npm run start
npm run test
npm run lint
npm run typecheck
```

## 文档

- 产品：[`需求文档.md`](./docs/需求文档.md)
- 技术设计：[`TECHNICAL_DESIGN.md`](./docs/TECHNICAL_DESIGN.md)
- API 设计：[`API_DESIGN.md`](./docs/API_DESIGN.md)
- 路线图：[`ROADMAP.md`](./docs/ROADMAP.md)

## 更新日志

### 0.6.4（2026-02-06）

- 提供商设置：修复 Base URL 输入时 `/` 会被实时删除的问题；规范化改为在失焦或连接检测前执行。

### 0.6.3（2026-02-06）

- 记忆：自动记忆 RAG 改为每条用户消息刷新，不再仅限首条注入。
- Memory Writer：记忆快照改为在异步任务执行时基于最新记忆库生成，减少重复/冲突写入。

### 0.6.2（2026-02-06）

- 记忆：新增“首条消息自动加入最近消息（最后 N 条）”开关，用于跨 thread 保持连续性，并可与长期记忆注入并行使用。

## 联系方式

- Email：yxp934@outlook.com
- WeChat：WanguA8

## License

MIT

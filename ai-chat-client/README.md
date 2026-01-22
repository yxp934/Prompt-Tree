# Cortex - AI Dialogue Topology Client

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
</p>

基于拓扑节点的上下文可视化AI客户端，让用户像管理Git树一样管理AI对话历史。

## ✨ 特性

- 🌳 **树状对话管理** - 可视化对话分支，随时回溯和分叉
- 📦 **上下文组装台** - 自由拖拽节点组装上下文，精确控制Token使用
- 🗜️ **智能压缩** - AI辅助压缩历史对话，提取元指令
- 🎨 **优雅设计** - Cortex设计系统，温暖的编辑风格美学

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd ai-chat-client

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 查看应用。

## 📁 项目结构

```
ai-chat-client/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # 根布局
│   │   ├── page.tsx         # 主页面
│   │   └── globals.css      # 全局样式 + 设计系统
│   ├── components/          # React组件
│   │   └── layout/          # 布局组件
│   │       ├── MainLayout.tsx    # 三栏主布局
│   │       ├── Sidebar.tsx       # 左侧对话列表
│   │       └── ContextPanel.tsx  # 右侧上下文面板
│   ├── lib/                 # 工具库 (待实现)
│   ├── store/               # Zustand状态管理 (待实现)
│   ├── types/               # TypeScript类型定义 (待实现)
│   └── __tests__/           # 测试文件
├── public/                  # 静态资源
└── package.json
```

## 🎨 设计系统

### 色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Paper | `#faf9f7` | 主背景 |
| Cream | `#f5f2ed` | 侧边栏背景 |
| Ink | `#1a1816` | 主文字 |
| Copper | `#b87333` | 强调色 |
| Human | `#6b5b4f` | 用户节点 |
| Machine | `#4a6741` | AI节点 |
| System | `#4f5b6b` | 系统节点 |

### 字体

- **Instrument Serif** - 标题和品牌
- **DM Sans** - 正文内容
- **IBM Plex Mono** - 代码和数据

## 📜 开发脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # ESLint检查
npm run lint:fix     # ESLint自动修复
npm run format       # Prettier格式化
npm run typecheck    # TypeScript类型检查
```

## 📋 开发进度

- [x] **阶段 0**: 项目初始化 ✅
- [ ] **阶段 1**: 数据层实现
- [ ] **阶段 2**: 状态管理实现
- [ ] **阶段 3**: 单分支对话
- [ ] **阶段 4**: 树状图可视化
- [ ] **阶段 5**: 分支管理
- [ ] **阶段 6**: 上下文组装台
- [ ] **阶段 7**: 节点压缩功能
- [ ] **阶段 8**: UI优化和主题
- [ ] **阶段 9**: 数据导出和导入
- [ ] **阶段 10**: 测试和优化
- [ ] **阶段 11**: 部署和发布

详细进度请查看 [DEVELOPMENT_TODOLIST.md](../DEVELOPMENT_TODOLIST.md)

## 🛠️ 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4
- **状态管理**: Zustand
- **可视化**: React Flow
- **数据存储**: IndexedDB

## 📄 许可证

MIT License

---

<p align="center">
  Built with ❤️ using Claude Code
</p>

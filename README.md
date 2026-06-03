# 松果 (Pinecone)

个人浏览器起始页，支持本地书签与 Linkding 集成。

## 功能

- 本地书签（`services.json` / 内联回退）
- Linkding API 书签同步（多标签筛选）
- 标签选择器 — 从 Linkding 获取标签列表，选择后作为查询参数
- 智能图标解析（twenty-icons → favicon.im → Vemetric → apple-touch-icon）
- 右键菜单：屏蔽网站、自定义图标（上传图片 / 输入 URL）
- 已屏蔽地址管理 / 自定义图标管理（JSON 编辑 + 实时预览）
- 自定义背景、图标大小/圆角/不透明度/间距、文字样式/颜色/位置、网格列数
- 悬浮效果：简洁放大 / macOS Dock
- 数据持久化（IndexedDB 自定义 persist 插件）
- PWA 离线支持（Service Worker）
- 移动端响应式布局（全屏设置面板）

## 使用

直接在浏览器打开 `index.html`，无需构建工具。

### Linkding 配置

1. 打开设置 → 数据 → 切换为 Linkding
2. 填入 API 地址和令牌（支持密码管理器自动填充）
3. 点击「选择标签」获取标签列表，勾选后点击「获取书签」

### CORS 代理

若 Linkding API 与页面不同源，在设置中启用代理（默认 `corsproxy.io`）。

## 文件结构

```
├── index.html              # 主页面（Alpine.js 模板 + 设置面板）
├── styles.css              # 全部样式（含移动端响应式）
├── app.js                  # Alpine.js 组件逻辑（主控制器）
├── icon-fetcher.js         # 图标解析链 + IndexedDB 缓存
├── linkding-fetcher.js     # Linkding API 封装
├── persist.js              # 自定义 Alpine.js persist 插件（IndexedDB）
├── db.js                   # IndexedDB 封装（PineconeDB）
├── sw.js                   # Service Worker（PWA 离线缓存）
├── services.json           # 本地书签数据
└── manifest.json           # PWA 清单
```

## 技术栈

- [Alpine.js](https://alpinejs.dev/) — 响应式 UI
- IndexedDB — 持久化（自定义 persist 插件 `persist.js` + `db.js`）
- Service Worker — 离线缓存（CDN 资源 + 本地静态资源）

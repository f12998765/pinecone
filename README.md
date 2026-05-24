# 松果 (Pinecone)

个人浏览器起始页，支持本地书签与 Linkding 集成。

## 功能

- 本地书签（`services.json` / 内联回退）
- Linkding API 书签同步（多标签筛选）
- 智能图标解析（twenty-icons → favicon.im → Vemetric → apple-touch-icon）
- 右键菜单：屏蔽网站、自定义图标
- 自定义背景、图标大小/圆角/间距、文字样式、网格列数
- 悬浮效果：简洁放大 / macOS Dock
- 数据持久化（localStorage）
- PWA 离线支持（Service Worker）

## 使用

直接在浏览器打开 `index.html`，无需构建工具。

### Linkding 配置

1. 打开设置 → 数据 → 切换为 Linkding
2. 填入 API 地址和令牌
3. 点击「选择标签」获取标签列表，勾选后点击「获取书签」

### CORS 代理

若 Linkding API 与页面不同源，在设置中启用代理（默认 `corsproxy.io`）。

## 文件结构

```
├── index.html              # 主页面
├── styles.css              # 样式
├── app.js                  # Alpine.js 组件逻辑
├── icon-fetcher.js         # 图标解析链
├── linkding-fetcher.js     # Linkding API 封装
├── service-worker.js       # PWA 离线缓存
├── services.json           # 本地书签数据
└── manifest.json           # PWA 清单
```

## 技术栈

- [Alpine.js](https://alpinejs.dev/) — 响应式 UI
- [Alpine.js Persist](https://alpinejs.dev/plugins/persist) — localStorage 持久化
- Service Worker — 离线缓存

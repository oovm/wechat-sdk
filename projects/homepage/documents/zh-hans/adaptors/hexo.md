---
title: Hexo
order: 2
---

# Hexo 适配

包 **`hexo-plugin-live2d`** 已迁出 live2d.ts，与主题同仓维护：

- 仓库：**[hexo-theme-yuki](https://github.com/doki-land/hexo-theme-yuki)** → `packages/hexo-plugin-live2d`
- 设计：`规划设计/live2d/07-静态站插件归属.md`

本仓只提供运行时与 `<live-2d>` CE；Hexo 侧只做 **注入 / 配置透传 / 静态资源**，默认 **`loader: ce`**。

对话气泡、一言、工具栏等看板娘能力在 `@doki-land/live2d-widget` 或 `<live-2d-widget>`，不要在 Hexo 插件里复制博客壳。

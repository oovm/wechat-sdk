---
title: Hexo
order: 2
---

# Hexo adaptor

Package **`hexo-plugin-live2d`** no longer lives in live2d.ts — it ships with the theme repo:

- Repo: **[hexo-theme-yuki](https://github.com/doki-land/hexo-theme-yuki)** → `packages/hexo-plugin-live2d`
- Design: `规划设计/live2d/07-静态站插件归属.md`

This workspace provides the runtime and `<live-2d>` CE only. The Hexo plugin handles **inject / config passthrough / static assets**, default **`loader: ce`**.

Tips, dialogue bubbles, and toolbar chrome belong in `@doki-land/live2d-widget` or `<live-2d-widget>` — do not fork a blog shell inside the Hexo adaptor.

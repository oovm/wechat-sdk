---
title: Packages
order: 1
---

# Packages

| Package                          | Role                                                   |
|----------------------------------|--------------------------------------------------------|
| `@doki-land/live2d`              | Facade: session, load, progress / frame profile events |
| `@doki-land/live2d-core`         | Contracts and event types                              |
| `@doki-land/live2d-loader`       | URL / `npm:` resolve and asset fetch                   |
| `@doki-land/live2d-renderer`     | CPU evaluate + WebGPU / WebGL2 / Canvas2D              |
| `@doki-land/live2d-widget`       | Page mount shell (tips/chrome later)                   |
| `vue-plugin-live2d`  | Vue `<Live2D>`                                         |
| `hexo-plugin-live2d` | Hexo inject only — no dialogue chrome                  |

Dependency direction: `adaptor / widget → live2d → loader + renderer → core`.

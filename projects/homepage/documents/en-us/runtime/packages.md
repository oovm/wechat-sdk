---
title: Packages
order: 1
---

# Packages

| Package                      | Role                                                             |
|------------------------------|------------------------------------------------------------------|
| `@doki-land/live2d`          | Facade: session, load, progress / frame profile events           |
| `@doki-land/live2d-core`     | Contracts and event types                                        |
| `@doki-land/live2d-loader`   | URL / `npm:` resolve and asset fetch                             |
| `@doki-land/live2d-renderer` | CPU evaluate + WebGPU / WebGL2 / Canvas2D                        |
| `@doki-land/live2d-widget`   | Page mount shell (tips/chrome later)                             |
| `@doki-land/live2d-element`  | Official `<live-2d>` / `<live-2d-widget>` Custom Elements        |
| `vue-plugin-live2d`          | Vue `<Live2d>` thin shell over CE                                |
| `react-plugin-live2d`        | React `<Live2d>` thin shell over CE (transitional)               |
| `@vmz/plugin-live2d`         | VMZ `<Live2dHost />` / `<Live2dStage />` (official site dogfood) |
| `cocos-plugin-live2d`        | Creator 3.x (Web) `Live2D` component                             |

Hexo / Hugo inject plugins ship from **hexo-theme-yuki** / **hugo-theme-yuki** (not this repo).

Dependency direction: `adaptor / widget → live2d → loader + renderer → core`.

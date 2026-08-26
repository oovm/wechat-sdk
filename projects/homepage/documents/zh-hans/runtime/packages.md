---
title: 包结构
order: 1
---

# 包结构

| 包                           | 职责                                                       |
|------------------------------|------------------------------------------------------------|
| `@doki-land/live2d`          | 门面：会话、加载、进度 / 帧 profile 事件                   |
| `@doki-land/live2d-core`     | 契约与事件类型                                             |
| `@doki-land/live2d-loader`   | URL / `npm:` 解析与资源拉取                                |
| `@doki-land/live2d-renderer` | CPU evaluate + WebGPU / WebGL2 / Canvas2D                  |
| `@doki-land/live2d-widget`   | 页面挂载壳（含后续 tips/chrome）                           |
| `@doki-land/live2d-element`  | 官方 `<live-2d>` / `<live-2d-widget>` Custom Element             |
| `vue-plugin-live2d`          | Vue `<Live2d>` 薄壳（CE）                                        |
| `react-plugin-live2d`        | React `<Live2d>` 薄壳（过渡）                                    |
| `@vmz/plugin-live2d`         | VMZ `<Live2dHost />` / `<Live2dStage />`（官方站 dogfood）       |
| `cocos-plugin-live2d`        | Creator 3.x（Web）`Live2D` 组件                                  |

Hexo / Hugo 注入插件在 **hexo-theme-yuki** / **hugo-theme-yuki**（不在本仓发布）。

依赖方向：`adaptor / widget → live2d → loader + renderer → core`。

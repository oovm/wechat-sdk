---
title: 包结构
order: 1
---

# 包结构

| 包                               | 职责                                      |
|----------------------------------|-------------------------------------------|
| `@doki-land/live2d`              | 门面：会话、加载、进度 / 帧 profile 事件  |
| `@doki-land/live2d-core`         | 契约与事件类型                            |
| `@doki-land/live2d-loader`       | URL / `npm:` 解析与资源拉取               |
| `@doki-land/live2d-renderer`     | CPU evaluate + WebGPU / WebGL2 / Canvas2D |
| `@doki-land/live2d-widget`       | 页面挂载壳（含后续 tips/chrome）          |
| `vue-plugin-live2d`  | Vue `<Live2D>`                            |
| `hexo-plugin-live2d` | Hexo 注入；不做对话壳                     |

依赖方向：`adaptor / widget → live2d → loader + renderer → core`。

---
title: 快速开始
order: 1
---

# 快速开始

## 安装

```bash
pnpm add @doki-land/live2d
```

Vue 项目可额外安装：

```bash
pnpm add vue-plugin-live2d
```

## 最小用法

```ts
import {createLive2D, createRenderer} from "@doki-land/live2d";

const canvas = document.querySelector("canvas")!;
const runtime = createLive2D({
    renderer: createRenderer({prefer: ["canvas2d", "webgl2", "webgpu"]}),
});
runtime.mount(canvas);
await runtime.loadModel("/models/quad/quad.model3.json");

function tick() {
    runtime.update(1 / 60);
    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

## 接下来

- [模型来源](./sources) — 本地、远程 URL、`npm:` 包
- [模型格式](../runtime/formats) — 可画基线与官方 moc 进度

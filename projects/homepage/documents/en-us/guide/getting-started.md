---
title: Getting started
order: 1
---

# Getting started

## Install

```bash
pnpm add @doki-land/live2d
```

For Vue:

```bash
pnpm add vue-plugin-live2d
```

## Minimal usage

```ts
import {createLive2d, createRenderer} from "@doki-land/live2d";

const canvas = document.querySelector("canvas")!;
const runtime = createLive2d({
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

## Hit testing (current limit)

`hitTest` runs triangle hits in normalized model space. A HitArea **name** is returned only when settings `Id` is `D_{drawableIndex}` or the bare index string; otherwise you get `drawable:N` (common for sample models). Full named mapping is not the main path yet.

## Next

- [Model sources](./sources) — local, remote URL, `npm:` packages
- [Formats](../runtime/formats) — drawable baseline and official moc status

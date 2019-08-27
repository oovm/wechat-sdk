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

## Next

- [Model sources](./sources) — local, remote URL, `npm:` packages
- [Formats](../runtime/formats) — drawable baseline and official moc status

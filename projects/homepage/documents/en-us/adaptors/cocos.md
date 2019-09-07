---
title: Cocos
order: 3
---

# Cocos adaptor

Package: `cocos-plugin-live2d`

Creator **3.x (Web)** `Live2D` component. Attach it to a node; it draws with `@doki-land/live2d` into an offscreen canvas and uploads pixels to the node's `Sprite` each frame.

**Packaging:** one package `cocos-plugin-live2d` with `src/creator3` and `src/creator2`. Session/drawing stay in `@doki-land/live2d`. Default / `…/creator3` are Creator 3; `…/creator2` is a Component scaffold for import checks (`COCOS_CREATOR_API === 2`).

```ts
import { Live2D } from "cocos-plugin-live2d";
// same: import { Live2D } from "cocos-plugin-live2d/creator3";
// Creator 2 scaffold: import { Live2D } from "cocos-plugin-live2d/creator2";

const live2d = node.addComponent(Live2D);
live2d.model = "/models/wanko/wanko.model3.json";
live2d.width = 360;
live2d.height = 360;
live2d.prefer = ["canvas2d", "webgl2", "webgpu"];
live2d.autoSway = true;
```

Default prefer puts **Canvas2D** first so Texture2D readback stays reliable. Native Android / iOS are out of this slice. Tips / chrome stay in `@doki-land/live2d-widget`.

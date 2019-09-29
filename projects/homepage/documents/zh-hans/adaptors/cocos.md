---
title: Cocos
order: 3
---

# Cocos 适配

包：`cocos-plugin-live2d`

面向 **Cocos Creator 3.x（Web）** 的 `Live2D` 组件。节点上挂组件即可；内部用 `@doki-land/live2d` 离屏绘制，再同步到同节点
`Sprite`。

**包约定**：只有一个包名 `cocos-plugin-live2d`，源码分 `src/creator3` / `src/creator2`。会话与绘制在 `@doki-land/live2d`
。默认入口与 `…/creator3` 为 Creator 3；`…/creator2` 目前是可导入的组件壳（`COCOS_CREATOR_API === 2`），便于验证工程能否识别同一插件。

```ts
import { Live2D } from "cocos-plugin-live2d";
// 等价：import { Live2D } from "cocos-plugin-live2d/creator3";
// Creator 2 脚手架：import { Live2D } from "cocos-plugin-live2d/creator2";

const live2d = node.addComponent(Live2D);
live2d.model = "/models/wanko/wanko.model3.json";
live2d.width = 360;
live2d.height = 360;
live2d.prefer = ["canvas2d", "webgl2", "webgpu"];
live2d.autoSway = true;
```

默认 prefer 以 **Canvas2D** 优先，便于每帧读像素上传 Texture2D。原生 Android / iOS 不在本切片范围。对话气泡等 chrome 仍属
`@doki-land/live2d-widget`，不在本适配器内复制。

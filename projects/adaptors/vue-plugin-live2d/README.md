# vue-plugin-live2d

**Vue 3 组件适配层** — 把 [`@doki-land/live2d`](https://www.npmjs.com/package/@doki-land/live2d) 包成 `<Live2D>`
，处理挂载、模型切换、加载进度条与销毁。

Live2D 的解码、渲染、动作逻辑仍在 `@doki-land/live2d`；本包只做 Vue 生命周期与 props/events 绑定。

## 安装

```bash
npm i vue-plugin-live2d @doki-land/live2d vue
```

Peer：`vue ^3.4`。

## 注册组件

```ts
// main.ts
import { createApp } from "vue";
import { Live2D } from "vue-plugin-live2d";
import App from "./App.vue";

createApp(App).component("Live2D", Live2D).mount("#app");
```

或在 SFC 里按需导入（无需全局注册）：

```vue
<script setup lang="ts">
import { Live2D } from "vue-plugin-live2d";
</script>

<template>
  <Live2D
    model="/models/wanko/Wanko.model3.json"
    :width="320"
    :height="320"
    :autoplay="true"
    :show-progress="true"
  />
</template>
```

## `<Live2D>` Props

| Prop               | 类型                  | 默认          | 说明                                         |
|--------------------|-----------------------|---------------|----------------------------------------------|
| `model`            | `ModelSource \| null` | `null`        | model3.json URL、`npm:…` 或 core 内联 source |
| `width` / `height` | `number`              | 320           | 容器与 Canvas 尺寸（px）                     |
| `prefer`           | `RendererKind[]`      | Canvas2D 优先 | 渲染后端探测顺序                             |
| `autoplay`         | `boolean`             | `true`        | 挂载后自动 RAF                               |
| `autoSway`         | `boolean`             | `true`        | 自动轻微摇头                                 |
| `showProgress`     | `boolean`             | `true`        | 内置加载进度 overlay                         |

## 事件（emit）

组件在加载与运行时会抛出进度、帧剖析等事件（详见组件 `defineEmits`）。典型用法：

```vue
<Live2D
  model="npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json"
  @loadprogress="(p) => console.log(p.stage, p.progress)"
/>
```

## 暴露的运行时（ref）

通过 `ref` 可访问底层 `Live2DRuntime`（`createLive2D` 返回值），用于 `playMotion`、`setParameter` 等 imperative 调用。详见组件
`defineExpose`。

## 与 widget / Hexo 的区别

| 包                           | 用途                           |
|------------------------------|--------------------------------|
| **vue-plugin-live2d**        | Vue 单页应用内嵌组件           |
| **@doki-land/live2d-widget** | 框架无关看板娘壳（气泡工具栏） |
| **hexo-plugin-live2d**       | Hexo 静态站注入，零 Vue 依赖   |

## 仓库

[github.com/doki-land/live2d.ts](https://github.com/doki-land/live2d.ts) · `projects/adaptors/vue-plugin-live2d`

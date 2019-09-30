# @doki-land/live2d-widget

**看板娘产品壳** — 在 `@doki-land/live2d` 之上提供「挂到页面就能用」的 DOM 包装：固定尺寸 Canvas、可选 RAF
自动播放、鼠标视线跟踪、加载进度、以及气泡 + 简易工具栏（一言 / 照片 / 离开）。

这不是「更简化的 live2d API」；引擎级集成（Cocos、自研游戏循环）应直接用 `@doki-land/live2d` 的 Stage / Actor。

## 安装

```bash
npm i @doki-land/live2d-widget @doki-land/live2d
```

## 一行挂载

```ts
import {mountWidget} from "@doki-land/live2d-widget";

await mountWidget({
    target: "#live2d",
    model: "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
    width: 280,
    height: 400,
    chrome: true,   // 气泡 + 工具栏
    autoplay: true, // 内部 RAF + 轻微 autoSway
});
```

## 类 API

```ts
import {Live2DWidget} from "@doki-land/live2d-widget";

const widget = new Live2DWidget();
await widget.mount({
    target: document.body,
    model: "/models/local.model3.json",
    prefer: ["webgpu", "webgl2", "canvas2d"],
    onHit: ({area, x, y}) => console.log("hit", area),
});

// 销毁
widget.destroy();
```

## 选项说明

| 选项               | 默认                       | 说明                                    |
|--------------------|----------------------------|-----------------------------------------|
| `target`           | —                          | CSS 选择器或 HTMLElement（必填）        |
| `model`            | —                          | model.json / model3.json URL 或 `npm:…` |
| `width` / `height` | 280 × 400                  | Canvas 像素尺寸                         |
| `autoplay`         | `true`                     | 挂载后自动 `requestAnimationFrame` 循环 |
| `autoSway`         | `true`                     | 播放时用正弦驱动 `PARAM_ANGLE_X`        |
| `chrome`           | —                          | `true` 或配置对象：欢迎语、工具按钮等   |
| `prefer`           | webgpu → webgl2 → canvas2d | 与 `createLive2D` 相同                  |

`chrome` 相关：`mountChrome`、`createTipMessage`、`DEFAULT_WELCOME`。

## 与 Hexo 插件的关系

[`hexo-plugin-live2d`](https://www.npmjs.com/package/hexo-plugin-live2d) 在构建时把本包 + `@doki-land/live2d`
打进站点静态资源，并在 `_config.yml` 里配置 `live2d.model`。博客作者通常 **不需要**手动 import 本包。

## 边界（本包不做的事）

- 多角色 Stage、游戏 manual 帧循环 → `@doki-land/live2d`
- Vue 组件 → `vue-plugin-live2d`
- VMZ Custom Element `<live2d>` → 未来官方产品面（当前预览用 widget / adaptor）

## 仓库

[github.com/doki-land/live2d.ts](https://github.com/doki-land/live2d.ts) · `projects/live2d-widget`

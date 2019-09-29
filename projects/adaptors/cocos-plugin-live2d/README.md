# cocos-plugin-live2d

**Cocos Creator 适配包** — 在 Creator 组件里挂载 Live2D，会话 / 求值 / 渲染仍由 [
`@doki-land/live2d`](https://www.npmjs.com/package/@doki-land/live2d) 负责。

一个 npm 包、两个入口，分别对应 Creator 3.x 与 2.4 脚手架。

## 安装

在 Cocos 项目的 `package.json` 中添加依赖后执行 Creator 的扩展安装流程（或 npm/pnpm 安装到项目）：

```bash
npm i cocos-plugin-live2d @doki-land/live2d
```

## 选择入口

| import                                                  | Creator 版本 | 状态                                       |
|---------------------------------------------------------|--------------|--------------------------------------------|
| `cocos-plugin-live2d` 或 `cocos-plugin-live2d/creator3` | **3.x**      | 可用：Web 运行时 + offscreen canvas        |
| `cocos-plugin-live2d/creator2`                          | **2.4**      | 脚手架：`cc.Component` 壳，尚未接线 live2d |

验证当前解析到的 API 版本：

```ts
import { COCOS_CREATOR_API, Live2D } from "cocos-plugin-live2d/creator3";
// COCOS_CREATOR_API === 3
```

## Creator 3.x 用法

```ts
import { _decorator, Component } from "cc";
import { Live2D } from "cocos-plugin-live2d/creator3";

const { ccclass, property } = _decorator;

@ccclass("MyLive2D")
export class MyLive2D extends Live2D {
  start() {
    this.model = "https://example.com/model/Wanko.model3.json";
  }
}
```

或在编辑器里给节点添加 `Live2D` 组件，在属性检查器填写 `model` URL（`model3.json` / `model.json` / `npm:…`）。

组件内部会：

1. 创建离屏 Canvas
2. `createLive2D()` + `mount`
3. 在 Creator 更新循环里驱动 `update` / `render`（与引擎帧同步）

## Creator 2.4（当前限制）

```ts
import { Live2D } from "cocos-plugin-live2d/creator2";
```

`creator2` 入口仅挂载空组件并在 `start()` 打印警告： **尚未**连接 `@doki-land/live2d`。用于验证包解析与 `/creator2` 导出；完整
2.4 支持在后续版本。

## 不包含

- 原生 Android / iOS Live2D SDK 封装
- 看板娘气泡 / 一言（在 `@doki-land/live2d-widget`，Cocos 游戏一般不用）
- 多角色 Stage API 的编辑器示例（可直接使用 `@doki-land/live2d` 的 `createLive2dStage`）

## 与其他包

```text
cocos-plugin-live2d  →  Cocos 组件生命周期
@doki-land/live2d    →  模型加载、参数、渲染
@doki-land/live2d-renderer  →  WebGPU / WebGL2 / Canvas2D
```

## 仓库

[github.com/doki-land/live2d.ts](https://github.com/doki-land/live2d.ts) · `projects/adaptors/cocos-plugin-live2d`

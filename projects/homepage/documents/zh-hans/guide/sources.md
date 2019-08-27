---
title: 模型来源
order: 2
---

# 模型来源

`ModelSource` 支持三类入口，解析统一走 `@doki-land/live2d-loader`。

## 本地 / 站点路径

相对站点根路径，例如 homepage 同步后的样例：

```ts
await runtime.loadModel("/models/quad/quad.model3.json");
```

## 远程 URL

任意可 CORS 访问的 `https://…/model3.json` 或 moc2 `model.json`。

## npm 包

```text
npm:package[@version]/path/to/model.json
```

默认经 jsDelivr 拉取；Playground 的 npm 模式会拼成该格式。

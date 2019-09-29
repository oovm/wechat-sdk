# hexo-plugin-live2d

**Hexo 静态博客插件** — 构建时在页面注入 Live2D 看板娘：生成静态 vendor 脚本、import map，并在页脚挂载 Canvas + [
`@doki-land/live2d-widget`](https://www.npmjs.com/package/@doki-land/live2d-widget)。

作者只需改 `_config.yml`，无需手写 import 或打包配置。

## 安装

在 Hexo 站点根目录：

```bash
npm i hexo-plugin-live2d
# Hexo 会自动加载 node_modules 里 hexo-* 插件
```

## 配置（`_config.yml`）

```yaml
live2d:
  enable: true
  # 模型：URL 或 npm 包路径（推荐 npm，免上传 moc 资源）
  model: npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json

  width: 280
  height: 400
  target: "#doki-live2d"      # 挂载点选择器（插件会注入对应 DOM）
  className: doki-live2d

  prefer: [webgpu, webgl2, canvas2d]
  autoSway: true
  chrome: true                  # 气泡 + 简易工具栏

  loader: esm                   # 默认；见下方 loader 说明
  # scriptUrl: /custom/bootstrap.mjs   # 可选：覆盖 bootstrap URL
  # pluginRootPath: live2dw/           # 生成器输出目录前缀
```

主题 `_config.yml` 里同名字段会覆盖站点配置。

## Loader 模式

| `live2d.loader`   | 行为                                                                                          | 状态                       |
|-------------------|-----------------------------------------------------------------------------------------------|----------------------------|
| **`esm`**（默认） | 构建输出 `live2dw/vendor/*` + 薄 bootstrap `.mjs`；页面用 import map 加载 `@doki-land/live2d` | **推荐**                   |
| **`bundle`**      | 单体 IIFE `doki-live2d-hexo.js`（esbuild 打包完整 runtime）                                   | **已弃用**，下一大版本移除 |

`esm` 模式下 vendor 在 **`hexo generate` 时**由插件复制到站点输出目录，体积更小、与 npm 包版本对齐。`bundle` 仅用于暂时无法使用
import map 的旧环境。

## 构建产物（站点 `public/`）

```text
live2dw/
  vendor/              @doki-land/live2d、live2d-widget 等 ESM
  doki-live2d-hexo.bootstrap.mjs   入口（loader=esm）
  doki-live2d-hexo.js              仅 loader=bundle 时
```

**不要**把 `browser/vendor` 或 bootstrap 提交进 git；npm 发布包会在 CI 中构建这些文件。

## 模型来源示例

```yaml
# jsDelivr npm 包（默认 CDN）
model: npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json

# 站点内静态文件（需自己把 model3.json + moc + 纹理放到 source）
model: /models/my-char/my-char.model3.json
```

## 常见问题

**Q: 生成后页面没有角色？**  
检查 `live2d.enable`、`model` 是否非空，以及浏览器控制台是否有 404（vendor 路径与 `pluginRootPath`）。

**Q: 和 Vue 插件能一起用吗？**  
可以，但通常二选一：Hexo 用本插件，Vue SPA 用 `vue-plugin-live2d`。

**Q: WebGPU 在读者浏览器不可用？**  
`prefer` 会自动降级到 WebGL2 / Canvas2D，一般无需改配置。

## 依赖关系

```text
hexo-plugin-live2d
  ├── @doki-land/live2d
  └── @doki-land/live2d-widget
```

## 仓库

[github.com/doki-land/live2d.ts](https://github.com/doki-land/live2d.ts) · `projects/adaptors/hexo-plugin-live2d`

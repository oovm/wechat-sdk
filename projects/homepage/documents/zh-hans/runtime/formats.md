---
title: 模型格式
order: 2
---

# 模型格式

| 格式               | 状态                                                      |
|--------------------|-----------------------------------------------------------|
| **cpu-program**    | 明文 JSON，CPU 可画基线（Playground「本地 CPU program」） |
| **moc2** (`.moc`)  | 默认姿势 decode → `ModelProgram`；父级 deformer 链后续    |
| **moc3** (`.moc3`) | 校验头后明确报未实现；完整布局后续                        |

渲染后端与格式正交：同一 `ModelProgram` 可走 Canvas2D / WebGL2 / WebGPU。

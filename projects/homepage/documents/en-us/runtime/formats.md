---
title: Formats
order: 2
---

# Formats

| Format             | Status                                                       |
|--------------------|--------------------------------------------------------------|
| **cpu-program**    | Plaintext JSON CPU drawable baseline                         |
| **moc2** (`.moc`)  | Default-pose decode → `ModelProgram`; parent deformers later |
| **moc3** (`.moc3`) | Header check, then explicit not-implemented                  |

Renderer backends are orthogonal to format: one `ModelProgram` can present via Canvas2D / WebGL2 / WebGPU.

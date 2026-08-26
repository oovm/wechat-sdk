# @doki-land/live2d-renderer

Model execution and browser-native rendering backends for `live2d.ts`.

This package owns both MOC2/MOC3 runtime behavior and the WebGPU, WebGL2, and Canvas2D graphics implementations.
Applications should normally use these capabilities through `@doki-land/live2d`.

## ✨ Features

- Pure TypeScript MOC2 and MOC3 parsing paths.
- CPU model programs and deterministic frame evaluation.
- WebGPU rendering.
- WebGL2 rendering.
- Canvas2D compatibility rendering.
- Texture, blend mode, clipping, and mask-atlas support.
- Parameter bindings for inspectors and interactive hosts.
- Renderer initialization fallback.
- Structural and model-fixture tests.

## 🧭 Package Role

The source tree separates execution concerns:

```text
src/backends/  WebGPU, WebGL2, and Canvas2D graphics backends
src/moc/       MOC2/MOC3 decode, deformation, and ModelBackend implementations
src/cpu/       model program parsing and CPU frame evaluation
src/render/    blend modes, clipping, coords, preview styling
src/runtime/   renderer factory and model-runtime glue
src/format/    moc binary and settings format peek helpers
```

MOC2 and MOC3 are model formats, not graphics backends. WebGPU, WebGL2, and Canvas2D are graphics backends, not model
formats.

## 📦 Installation

```bash
pnpm add @doki-land/live2d-renderer
```

Install this package directly when building renderer tools, conformance tests, custom facades, or specialized host
pipelines.

## 🚀 Creating a Renderer

```ts
import {createRenderer} from "@doki-land/live2d-renderer";

const renderer = createRenderer({
    prefer: ["webgpu", "webgl2", "canvas2d"],
});

await renderer.initialize(canvas);
```

Fallback occurs during initialization. This matters because browser feature detection alone cannot prove that an
adapter, device, context, or required capability can be created.

## 🖼️ Backend Selection

### WebGPU

Preferred for modern browsers and explicit GPU resource management. A valid `navigator.gpu` object is not sufficient;
adapter and device creation can still fail.

### WebGL2

Primary GPU fallback with broad browser support. Shader compilation, framebuffer allocation, texture limits, and context
loss remain device-dependent.

### Canvas2D

Compatibility and diagnostic path using textured triangle approximation. It is useful for fallback rendering and
CPU-output inspection but is not expected to match GPU throughput for complex models.

## 🧠 Model Runtime

A `ModelBackend` is responsible for:

- determining whether it can handle normalized model settings;
- creating model state from settings and binary data;
- updating model time and parameters;
- producing drawable meshes or CPU frame snapshots;
- exposing parameter bindings;
- releasing model-owned state.

Model runtimes must not create their own application frame loop or DOM controls.

## 🎭 Rendering Semantics

The renderer preserves model-defined behavior including:

- drawable render order;
- opacity and visibility;
- normal, additive, and multiplicative blending where implemented;
- mask relationships;
- inverted masks;
- texture coordinates;
- model-space orientation.

Transparent drawables cannot be freely reordered across characters or masks merely to reduce state changes. Visual
correctness takes precedence over speculative batching.

## 🧭 Coordinate Contract

Model geometry uses a consistent model-space convention before reaching a graphics backend. Each backend is responsible
for exactly one conversion to its target coordinate system.

Do not fix orientation problems with CSS canvas transforms. CSS transforms also affect pointer mapping and can hide a
double conversion instead of correcting the model-to-renderer contract.

Orientation changes require a neutral fixture or pixel evidence across the affected backends.

## ⚡ Performance Engineering

Performance work should target measured costs:

- model-program and instance lifetime;
- per-frame allocations;
- parameter dirty tracking;
- affected deformer and drawable evaluation;
- dynamic vertex upload ranges;
- mask-pass reuse;
- texture and pipeline state changes;
- overdraw and canvas resolution;
- multi-character scaling.

WebAssembly, TypeScript, WebGPU, and WebGL2 are implementation tools, not benchmark results. Comparisons must use
equivalent visual output and report CPU, GPU, allocation, upload, and memory metrics.

## 🧪 Testing

```bash
pnpm --filter @doki-land/live2d-renderer typecheck
pnpm --filter @doki-land/live2d-renderer test
```

Renderer changes should add the smallest appropriate evidence:

- CPU golden snapshots for evaluation changes;
- structural assertions for format decoding;
- orientation tests for coordinate changes;
- mask and blend fixtures for compositing changes;
- pixel comparisons for graphics parity;
- browser checks for device-specific behavior.

Proprietary models must not be committed without redistribution permission.

## 🔌 Extending the Package

New model-format support belongs under `src/moc/`. New browser graphics implementations belong under `src/backends/`. Do
not create a separate published package for every MOC revision or GPU backend unless an independently useful public
contract justifies it.

## 🤝 Contributing

### Renderer expectations

- Keep hot paths allocation-aware.
- Preserve deterministic CPU behavior.
- Document the visual invariant behind renderer changes.
- Add structural, pixel, or browser evidence appropriate to the change.
- Rebuild generated bundles from source instead of editing them manually.

## 📄 License

### Clean-room rendering

- WGSL and GLSL shaders, graphics pipelines, mask and blend paths, model execution, Canvas2D mesh rendering, resource
  lifecycle, and GPU submission optimizations are independently designed and handwritten.
- No implementation is copied, translated, ported, derived from, or linked against an official renderer, Core binary,
  SDK wrapper, shader source, pipeline implementation, or internal API.
- External format names identify interoperability targets only.
- The maintainers and contributors are independent and are not employed by, affiliated with, sponsored by, endorsed by,
  or acting on behalf of the official Cubism SDK vendor.

### Contribution boundary

- Do not submit official SDK or shader source, disassembly-derived implementations, mechanically translated code, or
  dependencies on an official runtime.
- Support compatibility patches with a public format fact, neutral fixture, reproducible independent observation, or
  independently authored technical rationale.

### Terms

- Source code is dedicated to the public domain under **CC0 1.0 Universal** — see [`License.md`](../../License.md).
- Model assets used for local testing may have separate terms.

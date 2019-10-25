# @doki-land/live2d

The public runtime facade for browser-native Live2D rendering.

Use this package in browser games, game-engine integrations, interactive content, model tools, and custom webpage
experiences. It composes the default loader, MOC runtimes, and rendering backends behind one small API.

## ✨ Features

- One dependency for the standard runtime pipeline.
- Pure TypeScript model execution.
- WebGPU, WebGL2, and Canvas2D backend selection.
- Explicit game-loop integration through `update(deltaTime)`.
- Local URL, remote URL, and `npm:` model sources.
- Parameter inspection and mutation.
- Frame capture for diagnostics.
- Hit testing in normalized model coordinates.
- Progress, ready, error, phase, and frame-profile events.

## 📦 Installation

```bash
pnpm add @doki-land/live2d
```

The implementation packages are installed transitively. Most applications should not depend on them directly.

## 🧭 Source Layout

```text
src/facade/    createLive2D() — default stage + single actor
src/motion/    motion3 parse, curves, MotionPlayer
src/stage/     Live2dStage, actors, asset registry, transforms
src/reexports/ optional subpath exports for core / loader / renderer
```

## 🚀 Quick Start

```ts
import {createLive2D} from "@doki-land/live2d";

const canvas = document.querySelector<HTMLCanvasElement>("#live2d");

if (!canvas) {
    throw new Error("Missing Live2D canvas");
}

const runtime = createLive2D({
    prefer: ["webgpu", "webgl2", "canvas2d"],
});

runtime.mount(canvas);
await runtime.loadModel("/models/character.model3.json");

let previous = performance.now();

function frame(now: number) {
    runtime.update((now - previous) / 1000);
    previous = now;
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

## 🎮 Game Loop

The runtime does not require ownership of `requestAnimationFrame`. Drive it from an existing engine scheduler:

```ts
engine.onUpdate((deltaTime) => {
    runtime.update(deltaTime);
});
```

The delta is expressed in seconds. Keep the value bounded after tab suspension or long pauses to avoid unstable
animation and physics once those systems are enabled.

## 📥 Loading Models

```ts
await runtime.loadModel("/models/actor.model3.json");

await runtime.loadModel(
    "https://cdn.example.com/models/actor.model3.json",
);

await runtime.loadModel(
    "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
);
```

Listen for progress when presenting a loading interface:

```ts
runtime.events.on("progress", ({stage, progress, detail}) => {
    console.log(stage, Math.round(progress * 100), detail);
});
```

Remote servers must allow cross-origin access to settings, model binaries, and textures.

## 🎛️ Parameters

```ts
runtime.setParameter("PARAM_ANGLE_X", 15);

const angleX = runtime
    .listParameters()
    .find((parameter) => parameter.id === "PARAM_ANGLE_X");

console.log(angleX);
```

Parameter availability and ranges belong to the loaded model. Do not assume every model implements the same IDs.

## 🖱️ Hit Testing

`hitTest(x, y)` expects **normalized model coordinates** (approximately `-1..1` on both axes). The single-actor facade returns a string area id; Stage APIs return structured `ActorHit`.

```ts
const area = runtime.hitTest(modelX, modelY);

if (area) {
    console.log("Hit", area);
}
```

### Current contract (`drawable:N` fallback)

1. The runtime finds the front-most visible drawable triangle under the point.
2. It then looks up `model.settings.hitAreas` for an entry whose `id` is exactly `D_{drawableIndex}` or `"{drawableIndex}"`.
3. If that lookup succeeds, the returned string is the HitArea **name** (e.g. `Head`).
4. Otherwise the string is **`drawable:{index}`** (example: `drawable:12`).

Many Cubism sample settings use ids such as `HitArea` / `HitArea2` that **do not** match step 2, so dogfood models usually surface `drawable:N`. That is expected until a named HitArea mapping lands (planned after v0.0.21). Do not treat `drawable:N` as a stable product name for UI chrome.

Stage `hitTest` / `hitTestAll` populate `ActorHit.area` with the same string; `drawableIndex` is set when `area` matches `/^drawable:(\d+)$/`.

## 📊 Frame Profiling

```ts
runtime.events.on("profile", (profile) => {
    console.log({
        fps: profile.fpsSmooth,
        frameMs: profile.frameMs,
        evaluateMs: profile.evaluateMs,
        drawMs: profile.drawMs,
        drawables: profile.drawableCount,
    });
});
```

These timings are runtime-side measurements. Use browser GPU profiling when diagnosing shader, mask, upload, or device
scheduling costs.

## 🧩 Custom Pipeline

Advanced applications can provide a renderer or model backends:

```ts
const runtime = createLive2D({
    renderer: customRenderer,
    backends: [customBackend],
});
```

Custom implementations must preserve the contracts exported by the renderer package. Avoid moving format or renderer
logic into application adapters.

## 🧹 Lifecycle

```ts
runtime.destroy();
```

Destroy the runtime when its canvas or host scene is permanently removed. This releases model state, textures, draw
passes, event listeners owned by the runtime, and graphics resources owned by the selected renderer.

## ⚡ Performance Notes

- Reuse one runtime for repeated updates instead of recreating it per frame.
- Keep canvas backing dimensions intentional; CSS size alone does not limit GPU pixel work.
- Prefer an engine-owned loop when integrating with a game.
- Avoid repeatedly enumerating parameters in a hot loop.
- Measure the complete frame path before attributing a bottleneck to TypeScript, WebAssembly, or a specific graphics
  API.

## 🧪 Development

From the workspace root:

```bash
pnpm typecheck
pnpm --filter @doki-land/live2d build
```

Changes to the facade should include tests for state transitions, cancellation, events, and resource cleanup where
applicable.

## 🤝 Contributing

### Package ownership

- Keep the facade small and host-independent.
- Put model-format behavior in `@doki-land/live2d-renderer`.
- Put source resolution in `@doki-land/live2d-loader`.
- Put webpage chrome in `@doki-land/live2d-widget`.
- Include tests for state transitions, cancellation, events, and resource cleanup where applicable.

## 📄 License

### Implementation independence

- This package composes an independently developed clean-room runtime.
- It does not load, link against, wrap, translate, port, or derive its implementation from an official Cubism SDK or
  Core binary.
- Compatible model support is an interoperability goal, not evidence of a shared implementation, endorsement,
  affiliation, sponsorship, or employment relationship.
- The project and its contributors are independent and do not act on behalf of the official Cubism SDK vendor.

### Contribution boundary

- Do not submit official SDK or shader source, disassembly-derived code, mechanically translated implementation code, or
  changes that require an official runtime.
- Support compatibility-sensitive work with public format facts, neutral fixtures, reproducible independent
  observations, or independently authored technical rationale.

### Terms

- See the repository license for source-code terms.
- Model and artwork licenses are separate from the runtime license.

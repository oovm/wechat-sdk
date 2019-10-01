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

## 🚀 Quick Start

```ts
import { createLive2D } from "@doki-land/live2d";

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

`hitTest(x, y)` expects normalized model coordinates where both axes are approximately in the `-1..1` range:

```ts
const area = runtime.hitTest(modelX, modelY);

if (area) {
  console.log("Hit", area);
}
```

Current fallback hit testing can identify visible drawables. Semantic names such as `Head` or `Body` require
corresponding model metadata and runtime support.

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

Keep the facade small. Model-format behavior belongs in `@doki-land/live2d-renderer`, source resolution belongs in
`@doki-land/live2d-loader`, and webpage chrome belongs in `@doki-land/live2d-widget`.

## 📄 License

See the repository license. Model and artwork licenses are separate from the runtime license.

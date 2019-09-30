# live2d.ts

A browser-native Live2D runtime written in TypeScript for game engines, browser games, interactive content, and blog
engines.

`live2d.ts` provides a focused model runtime instead of wrapping a general-purpose scene graph. It owns model loading,
CPU evaluation, rendering, interaction, and host integration while keeping the public entry point small.

> [!IMPORTANT]
> The project does not load the official obfuscated Live2D runtime. Model execution is implemented in readable
TypeScript and rendered through browser-native graphics APIs.

## ✨ Highlights

- Pure TypeScript runtime with no native addon requirement.
- WebGPU-first rendering with WebGL2 and Canvas2D fallback paths.
- No dependency on Pixi, Three.js, D3, or another scene graph.
- Explicit frame control for game-engine schedulers and browser games.
- MOC2 and MOC3 model paths contained in the renderer package.
- URL, static asset, CDN, and `npm:` model resolution.
- Pointer tracking, parameter inspection, and drawable hit testing.
- Optional webpage widget for blog and documentation sites.
- Hexo integration with generated browser assets and configuration passthrough.
- Lazy resource loading for H5 games and constrained hosts.

## 🎮 Game Engine Integration

The runtime can be driven by an existing game loop. It does not require ownership of `requestAnimationFrame`:

```ts
import {createLive2D} from "@doki-land/live2d";

const live2d = createLive2D({
    prefer: ["webgpu", "webgl2", "canvas2d"],
});

live2d.mount(gameCanvas);
await live2d.loadModel("/models/character.model3.json");

game.onUpdate((deltaTime) => {
    live2d.update(deltaTime);
});
```

This makes the runtime suitable for:

- browser game engines;
- H5 and lightweight game hosts;
- dialogue and visual-novel systems;
- character interfaces and interactive HUDs;
- game-engine tools and model previews;
- static deployments that already own a canvas lifecycle.

The public runtime remains independent of a particular UI framework or application shell.

## 📝 Blog Engine Integration

Blog integrations are built as thin host adapters over the same runtime:

```text
Blog engine
  -> host configuration and static asset injection
  -> @doki-land/live2d-widget
  -> @doki-land/live2d
  -> browser-native renderer
```

The included Hexo plugin provides the first supported blog-engine integration. It can mount a site-wide character, emit
the browser bundle, pass renderer preferences, and enable the optional speech bubble and toolbar.

Blog-specific behavior such as welcome messages, page events, screenshots, Hitokoto, and close controls belongs to the
widget package. Model decoding and rendering remain in the runtime and are not duplicated by the Hexo adapter.

## 📦 Packages

| Package                      | Responsibility                                                                                    |
|------------------------------|---------------------------------------------------------------------------------------------------|
| `@doki-land/live2d`          | Public facade for loading, updating, rendering, interacting with, and inspecting a model session. |
| `@doki-land/live2d-core`     | Runtime contracts, model types, frame data, events, and session state.                            |
| `@doki-land/live2d-loader`   | Model source resolution, settings normalization, fetching, and progress reporting.                |
| `@doki-land/live2d-renderer` | MOC2/MOC3 execution plus WebGPU, WebGL2, and Canvas2D rendering.                                  |
| `@doki-land/live2d-widget`   | Optional webpage character shell with messages and toolbar behavior.                              |
| `vue-plugin-live2d`          | Compatibility component for existing Vue applications. It is not a separate runtime.              |
| `hexo-plugin-live2d`         | Hexo configuration, browser asset emission, and widget bootstrap.                                 |

Applications normally depend only on `@doki-land/live2d`. Install implementation packages directly only when building
custom tooling or replacing part of the default pipeline.

## 🚀 Quick Start

```bash
pnpm add @doki-land/live2d
```

```html

<canvas id="actor" width="640" height="640"></canvas>
```

```ts
import {createLive2D} from "@doki-land/live2d";

const canvas = document.querySelector<HTMLCanvasElement>("#actor");

if (!canvas) {
    throw new Error("Missing #actor canvas");
}

const actor = createLive2D();
actor.mount(canvas);
await actor.loadModel("/models/character.model3.json");

let previous = performance.now();

function frame(now: number) {
    const deltaTime = (now - previous) / 1000;
    previous = now;
    actor.update(deltaTime);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

## 🖱️ Interaction

Parameters can be driven by gameplay, dialogue, pointer input, or developer tools:

```ts
actor.setParameter("PARAM_ANGLE_X", 12);

for (const parameter of actor.listParameters()) {
    console.log(parameter.id, parameter.value, parameter.min, parameter.max);
}
```

Canvas coordinates can be converted to normalized model coordinates for hit testing:

```ts
canvas.addEventListener("pointerdown", (event) => {
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
    const area = actor.hitTest(x, y);

    if (area) {
        console.log("Hit", area);
    }
});
```

Drawable-level hit testing is available today. Named semantic hit areas should only be assumed when the loaded format
and model expose them.

## 🧱 Architecture

The runtime follows a one-way data path:

```text
Model source
  -> settings and binary assets
  -> TypeScript model evaluation
  -> drawable frame data
  -> WebGPU / WebGL2 / Canvas2D
  -> browser canvas
```

Package boundaries are intentional:

- Core contracts do not depend on a game engine, blog engine, or UI framework.
- The loader does not render or evaluate models.
- The renderer owns format-specific execution and graphics backends.
- The facade composes the default pipeline.
- Widgets and host adapters depend on the facade, never the reverse.

## 🖼️ Rendering Backends

The default preference order is:

```text
WebGPU -> WebGL2 -> Canvas2D
```

Fallback is resolved during renderer initialization. A browser that exposes an API but cannot initialize a usable device
can continue to the next backend.

Canvas2D is a compatibility and diagnostic path. It should not be treated as performance-equivalent to GPU rendering for
complex models.

## 📥 Model Sources

Load models from local or remote URLs:

```ts
await actor.loadModel("/models/character.model3.json");
await actor.loadModel("https://cdn.example.com/models/actor.model3.json");
```

The loader also supports npm-oriented model references:

```ts
await actor.loadModel(
    "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
);
```

Remote loading is subject to the target server's CORS policy. Pin package versions for reproducible deployments.

## ⚡ Performance

The runtime is designed around browser-native rendering, typed numeric data, reusable graphics resources, and explicit
frame control. These choices make it possible to optimize the complete CPU-to-GPU path without routing model data
through a general-purpose scene graph.

Performance claims must be supported by reproducible benchmarks. Language choice alone does not prove that one runtime
is faster than another.

Meaningful comparisons should use the same model, motion, viewport, device-pixel ratio, browser, and visual output while
reporting:

- CPU evaluation time, including P95 and P99;
- GPU frame time;
- JavaScript allocation and garbage collection;
- draw calls and mask passes;
- uploaded buffer bytes;
- startup time and peak memory;
- one-character and multi-character scaling.

## 🌐 Browser Support

Backend availability depends on the browser and device:

- WebGPU is preferred when a usable adapter and device are available.
- WebGL2 is the primary GPU fallback.
- Canvas2D provides a software-oriented compatibility path.

Applications should test their selected models on the browsers and GPUs they intend to support. API availability alone
does not guarantee identical image output or performance.

## 🧪 Development

Install workspace dependencies:

```bash
pnpm install
```

Run type checking and renderer tests:

```bash
pnpm typecheck
pnpm --filter @doki-land/live2d-renderer test
```

Run the homepage and playground using the scripts declared by the homepage package.

## ✅ Compatibility Policy

Model behavior is validated through explicit fixtures and browser rendering checks. Support should be described by
tested capabilities rather than by file extension alone.

When reporting a model issue, include:

- model settings format and binary version;
- selected rendering backend;
- browser and operating-system versions;
- a minimal redistributable fixture when licensing permits;
- screenshots or frame captures showing expected and actual output.

Do not include proprietary model assets in public issues without permission.

## 🤝 Contributing

Contributions should preserve package ownership and include tests proportional to the change.

- Runtime behavior belongs in the facade, core, loader, or renderer rather than a host adapter.
- Format fixes should include a minimal neutral fixture or reproducible model case.
- Rendering fixes should include structural assertions or pixel evidence where practical.
- Public APIs should remain small and host-independent.
- Generated bundles should be rebuilt from source instead of edited manually.

## 🔒 Security

Treat remote model URLs as untrusted input. Applications should restrict allowed origins, validate response sizes, apply
a suitable content-security policy, and avoid exposing privileged tokens through asset requests.

Report security-sensitive issues privately to the maintainers rather than publishing exploit details in a public issue.

## 📄 License

See the repository license for source-code terms. Model files, textures, motions, expressions, audio, and character
artwork may have separate licenses and are not automatically covered by the runtime license.

# live2d.ts

A browser-native Live2D runtime written in TypeScript for game engines, browser games, interactive content, and blog
engines.

`live2d.ts` provides a focused model runtime instead of wrapping a general-purpose scene graph. It owns model loading,
CPU evaluation, rendering, interaction, and host integration while keeping the public entry point small.

## ? Highlights

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

## ?? Game Engine Integration

The runtime can be driven by an existing game loop. It does not require ownership of `requestAnimationFrame`:

```ts
import {createLive2d} from "@doki-land/live2d";

const live2d = createLive2d({
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

## ?? Blog Engine Integration

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

## ?? Packages

| Package                      | Responsibility                                                                                    |
|------------------------------|---------------------------------------------------------------------------------------------------|
| `@doki-land/live2d`          | Public facade for loading, updating, rendering, interacting with, and inspecting a model session. |
| `@doki-land/live2d-core`     | Runtime contracts, model types, frame data, events, and session state.                            |
| `@doki-land/live2d-loader`   | Model source resolution, settings normalization, fetching, and progress reporting.                |
| `@doki-land/live2d-renderer` | MOC2/MOC3 execution plus WebGPU, WebGL2, and Canvas2D rendering.                                  |
| `@doki-land/live2d-widget`   | Optional webpage character shell with messages and toolbar behavior.                              |
| `@doki-land/live2d-element`  | Official `<live-2d>` / `<live-2d-widget>` Custom Elements (Stage-owned RAF).                      |
| `vue-plugin-live2d`          | Thin Vue wrapper over `<live-2d>` for existing Vue apps (not a separate runtime).                 |
| `hexo-plugin-live2d`         | Hexo configuration, browser asset emission, and widget bootstrap.                                 |

Applications normally depend only on `@doki-land/live2d`. Install implementation packages directly only when building
custom tooling or replacing part of the default pipeline.

## ?? Quick Start

```bash
pnpm add @doki-land/live2d
```

```html

<canvas id="actor" width="640" height="640"></canvas>
```

```ts
import {createLive2d} from "@doki-land/live2d";

const canvas = document.querySelector<HTMLCanvasElement>("#actor");

if (!canvas) {
    throw new Error("Missing #actor canvas");
}

const actor = createLive2d();
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

## ??? Interaction

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

## ?? Architecture

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

## ??? Rendering Backends

The default preference order is:

```text
WebGPU -> WebGL2 -> Canvas2D
```

Fallback is resolved during renderer initialization. A browser that exposes an API but cannot initialize a usable device
can continue to the next backend.

Canvas2D is a compatibility and diagnostic path. It should not be treated as performance-equivalent to GPU rendering for
complex models.

## ?? Model Sources

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

## ? Performance

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

## ?? Browser Support

Backend availability depends on the browser and device:

- WebGPU is preferred when a usable adapter and device are available.
- WebGL2 is the primary GPU fallback.
- Canvas2D provides a software-oriented compatibility path.

Applications should test their selected models on the browsers and GPUs they intend to support. API availability alone
does not guarantee identical image output or performance.

## ?? Development

Install workspace dependencies:

```bash
pnpm install
```

Local gate (Biome + typecheck + tests + builds + homepage??

```bash
pnpm verify
```

`pnpm verify` includes `hexo-plugin-live2d` unit tests (plugin logic only). Hexo site / ESM inject acceptance lives in sibling `hexo-theme-fate` (`npm run build && npm run verify:live2d`).

Real npm semver releases are **only** via GitHub Actions Trusted Publisher?push tag `vX.Y.Z` ? `.github/workflows/publish-npm.yml` (OIDC). Do not `npm publish` real versions locally.

Run type checking and renderer tests:

```bash
pnpm typecheck
pnpm --filter @doki-land/live2d-renderer test
```

Run the homepage and playground using the scripts declared by the homepage package.

## ? Compatibility Policy

Model behavior is validated through explicit fixtures and browser rendering checks. Support should be described by
tested capabilities rather than by file extension alone.

When reporting a model issue, include:

- model settings format and binary version;
- selected rendering backend;
- browser and operating-system versions;
- a minimal redistributable fixture when licensing permits;
- screenshots or frame captures showing expected and actual output.

Do not include proprietary model assets in public issues without permission.

## Developer Preview

**Current band: `0.0.x` (Developer Preview).** APIs and architecture may change between tags. The next maturity gate is **`0.1.0`** (compatibility matrix, full browser acceptance, Vue-to-CE completion, Hexo default CE, bundle retirement). Do not describe `0.0.x` as production-ready or claim performance superiority over the official SDK without the benchmark evidence pack in design `03` ?.

Cross-ecosystem integration should prefer **`@doki-land/live2d-element`** (`<live-2d>`) or the pure TS `createLive2d()` API. Game engines and schedulers that already own a canvas should use the TS facade directly.

## ?? Security

Treat remote model URLs as untrusted input. Applications should restrict allowed origins, validate response sizes, apply
a suitable content-security policy, and avoid exposing privileged tokens through asset requests.

Report security-sensitive issues privately to the maintainers rather than publishing exploit details in a public issue.

## ?? Contributing

### Engineering expectations

- Preserve package ownership: runtime behavior belongs in the facade, core, loader, or renderer rather than a host
  adapter.
- Include tests proportional to the change.
- Accompany format fixes with a minimal neutral fixture or reproducible model case.
- Accompany rendering fixes with structural assertions or pixel evidence where practical.
- Keep public APIs small and host-independent.
- Rebuild generated bundles from source instead of editing them manually.

## ?? License

### Clean-room implementation

- Shaders, graphics pipelines, model-execution code, mask and blend paths, and renderer optimizations are independently
  designed and handwritten.
- No implementation is copied, translated, ported, derived from, or linked against an official Cubism SDK
  implementation.
- The project does not load or bundle an official Cubism Core binary or call an official Cubism SDK at build time or
  runtime.
- Format compatibility and descriptive format names identify interoperability targets only; they do not imply shared
  code, implementation lineage, partnership, endorsement, affiliation, sponsorship, or employment.
- The project and its contributors are independent and do not act on behalf of the official Cubism SDK vendor.

### Contribution boundary

- Do not submit official SDK or shader source, disassembly-derived code, mechanically translated implementation code, or
  changes that require an official runtime.
- Support compatibility-sensitive work with public format facts, neutral fixtures, reproducible independent
  observations, or independently authored technical rationale.

### Source and asset terms

- See the repository license for source-code terms.
- Model files, textures, motions, expressions, audio, and character artwork may have separate licenses and are not
  automatically covered by the runtime license.

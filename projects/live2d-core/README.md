# @doki-land/live2d-core

Framework-independent contracts and data structures for the `live2d.ts` runtime.

This is an implementation package. Application developers should normally install `@doki-land/live2d` instead.

## 🧭 Package Role

The core package defines the shared language used by loaders, model runtimes, renderers, and the public facade:

- model sources and normalized settings;
- session phases and state;
- runtime events and progress payloads;
- model programs and instances;
- frame snapshots and drawable data;
- asset resolver contracts;
- format detection shared across packages.

It does not fetch network resources, decode MOC binaries, create a canvas, or issue GPU commands.

## 📦 Installation

```bash
pnpm add @doki-land/live2d-core
```

Install this package directly only when implementing a compatible loader, renderer, diagnostic tool, or host
integration.

## 🧱 Design Principles

- Contracts remain independent of game engines, blog engines, and UI frameworks.
- Graphics API types do not leak into model and session contracts.
- Model-format parsing does not belong in core.
- Public data uses explicit typed structures rather than hidden runtime globals.
- Events remain small enough for browsers and lightweight hosts.

## 🧩 Core Contracts

The package exposes types such as:

```ts
import type {
    AssetResolver,
    FrameSnapshot,
    Live2dSession,
    ModelSettings,
    ModelSource,
} from "@doki-land/live2d-core";
```

An asset resolver provides model-related resources without prescribing HTTP, file-system, CDN, or package-registry
behavior:

```ts
const resolver: AssetResolver = {
    async fetchJson(url) {
        const response = await fetch(url);
        return response.json();
    },
    async fetchBytes(url) {
        const response = await fetch(url);
        return response.arrayBuffer();
    },
};
```

Use the exact exported interface as the source of truth; the example illustrates the ownership boundary rather than
guaranteeing every method name across versions.

## 🔄 Session Lifecycle

A runtime session moves through explicit phases rather than relying on DOM state:

```text
idle -> mounting -> ready -> loading -> live
                               \-> error
```

Consumers should listen to phase and error events instead of inferring readiness from a non-null canvas or model
reference.

## 📸 Frame Data

`FrameSnapshot` represents evaluated CPU-side model output. It is useful for:

- renderer input;
- deterministic fixtures;
- diagnostic capture;
- regression fingerprints;
- model inspection tools.

Frame data must not contain host-specific UI state or require a renderer to reload source assets.

## 🧪 Development

```bash
pnpm --filter @doki-land/live2d-core typecheck
pnpm --filter @doki-land/live2d-core test
```

Contract changes should include compatibility notes in the change itself and update all workspace consumers in the same
change set.

## 🤝 Contributing

Avoid adding convenience APIs that belong to the facade. A core abstraction should be shared by at least two
implementation layers and remain meaningful without a browser UI framework.

## 📄 License

See the repository license.

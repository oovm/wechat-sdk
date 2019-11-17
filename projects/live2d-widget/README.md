# @doki-land/live2d-widget

An optional webpage character shell built on `@doki-land/live2d`.

The widget package is intended for blogs, documentation sites, personal sites, and other pages that want a floating or
embedded character with messages and controls. It is not a second model runtime and it is not required by game-engine
integrations.

## ✨ Features

- Mount a character into an existing element.
- Optional browser-driven animation loop.
- Pointer tracking and click feedback.
- Speech bubble with priority and timeout handling.
- Welcome messages and page-event messages.
- Hitokoto toolbar action.
- Canvas screenshot download.
- Hide/quit action.

## 🧭 Package Role

```text
Webpage behavior and controls
  -> @doki-land/live2d-widget
  -> @doki-land/live2d
  -> model runtime and renderer
```

The widget owns webpage presentation such as tips and toolbar actions. Model parsing, parameter evaluation, graphics
backends, and resource semantics belong to `@doki-land/live2d` and its implementation packages.

**Widget does not bootstrap models.** Create a `Live2dStage` + `Live2dActor` (or use `<live-2d>` / framework adaptors),
load the model, then pass `stage` and `actor` to `createLive2dWidget`.

## 📦 Installation

```bash
pnpm add @doki-land/live2d-widget
```

## 🚀 Quick Start

```html
<div id="live2d-widget"></div>
```

```ts
import { createLive2d } from "@doki-land/live2d";
import { createLive2dWidget } from "@doki-land/live2d-widget";

const runtime = createLive2d({ updateMode: "auto" });
await runtime.loadModel("/models/character.model3.json");

const widget = await createLive2dWidget({
    target: "#live2d-widget",
    stage: runtime.stage,
    actor: runtime.actor,
    width: 280,
    height: 400,
    autoSway: true,
    chrome: true,
});
```

The widget mounts the stage onto its own canvas. Destroy both when the host is permanently removed:

```ts
widget.destroy();
runtime.destroy();
```

## 💬 Messages

```ts
widget.showMessage("Welcome back.");

widget.showMessage(
    ["Hello.", "Nice to see you again."],
    5000,
    4,
);
```

Higher-priority messages can temporarily prevent lower-priority page events from replacing important feedback.

## 🧰 Toolbar

Enable default controls:

```ts
const widget = await createLive2dWidget({
    target: host,
    stage,
    actor,
    chrome: true,
});
```

Or configure them explicitly:

```ts
const widget = await createLive2dWidget({
    target: host,
    stage,
    actor,
    chrome: {
        tips: true,
        welcome: ["Welcome to the site."],
        tools: ["hitokoto", "photo", "quit"],
        hitokotoApi: "https://v1.hitokoto.cn",
    },
});
```

The Hitokoto action performs a network request. Sites with strict privacy or content-security requirements should
disable it or provide an approved endpoint.

## 🖱️ Interaction

```ts
await createLive2dWidget({
    target: host,
    stage,
    actor,
    onHit({ area, x, y }) {
        console.log(area, x, y);
    },
});
```

Pointer tracking drives supported focus parameters. Exact visible behavior depends on the parameter definitions and
deformation data in the loaded model.

## 📝 Blog Engines

Blog-engine adaptors should use `<live-2d>` / `<live-2d-widget>` (see `@doki-land/live2d-element`) or compose
`createLive2d` + `createLive2dWidget` — they must not copy model decoding, rendering, pointer math, or message behavior
into the adapter.

Hexo / Hugo inject plugins ship from **hexo-theme-yuki** / **hugo-theme-yuki**, not this repo.

## 🎮 Game Engines

Game engines should normally use `@doki-land/live2d` directly. The widget creates webpage chrome and may own a browser
animation loop, which is usually inappropriate when an engine already controls its canvas, scheduler, input system, and
scene lifecycle.

## 🔒 Privacy and Security

- Remote models and Hitokoto endpoints are network dependencies.
- Screenshot export may fail when textures make the canvas origin-unclean.
- Apply a content-security policy appropriate for model, texture, and API origins.
- Do not forward authentication credentials to arbitrary user-provided URLs.
- Provide a network-free configuration for privacy-sensitive sites.

## 🧪 Development

```bash
pnpm --filter @doki-land/live2d-widget typecheck
pnpm --filter @doki-land/live2d-widget test
```

Widget changes should test listener cleanup, repeated mount/destroy behavior, message priority, toolbar actions, and
hosts without optional browser capabilities.

## 🤝 Contributing

Keep this package focused on webpage character behavior. Runtime and renderer changes belong in their owning packages.

## 📄 License

Source code is dedicated to the public domain under **CC0 1.0 Universal** — see [`License.md`](../../License.md). Character models and message-service content may have separate terms.

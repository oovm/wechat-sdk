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
- Renderer fallback configuration passed to the runtime.

## 🧭 Package Role

```text
Webpage behavior and controls
  -> @doki-land/live2d-widget
  -> @doki-land/live2d
  -> model runtime and renderer
```

The widget owns webpage presentation such as tips and toolbar actions. Model parsing, parameter evaluation, graphics
backends, and resource semantics belong to `@doki-land/live2d` and its implementation packages.

## 📦 Installation

```bash
pnpm add @doki-land/live2d-widget
```

## 🚀 Quick Start

```html

<div id="live2d-widget"></div>
```

```ts
import {mountWidget} from "@doki-land/live2d-widget";

const widget = await mountWidget({
    target: "#live2d-widget",
    model: "/models/character.model3.json",
    width: 280,
    height: 400,
    prefer: ["webgpu", "webgl2", "canvas2d"],
    autoSway: true,
    chrome: true,
});
```

Destroy the widget when its host is permanently removed:

```ts
widget.destroy();
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
const widget = await mountWidget({
    target: host,
    model,
    chrome: true,
});
```

Or configure them explicitly:

```ts
const widget = await mountWidget({
    target: host,
    model,
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
await mountWidget({
    target: host,
    model,
    onHit({area, x, y}) {
        console.log(area, x, y);
    },
});
```

Pointer tracking drives supported focus parameters. Exact visible behavior depends on the parameter definitions and
deformation data in the loaded model.

## 📝 Blog Engines

The package is suitable as the shared browser layer for blog-engine adapters. An adapter should only:

- read host configuration;
- emit or copy browser assets;
- create the target element;
- pass options to the widget;
- integrate with the host's navigation lifecycle.

It should not copy model decoding, rendering, pointer math, or message behavior into the adapter.

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

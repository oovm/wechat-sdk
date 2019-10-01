# @doki-land/live2d-loader

Source resolution and asset loading for the `live2d.ts` runtime.

This is an implementation package. Most applications should load models through `@doki-land/live2d`.

## ✨ Features

- Local and remote model settings URLs.
- `npm:` model references resolved through a configurable CDN base.
- Model settings normalization for supported formats.
- Relative model, texture, and resource URL resolution.
- Byte and JSON fetching.
- Structured loading progress.
- Injectable asset resolvers for custom hosts.

## 📦 Installation

```bash
pnpm add @doki-land/live2d-loader
```

## 🚀 Source Resolution

```ts
import { resolveModelSourceUrl } from "@doki-land/live2d-loader";

const url = resolveModelSourceUrl(
  "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
);

console.log(url);
```

Pin package versions in production so a remote registry or CDN cannot silently change the selected model assets.

## 🌐 Remote Assets

Remote models usually include several requests:

```text
model settings
  -> MOC binary
  -> textures
  -> optional motions, expressions, physics, pose, and audio
```

Every referenced resource must be reachable under the browser's CORS and content-security policies. A settings file
being accessible does not guarantee that its textures or binary assets are accessible.

## 🔌 Custom Hosts

Game engines and constrained hosts can provide a custom `AssetResolver` instead of teaching the loader about every file
system or package container.

Appropriate custom resolvers include:

- game-engine asset databases;
- hashed build manifests;
- mini-game package APIs;
- service-worker caches;
- authenticated asset gateways;
- offline bundles.

Host adapters should translate their resource system into the shared resolver contract. They should not duplicate model
settings normalization or MOC parsing.

## 📈 Progress Reporting

Loading progress is divided into meaningful stages such as settings, binary data, decode, and textures. Consumers should
display the stage and normalized progress rather than guessing progress from the number of completed `fetch` calls.

Byte totals may be unavailable when a server omits `Content-Length` or streams encoded content. Interfaces must tolerate
an unknown total.

## 🔒 Security

Remote model settings are untrusted input. Hosts should consider:

- allowed schemes and origins;
- maximum response sizes;
- request timeouts and cancellation;
- redirects;
- MIME validation;
- decompression and texture size limits;
- credential forwarding;
- content-security policy.

Do not attach privileged credentials to arbitrary model URLs.

## 🧪 Development

```bash
pnpm --filter @doki-land/live2d-loader typecheck
pnpm --filter @doki-land/live2d-loader test
```

Resolution changes should include cases for scoped packages, explicit versions, nested paths, malformed specifiers,
relative URLs, and query/hash preservation where supported.

## 🤝 Contributing

Keep loading separate from model evaluation and rendering. New source schemes should have a clear deployment use case
and deterministic resolution rules.

## 📄 License

See the repository license.

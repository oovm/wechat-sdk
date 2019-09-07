# live2d.ts

```ts
import {createLive2D} from "@doki-land/live2d";
```

| Package                                                            | Role                               |
|--------------------------------------------------------------------|------------------------------------|
| [`@doki-land/live2d`](./projects/live2d)                           | Facade                             |
| [`@doki-land/live2d-core`](./projects/live2d-core)                 | Types, events, session             |
| [`@doki-land/live2d-loader`](./projects/live2d-loader)             | Model JSON / assets                |
| [`@doki-land/live2d-renderer`](./projects/live2d-renderer)         | GPU/Canvas backends + moc backends |
| [`@doki-land/live2d-widget`](./projects/live2d-widget)             | Canvas widget shell                |
| [`vue-plugin-live2d`](./projects/adaptors/vue-plugin-live2d)   | Live2D → Vue adaptor               |
| [`hexo-plugin-live2d`](./projects/adaptors/hexo-plugin-live2d) | Live2D → Hexo adaptor              |
| [`homepage`](./projects/homepage)                                  | Acceptance page                    |

```bash
pnpm install
pnpm test
pnpm dev:homepage
# open http://localhost:5173/playground
```

Homepage can load models from the hand-edited catalog
[`projects/homepage/public/models/catalog.json`](./projects/homepage/public/models/catalog.json):

- `local: true` — synced/tested offline (CI corpus); optional `sample` / `npm` / `fixture`
- `local: false` — gallery/Playground CDN entries (not required in CI)
- `name: { "en-us": "…", "zh-cn": "…" }` — display names (contributors localize here)
- `tags: ["moc3", …]` + top-level `tags` label map — gallery filters
- Preview PNGs under `/models/previews/{id}.png` are generated **locally**
  (`pnpm --filter @doki-land/live2d-homepage generate:previews`), never in CI
- Gallery favorites are stored in `localStorage` (browser-only)

Also:

- local samples under `/models/samples/…`
- mirrored npm package assets under `/models/npm/…`
- remote `https://…` model JSON
- `npm:package[@version]/path/to/model.json` (jsDelivr)

Gallery: `/gallery` · Stage: `/stage` · Playground: `/playground?preset=<id>`

## Publish (0.0.0 placeholders)

```bash
pnpm publish:packages          # dry-run (default)
pnpm publish:packages:yes      # real npm publish
# 2FA:
node scripts/publish-packages.mjs --yes --otp=123456
```

Publishes `@doki-land/live2d{,-core,-loader,-renderer,-widget}` plus
`vue-plugin-live2d` / `hexo-plugin-live2d` / `cocos-plugin-live2d` at `0.0.0`
(skips versions already on the registry). Homepage stays private.

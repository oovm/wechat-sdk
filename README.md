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

Homepage can load:

- local samples under `/models/samples/…`
- mirrored npm package assets under `/models/npm/…`
- remote `https://…` model JSON
- `npm:package[@version]/path/to/model.json` (jsDelivr)

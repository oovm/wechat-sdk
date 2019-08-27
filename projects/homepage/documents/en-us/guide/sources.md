---
title: Model sources
order: 2
---

# Model sources

`ModelSource` accepts three entry shapes; resolution goes through `@doki-land/live2d-loader`.

## Local / site paths

Paths relative to the site root, e.g. samples synced into homepage:

```ts
await runtime.loadModel("/models/quad/quad.model3.json");
```

## Remote URL

Any CORS-reachable `https://…/model3.json` or moc2 `model.json`.

## npm packages

```text
npm:package[@version]/path/to/model.json
```

Fetched via jsDelivr by default; Playground npm mode builds this specifier.

# react-plugin-live2d

Thin React wrapper over the official `<live-2d>` Custom Element from
`@doki-land/live2d-element`.

> Shared runtime behavior lives in CE / Stage / Actor — not in this package.

## Installation

```bash
pnpm add react-plugin-live2d @doki-land/live2d-element react react-dom
```

## Quick start

```tsx
import { Live2d } from "react-plugin-live2d";

export function Demo() {
  return (
    <Live2d
      model="/models/character.model3.json"
      width={480}
      height={640}
      prefer={["webgpu", "webgl2", "canvas2d"]}
      autoSway
      onReady={(modelId) => console.log("ready", modelId)}
      onHit={({ area }) => console.log("hit", area)}
    />
  );
}
```

## Imperative handle

```tsx
import { useRef } from "react";
import { Live2d, type Live2dHandle } from "react-plugin-live2d";

const ref = useRef<Live2dHandle>(null);

function lookLeft() {
  ref.current?.setParameter("PARAM_ANGLE_X", -15);
}

return <Live2d ref={ref} model="/models/character.model3.json" />;
```

## Development

```bash
pnpm --filter react-plugin-live2d typecheck
```

## License

Source code is dedicated to the public domain under **CC0 1.0 Universal** — see [`License.md`](../../../License.md).

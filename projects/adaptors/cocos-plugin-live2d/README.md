# cocos-plugin-live2d

One package, two host folders — session / evaluate / render stay in `@doki-land/live2d`:

| Import | Folder | Status |
| --- | --- | --- |
| `cocos-plugin-live2d` or `…/creator3` | `src/creator3` | Creator **3.x** Web runtime |
| `cocos-plugin-live2d/creator2` | `src/creator2` | Creator **2.4** scaffold (component shell only) |

Check which entry resolved:

```ts
import { COCOS_CREATOR_API, Live2D } from "cocos-plugin-live2d/creator3";
// → COCOS_CREATOR_API === 3

import { COCOS_CREATOR_API, Live2D } from "cocos-plugin-live2d/creator2";
// → COCOS_CREATOR_API === 2
```

## Creator 3

```ts
import { Live2D } from "cocos-plugin-live2d/creator3";

const live2d = node.addComponent(Live2D);
live2d.model = "https://example.com/model/model3.json";
```

## Creator 2 (scaffold)

```ts
import { Live2D } from "cocos-plugin-live2d/creator2";

const live2d = this.addComponent(Live2D); // or node.addComponent(Live2D)
```

`creator2` currently mounts a `cc.Component` shell and logs a warning in `start()` —
no offscreen canvas / `@doki-land/live2d` wiring yet. Use it to verify the project
resolves this package and the `/creator2` export.

Native Android / iOS are out of this slice. Tips / chrome stay in `@doki-land/live2d-widget`.

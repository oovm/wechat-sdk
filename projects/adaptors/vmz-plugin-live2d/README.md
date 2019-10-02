# @vmz/plugin-live2d

VMZ plugin for Live2D character hosting — maintained in **live2d.ts** `projects/adaptors/`.

```bash
pnpm add @vmz/plugin-live2d @doki-land/live2d
```

```ts
import { defineConfig } from 'vmz';
import live2d from '@vmz/plugin-live2d';

export default defineConfig({ plugins: [live2d] });
```

```vmz
<Live2dHost model="/models/character.model3.json" width={480} height={480} />
```

Runtime core stays in `@doki-land/live2d*`; generic chrome uses `@vmz/ui`.

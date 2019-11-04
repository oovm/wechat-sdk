# @vmz/plugin-live2d

VMZ plugin for Live2D — `<Live2dHost />` and `<Live2dStage />` over `@doki-land/live2d`.

```bash
pnpm add @vmz/plugin-live2d @vmz/ui @vmz/ui-icons
```

**App** (`vmz.config.ts`):

```ts
import {defineConfig} from '@vmz/vmz';
import live2d from '@vmz/plugin-live2d';

export default defineConfig({plugins: [live2d]});
```

**Plugin** (`vmz.plugin.ts` in this package) uses `definePlugin` from `@vmz/plugin`.

```vmz
<Live2dHost model="/models/character.model3.json" width={480} height={480} />

<Live2dStage sources={actorSources} updateMode="auto" />
```

Runtime stays in `@doki-land/live2d*`; site chrome uses `@vmz/ui` / `@vmz/ui-icons`.

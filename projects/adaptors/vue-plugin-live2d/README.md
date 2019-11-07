# vue-plugin-live2d

A Vue 3 compatibility component for `@doki-land/live2d`.

> **Runtime freeze lifted for shell only (v0.0.26):** this adapter is a thin Vue wrapper over
> `<live-2d>` from `@doki-land/live2d-element`. Shared behavior belongs in CE / Stage / Actor APIs.

This adapter helps existing Vue applications mount the browser-native runtime. It is not the architectural center of the
project and does not replace the framework-independent facade used by game engines and other hosts.

## ✨ Features

- Declarative model source.
- Configurable canvas dimensions.
- Renderer preference passthrough.
- Loading progress overlay.
- Ready, error, progress, profile, and hit events.
- Optional browser animation loop.
- Pointer tracking.
- Parameter inspection and mutation through the exposed component API.

## 📦 Installation

```bash
pnpm add vue-plugin-live2d @doki-land/live2d-element vue
```

## 🚀 Quick Start

```vue
<script setup lang="ts">
import { Live2D } from "vue-plugin-live2d";
</script>

<template>
  <Live2D
    model="/models/character.model3.json"
    :width="480"
    :height="640"
    :prefer="['webgpu', 'webgl2', 'canvas2d']"
    :autoplay="true"
    :auto-sway="true"
    @ready="(modelId) => console.log('ready', modelId)"
    @hit="(payload) => console.log('hit', payload.area)"
    @error="(error) => console.error(error)"
  />
</template>
```

## 🎛️ Component API

Use a template ref for runtime-level controls:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Live2D } from "vue-plugin-live2d";

const actor = ref<InstanceType<typeof Live2D> | null>(null);

function lookLeft() {
  actor.value?.setParameter("PARAM_ANGLE_X", -15);
}
</script>

<template>
  <Live2D ref="actor" model="/models/character.model3.json" />
  <button type="button" @click="lookLeft">Look left</button>
</template>
```

The component exposes runtime access, parameter operations, parameter listing, manual-angle reset, and reload behavior
supported by the current implementation.

## 🔄 Lifecycle

The component creates and destroys its runtime with the Vue component lifecycle. Model, size, renderer preference, and
autoplay changes can remount the canvas or reload the model depending on the affected state.

Avoid rapidly changing the model prop without handling loading and error states. Remote model requests may complete out
of order unless the runtime cancels stale generations.

## 🎮 Game Engine Guidance

Do not use this adapter merely because a game editor or shell contains Vue. If the game engine already owns the canvas
and frame loop, integrate `@doki-land/live2d` directly so the engine controls scheduling, input, resize, and resource
lifetime.

## 🧪 Development

```bash
pnpm --filter vue-plugin-live2d typecheck
pnpm --filter vue-plugin-live2d test
```

Tests should cover repeated mount/unmount, prop-driven reloads, stale loads, pointer coordinates, event forwarding, and
resource cleanup.

## 🤝 Contributing

Keep the adapter thin. Shared pointer, stage, actor, animation, and rendering semantics belong in the runtime rather
than being reimplemented for Vue.

## 📄 License

See the repository license.

---
title: Vue
order: 1
---

# Vue adaptor

Package: `vue-plugin-live2d`

```vue

<script setup lang="ts">
  import {Live2D} from "vue-plugin-live2d";
</script>

<template>
  <Live2D
      model="/models/quad/quad.model3.json"
      :width="360"
      :height="360"
      :prefer="['canvas2d']"
      auto-sway
  />
</template>
```

The component owns mount, load progress, the frame loop, and `profile` / `progress` forwarding. Session semantics stay
in `@doki-land/live2d`.

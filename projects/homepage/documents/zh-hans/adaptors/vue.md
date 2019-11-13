---
title: Vue
order: 1
---

# Vue 适配

包：`vue-plugin-live2d`

```vue

<script setup lang="ts">
  import {Live2d} from "vue-plugin-live2d";
</script>

<template>
  <Live2d
      model="/models/quad/quad.model3.json"
      :width="360"
      :height="360"
      :prefer="['canvas2d']"
      auto-sway
  />
</template>
```

组件负责挂载、加载进度、帧循环与 `profile` / `progress` 事件转发；业务语言与会话语义仍在 `@doki-land/live2d`。

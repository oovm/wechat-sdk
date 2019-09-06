<script setup lang="ts">
/**
 * Headless capture page for `scripts/generate-model-previews.mjs`.
 * Query: ?preset=local-wanko&w=512&h=512
 */
import type { LoadProgress } from "@doki-land/live2d";
import { onMounted, ref } from "vue";
import { Live2D } from "vue-plugin-live2d";

interface Preset {
    id: string;
    name?: Record<string, string>;
    source: string;
}

type CaptureApi = {
    ready: boolean;
    error: string | null;
    presetId: string;
    pngBase64: string | null;
};

declare global {
    interface Window {
        __LIVE2D_CAPTURE__?: CaptureApi;
    }
}

const params = new URLSearchParams(location.search);
const presetId = params.get("preset") || "local-wanko";
const width = Math.max(64, Number(params.get("w") || 512) || 512);
const height = Math.max(64, Number(params.get("h") || 512) || 512);

const source = ref<string | null>(null);
const status = ref("boot");
const live2dRef = ref<{
    capturePng: () => Promise<Blob>;
} | null>(null);

const api: CaptureApi = {
    ready: false,
    error: null,
    presetId,
    pngBase64: null,
};
window.__LIVE2D_CAPTURE__ = api;

async function blobToBase64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

async function onReady() {
    status.value = "capturing";
    try {
        // Settle deform / first textures.
        await new Promise((r) => setTimeout(r, 400));
        const blob = await live2dRef.value!.capturePng();
        api.pngBase64 = await blobToBase64(blob);
        api.ready = true;
        api.error = null;
        status.value = "ready";
    } catch (err) {
        api.error = String(err);
        api.ready = false;
        status.value = "error";
    }
}

function onError(error: unknown) {
    api.error = String(error);
    status.value = "error";
}

function onProgress(p: LoadProgress) {
    status.value = `${p.stage}:${Math.round(p.progress * 100)}`;
}

onMounted(async () => {
    try {
        const res = await fetch("/models/catalog.json");
        const catalog = (await res.json()) as { models?: Preset[] };
        const hit = catalog.models?.find((p) => p.id === presetId);
        if (!hit) {
            api.error = `unknown preset: ${presetId}`;
            status.value = "error";
            return;
        }
        // Only local /models paths — CDN needs network and is flaky for batch.
        if (!hit.source.startsWith("/")) {
            api.error = `preset ${presetId} is remote; skip offline capture`;
            status.value = "error";
            return;
        }
        source.value = hit.source;
    } catch (err) {
        api.error = String(err);
        status.value = "error";
    }
});
</script>

<template>
  <div class="capture">
    <p class="meta">{{ presetId }} · {{ status }}</p>
    <Live2D
      v-if="source"
      ref="live2dRef"
      :model="source"
      :width="width"
      :height="height"
      :prefer="['canvas2d', 'webgl2']"
      :autoplay="true"
      :auto-sway="false"
      :show-progress="false"
      @ready="onReady"
      @error="onError"
      @progress="onProgress"
    />
  </div>
</template>

<style scoped>
.capture {
  margin: 0;
  padding: 0;
  background: #e8f4ff;
  min-height: 100vh;
}
.meta {
  margin: 0;
  padding: 0.35rem 0.5rem;
  font: 600 12px/1.2 ui-monospace, monospace;
  color: #377ba8;
}
</style>

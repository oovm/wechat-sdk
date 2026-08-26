
<template>
  <div
    class="doki-live2d-root"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <live-2d
      ref="actorRef"
      :model="modelAttr"
      :width="width"
      :height="height"
      :autoplay="autoplay"
      :autosway="autoSway"
      :interactive="interactive"
      :tracking="tracking"
    />
    <div
      v-if="showProgress && loading"
      class="doki-live2d-progress"
      role="progressbar"
      :aria-valuenow="progressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="doki-live2d-progress__track">
        <div
          class="doki-live2d-progress__fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <div class="doki-live2d-progress__label">
        {{ progressLabel }} · {{ progressPercent }}%
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import "@doki-land/live2d-element";
import type {
    FrameProfile,
    LoadProgress,
    ModelSource,
    PlayMotionOptions,
    RendererKind,
} from "@doki-land/live2d";
import type { Live2dElement } from "@doki-land/live2d-element";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
    defineProps<{
        /** model3.json URL or ModelSource. */
        model?: ModelSource | null;
        width?: number;
        height?: number;
        /** Renderer try order. Default prefers Canvas2D for reliable preview. */
        prefer?: RendererKind[];
        autoplay?: boolean;
        /** Animate PARAM_ANGLE_X automatically while playing. */
        autoSway?: boolean;
        /** Show built-in loading overlay with progress bar. */
        showProgress?: boolean;
        interactive?: boolean;
        tracking?: "pointer" | "none";
    }>(),
    {
        model: null,
        width: 320,
        height: 320,
        prefer: () => ["canvas2d", "webgl2", "webgpu"],
        autoplay: true,
        autoSway: true,
        showProgress: true,
        interactive: true,
        tracking: "pointer",
    },
);

const emit = defineEmits<{
    ready: [modelId: string];
    error: [error: unknown];
    progress: [progress: LoadProgress];
    profile: [profile: FrameProfile];
    hit: [payload: { area: string; x: number; y: number }];
}>();

const actorRef = ref<Live2dElement | null>(null);
const loadProgress = ref<LoadProgress | null>(null);
const loading = ref(false);

const modelAttr = computed(() =>
    typeof props.model === "string" ? props.model : "",
);

const progressPercent = computed(() => {
    const p = loadProgress.value?.progress ?? 0;
    return Math.round(Math.min(1, Math.max(0, p)) * 100);
});

const progressLabel = computed(() => {
    const p = loadProgress.value;
    if (!p) return "Loading…";
    const stage = p.stage;
    if (p.bytesLoaded != null && p.bytesTotal != null && p.bytesTotal > 0) {
        const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
        return `${stage} · ${kb(p.bytesLoaded)} / ${kb(p.bytesTotal)}`;
    }
    return p.detail ? `${stage} · ${p.detail}` : stage;
});

function actor(): Live2dElement | null {
    return actorRef.value;
}

function syncSource(): void {
    const el = actor();
    if (!el) return;
    if (props.model == null) {
        el.removeAttribute("model");
        el.source = null;
        loading.value = false;
        loadProgress.value = null;
        return;
    }
    if (typeof props.model === "string") {
        el.source = null;
        el.model = props.model;
    } else {
        el.removeAttribute("model");
        el.source = props.model;
    }
    loading.value = true;
    loadProgress.value = { stage: "mounting", progress: 0.01 };
}

function syncRenderOptions(): void {
    const el = actor();
    if (!el) return;
    el.renderOptions = { prefer: [...props.prefer] };
}

function bindActorEvents(el: Live2dElement): void {
    el.addEventListener("live2d-ready", onReady);
    el.addEventListener("live2d-error", onError);
    el.addEventListener("live2d-progress", onProgress);
    el.addEventListener("live2d-profile", onProfile);
    el.addEventListener("live2d-hit", onHit);
}

function unbindActorEvents(el: Live2dElement): void {
    el.removeEventListener("live2d-ready", onReady);
    el.removeEventListener("live2d-error", onError);
    el.removeEventListener("live2d-progress", onProgress);
    el.removeEventListener("live2d-profile", onProfile);
    el.removeEventListener("live2d-hit", onHit);
}

function onReady(event: Event): void {
    loading.value = false;
    const detail = (event as CustomEvent<{ model?: string }>).detail;
    loadProgress.value = {
        stage: "ready",
        progress: 1,
        detail: detail?.model,
    };
    emit("ready", detail?.model ?? "");
}

function onError(event: Event): void {
    loading.value = false;
    const detail = (event as CustomEvent<{ cause?: unknown; error?: string }>)
        .detail;
    emit("error", detail?.cause ?? detail?.error ?? "live2d-error");
}

function onProgress(event: Event): void {
    const payload = (event as CustomEvent<LoadProgress>).detail;
    loadProgress.value = payload;
    emit("progress", payload);
}

function onProfile(event: Event): void {
    emit("profile", (event as CustomEvent<FrameProfile>).detail);
}

function onHit(event: Event): void {
    const detail = (
        event as CustomEvent<{
            area: string | null;
            modelX: number;
            modelY: number;
        }>
    ).detail;
    if (detail?.area) {
        emit("hit", {
            area: detail.area,
            x: detail.modelX,
            y: detail.modelY,
        });
    }
}

function setParameter(id: string, value: number): void {
    actor()?.runtime?.setParameter(id, value);
    if (!props.autoplay) {
        actor()?.runtime?.update(0);
    }
}

function clearManualAngleX(): void {
    /* autosway lives on <live-2d>; callers may set PARAM_ANGLE_X directly. */
}

async function reload(): Promise<void> {
    const el = actor();
    if (!el || props.model == null) {
        syncSource();
        return;
    }
    loading.value = true;
    loadProgress.value = {
        stage: "resolve",
        progress: 0.02,
        detail: "resolve source",
    };
    syncSource();
    await el.loadModel();
}

onMounted(() => {
    const el = actor();
    if (!el) return;
    bindActorEvents(el);
    syncRenderOptions();
    syncSource();
});

watch(
    () =>
        [
            props.model,
            props.width,
            props.height,
            props.prefer?.join(","),
            props.autoplay,
            props.autoSway,
            props.interactive,
            props.tracking,
        ] as const,
    () => {
        syncRenderOptions();
        syncSource();
    },
);

onBeforeUnmount(() => {
    const el = actor();
    if (el) unbindActorEvents(el);
});

defineExpose({
    getRuntime: () => actor()?.runtime ?? null,
    setParameter,
    clearManualAngleX,
    listParameters: () => actor()?.runtime?.listParameters() ?? [],
    playMotion: (group: string, index?: number, options?: PlayMotionOptions) =>
        actor()?.playMotion(group, index, options) ?? Promise.resolve(false),
    stopMotion: (opts?: { fade?: boolean; slot?: string }) =>
        actor()?.runtime?.stopMotion(opts),
    listPlayingMotions: () => actor()?.runtime?.listPlayingMotions() ?? [],
    capturePng: (opts?: { mimeType?: "image/png"; quality?: number }) => {
        const runtime = actor()?.runtime;
        if (!runtime) {
            return Promise.reject(
                new Error("vue-plugin-live2d: runtime not mounted"),
            );
        }
        return runtime.capturePng(opts);
    },
    reload,
});
</script>

<style scoped>
.doki-live2d-root {
  position: relative;
  display: inline-block;
  line-height: 0;
}

live-2d {
  display: block;
  width: 100%;
  height: 100%;
}

live-2d::part(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: auto;
  touch-action: none;
}

.doki-live2d-progress {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: stretch;
  gap: 0.55rem;
  padding: 1.25rem;
  box-sizing: border-box;
  background: color-mix(in srgb, #0f1b2d 55%, transparent);
  pointer-events: none;
}

.doki-live2d-progress__track {
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 22%, transparent);
  overflow: hidden;
}

.doki-live2d-progress__fill {
  height: 100%;
  border-radius: inherit;
  background: #7eb6ff;
  transition: width 80ms linear;
}

.doki-live2d-progress__label {
  color: #f4f8ff;
  font: 0.78rem/1.3 ui-sans-serif, system-ui, sans-serif;
  text-align: center;
  word-break: break-all;
}
</style>

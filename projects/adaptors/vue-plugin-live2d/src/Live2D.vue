
<template>
  <div
    class="doki-live2d-root"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div ref="hostRef" class="doki-live2d-host"/>
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
import {
    createLive2d,
    createRenderer,
    type FrameProfile,
    focusParameterUpdates,
    type Live2dRuntime,
    type LoadProgress,
    type ModelSource,
    type PlayMotionOptions,
    type RendererKind,
} from "@doki-land/live2d";
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
    }>(),
    {
        model: null,
        width: 320,
        height: 320,
        prefer: () => ["canvas2d", "webgl2", "webgpu"],
        autoplay: true,
        autoSway: true,
        showProgress: true,
    },
);

const emit = defineEmits<{
    ready: [modelId: string];
    error: [error: unknown];
    progress: [progress: LoadProgress];
    profile: [profile: FrameProfile];
    hit: [payload: { area: string; x: number; y: number }];
}>();

const hostRef = ref<HTMLDivElement | null>(null);
const loadProgress = ref<LoadProgress | null>(null);
const loading = ref(false);

let _canvas: HTMLCanvasElement | null = null;
let runtime: Live2dRuntime | null = null;
let raf = 0;
let lastTs = 0;
let manualAngleX: number | null = null;
let mountGeneration = 0;

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

function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTs = 0;
}

function tick(ts: number) {
    if (!runtime) return;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    if (manualAngleX !== null) {
        runtime.setParameter("PARAM_ANGLE_X", manualAngleX);
    } else if (props.autoSway) {
        const t = ts / 1000;
        runtime.setParameter(
            "PARAM_ANGLE_X",
            parameterFromNormalized("PARAM_ANGLE_X", Math.sin(t) * 0.25),
        );
    }
    runtime.update(dt);
    raf = requestAnimationFrame(tick);
}

function ensureFreshCanvas(): HTMLCanvasElement | null {
    const host = hostRef.value;
    if (!host) return null;
    // Drop any previous canvas so GPU context families never stack in the DOM.
    host.replaceChildren();
    const next = document.createElement("canvas");
    next.className = "doki-live2d-canvas";
    // Backing store follows devicePixelRatio so WebGL/WebGPU edges stay sharp.
    const dpr = Math.min(
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        2,
    );
    next.width = Math.max(1, Math.round(props.width * dpr));
    next.height = Math.max(1, Math.round(props.height * dpr));
    next.style.width = `${props.width}px`;
    next.style.height = `${props.height}px`;
    next.addEventListener("pointermove", onPointerMove);
    next.addEventListener("pointerdown", onPointerDown);
    host.appendChild(next);
    _canvas = next;
    return next;
}

function bindRuntimeEvents(r: Live2dRuntime) {
    r.events.on("ready", (p) => {
        loading.value = false;
        loadProgress.value = {
            stage: "ready",
            progress: 1,
            detail: p.modelId,
        };
        emit("ready", p.modelId);
    });
    r.events.on("error", (p) => {
        loading.value = false;
        emit("error", p.error);
    });
    r.events.on("progress", (p) => {
        loadProgress.value = p;
        emit("progress", p);
    });
    r.events.on("profile", (p) => {
        emit("profile", p);
    });
}

async function remount() {
    const gen = ++mountGeneration;
    stopLoop();
    runtime?.destroy();
    runtime = null;
    loadProgress.value = props.model
        ? { stage: "mounting", progress: 0.01, detail: "initialize renderer" }
        : null;
    loading.value = Boolean(props.model);

    let next = ensureFreshCanvas();
    if (!next) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        next = ensureFreshCanvas();
    }
    if (!next) {
        loading.value = false;
        emit("error", new Error("vue-plugin-live2d: host element missing"));
        return;
    }

    runtime = createLive2d({
        renderer: createRenderer({ prefer: props.prefer }),
    });
    bindRuntimeEvents(runtime);
    runtime.mount(next);

    if (props.model) {
        try {
            await runtime.loadModel(props.model);
            if (gen !== mountGeneration) return;
            if (props.autoplay) {
                raf = requestAnimationFrame(tick);
            } else {
                runtime.update(0);
            }
        } catch {
            // error already emitted via runtime events
        }
    } else {
        loading.value = false;
    }
}

/**
 * Reload model on the existing runtime/renderer.
 * Prefer this over remounting — full remount races GPU init and fetch.
 */
async function reload() {
    if (!runtime || !props.model) {
        await remount();
        return;
    }
    const gen = mountGeneration;
    stopLoop();
    loading.value = true;
    loadProgress.value = {
        stage: "resolve",
        progress: 0.02,
        detail: "resolve source",
    };
    try {
        await runtime.loadModel(props.model);
        if (gen !== mountGeneration) return;
        if (props.autoplay) {
            raf = requestAnimationFrame(tick);
        } else {
            runtime.update(0);
        }
    } catch {
        // error already emitted via runtime events
    }
}

function setParameter(id: string, value: number) {
    if (id === "PARAM_ANGLE_X") {
        manualAngleX = value;
    }
    runtime?.setParameter(id, value);
    if (!props.autoplay) {
        runtime?.update(0);
    }
}

function clearManualAngleX() {
    manualAngleX = null;
}

function modelPoint(event: PointerEvent) {
    const canvas = _canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: 1 - ((event.clientY - rect.top) / rect.height) * 2,
    };
}

function parameterFromNormalized(id: string, normalized: number) {
    const binding = runtime?.listParameters().find((p) => p.id === id);
    if (!binding) return normalized;
    return normalized >= 0
        ? binding.defaultValue +
              (binding.max - binding.defaultValue) * normalized
        : binding.defaultValue +
              (binding.defaultValue - binding.min) * normalized;
}

function applyPointerFocus(x: number, y: number) {
    if (!runtime) return;
    for (const { id, value } of focusParameterUpdates(
        runtime.listParameters(),
        x,
        y,
    )) {
        if (id === "PARAM_ANGLE_X") {
            // Pointer owns ANGLE_X until cleared; stops auto-sway fighting it.
            manualAngleX = value;
        }
        runtime.setParameter(id, value);
    }
}

function onPointerMove(event: PointerEvent) {
    const p = modelPoint(event);
    if (!p || !runtime) return;
    applyPointerFocus(p.x, p.y);
    if (!props.autoplay) runtime.update(0);
}

function onPointerDown(event: PointerEvent) {
    const p = modelPoint(event);
    if (!p || !runtime) return;
    const area = runtime.hitTest(p.x, p.y);
    if (area) emit("hit", { area, x: p.x, y: p.y });
}

onMounted(() => {
    void remount();
});

watch(
    () =>
        [
            props.model,
            props.width,
            props.height,
            props.prefer?.join(","),
            props.autoplay,
        ] as const,
    () => {
        void remount();
    },
);

onBeforeUnmount(() => {
    mountGeneration += 1;
    stopLoop();
    runtime?.destroy();
    runtime = null;
    _canvas = null;
    hostRef.value?.replaceChildren();
});

defineExpose({
    getRuntime: () => runtime,
    setParameter,
    clearManualAngleX,
    listParameters: () => runtime?.listParameters() ?? [],
    playMotion: (group: string, index?: number, options?: PlayMotionOptions) =>
        runtime?.playMotion(group, index, options) ?? Promise.resolve(false),
    stopMotion: (opts?: { fade?: boolean; slot?: string }) =>
        runtime?.stopMotion(opts),
    listPlayingMotions: () => runtime?.listPlayingMotions() ?? [],
    capturePng: (opts?: { mimeType?: "image/png"; quality?: number }) => {
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

.doki-live2d-host {
  display: block;
  width: 100%;
  height: 100%;
  line-height: 0;
}

.doki-live2d-host :deep(canvas) {
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

<script setup lang="ts">
import type { FrameProfile, RendererKind } from "@doki-land/live2d";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Live2D } from "vue-plugin-live2d";
import { useI18n } from "../i18n";
import {
    type CatalogModel,
    displayNameFor,
    type ModelsCatalog,
} from "../lib/catalog";

interface StageActor {
    uid: string;
    modelId: string;
    source: string;
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
}

const STORAGE_KEY = "live2d.ts.stage.layout";

const { t, locale } = useI18n();
const route = useRoute();

const models = ref<CatalogModel[]>([]);
const actors = ref<StageActor[]>([]);
const selectedUid = ref<string | null>(null);
const addModelId = ref("");
const spawnCount = ref(1);
const actorSize = ref(240);
const preferKind = ref<RendererKind>("canvas2d");
const autoSway = ref(true);
const profiles = reactive<Record<string, FrameProfile | null>>({});
const stageRef = ref<HTMLElement | null>(null);
let zTop = 1;
let uidSeq = 0;

const prefer = computed<RendererKind[]>(() => {
    if (preferKind.value === "webgpu") return ["webgpu", "webgl2", "canvas2d"];
    if (preferKind.value === "webgl2") return ["webgl2", "canvas2d"];
    return ["canvas2d", "webgl2"];
});

const catalogOptions = computed(() =>
    models.value.map((m) => ({
        id: m.id,
        label: displayNameFor(m, locale.value),
        source: m.source,
    })),
);

const stats = computed(() => {
    const list = actors.value
        .map((a) => profiles[a.uid])
        .filter((p): p is FrameProfile => !!p);
    const n = actors.value.length;
    if (!list.length) {
        return {
            instances: n,
            ready: 0,
            fpsMin: 0,
            fpsAvg: 0,
            frameMsSum: 0,
            drawMsSum: 0,
            evaluateMsSum: 0,
        };
    }
    const fps = list.map((p) => p.fpsSmooth || p.fps || 0);
    const fpsAvg = fps.reduce((a, b) => a + b, 0) / fps.length;
    const fpsMin = Math.min(...fps);
    return {
        instances: n,
        ready: list.length,
        fpsMin,
        fpsAvg,
        frameMsSum: list.reduce((a, p) => a + (p.frameMs || 0), 0),
        drawMsSum: list.reduce((a, p) => a + (p.drawMs || 0), 0),
        evaluateMsSum: list.reduce((a, p) => a + (p.evaluateMs || 0), 0),
    };
});

function nextUid(modelId: string): string {
    uidSeq += 1;
    return `${modelId}-${uidSeq}-${Date.now().toString(36)}`;
}

function modelSource(modelId: string): string | null {
    return models.value.find((m) => m.id === modelId)?.source ?? null;
}

function addActors(modelId: string, count: number) {
    const source = modelSource(modelId);
    if (!source) return;
    const size = Math.max(96, Math.min(720, actorSize.value));
    const stage = stageRef.value;
    const maxX = Math.max(40, (stage?.clientWidth ?? 800) - size - 20);
    const maxY = Math.max(40, (stage?.clientHeight ?? 600) - size - 20);
    const next: StageActor[] = [];
    for (let i = 0; i < count; i += 1) {
        zTop += 1;
        const col = actors.value.length + i;
        next.push({
            uid: nextUid(modelId),
            modelId,
            source,
            x: 24 + ((col * 36) % maxX),
            y: 24 + ((col * 28) % maxY),
            w: size,
            h: size,
            z: zTop,
        });
    }
    actors.value = [...actors.value, ...next];
    selectedUid.value = next[next.length - 1]?.uid ?? selectedUid.value;
}

function addSelected() {
    if (!addModelId.value) return;
    addActors(addModelId.value, Math.max(1, Math.min(32, spawnCount.value | 0)));
}

function duplicateSelected() {
    const cur = actors.value.find((a) => a.uid === selectedUid.value);
    if (!cur) return;
    zTop += 1;
    const copy: StageActor = {
        ...cur,
        uid: nextUid(cur.modelId),
        x: cur.x + 28,
        y: cur.y + 28,
        z: zTop,
    };
    actors.value = [...actors.value, copy];
    selectedUid.value = copy.uid;
}

function removeSelected() {
    if (!selectedUid.value) return;
    const uid = selectedUid.value;
    actors.value = actors.value.filter((a) => a.uid !== uid);
    delete profiles[uid];
    selectedUid.value = actors.value[actors.value.length - 1]?.uid ?? null;
}

function clearStage() {
    actors.value = [];
    for (const k of Object.keys(profiles)) delete profiles[k];
    selectedUid.value = null;
}

function selectActor(uid: string) {
    selectedUid.value = uid;
    const a = actors.value.find((x) => x.uid === uid);
    if (!a) return;
    zTop += 1;
    a.z = zTop;
}

function onProfile(uid: string, p: FrameProfile) {
    profiles[uid] = p;
}

function labelFor(modelId: string): string {
    const m = models.value.find((x) => x.id === modelId);
    return m ? displayNameFor(m, locale.value) : modelId;
}

/** Pointer drag */
let drag: {
    uid: string;
    ox: number;
    oy: number;
    startX: number;
    startY: number;
} | null = null;

function onDragStart(ev: PointerEvent, uid: string) {
    const a = actors.value.find((x) => x.uid === uid);
    if (!a) return;
    selectActor(uid);
    drag = {
        uid,
        ox: a.x,
        oy: a.y,
        startX: ev.clientX,
        startY: ev.clientY,
    };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
}

function onDragMove(ev: PointerEvent) {
    if (!drag) return;
    const a = actors.value.find((x) => x.uid === drag!.uid);
    if (!a) return;
    a.x = Math.round(drag.ox + (ev.clientX - drag.startX));
    a.y = Math.round(drag.oy + (ev.clientY - drag.startY));
}

function onDragEnd() {
    drag = null;
}

function persist() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                actors: actors.value,
                preferKind: preferKind.value,
                actorSize: actorSize.value,
                autoSway: autoSway.value,
            }),
        );
    } catch {
        // ignore
    }
}

function restore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw) as {
            actors?: StageActor[];
            preferKind?: RendererKind;
            actorSize?: number;
            autoSway?: boolean;
        };
        if (Array.isArray(data.actors)) {
            actors.value = data.actors.filter(
                (a) => a && a.uid && a.source && typeof a.x === "number",
            );
            zTop = Math.max(1, ...actors.value.map((a) => a.z || 1));
            uidSeq = actors.value.length;
        }
        if (data.preferKind) preferKind.value = data.preferKind;
        if (typeof data.actorSize === "number") actorSize.value = data.actorSize;
        if (typeof data.autoSway === "boolean") autoSway.value = data.autoSway;
    } catch {
        // ignore
    }
}

watch(
    [actors, preferKind, actorSize, autoSway],
    () => {
        persist();
    },
    { deep: true },
);

onMounted(async () => {
    try {
        const res = await fetch("/models/catalog.json");
        if (res.ok) {
            const catalog = (await res.json()) as ModelsCatalog;
            models.value = catalog.models ?? [];
            addModelId.value =
                models.value.find((m) => m.id === "local-wanko")?.id ??
                models.value.find((m) => m.local)?.id ??
                models.value[0]?.id ??
                "";
        }
    } catch {
        models.value = [];
    }
    restore();
    const addId =
        typeof route.query.add === "string" ? route.query.add : "";
    const n = Math.max(
        1,
        Math.min(32, Number(route.query.n ?? spawnCount.value) || 1),
    );
    if (addId && modelSource(addId)) {
        addModelId.value = addId;
        spawnCount.value = n;
        addActors(addId, n);
    }
});

onUnmounted(() => {
    persist();
});
</script>

<template>
  <main class="stage-page">
    <header class="hero">
      <p class="kicker">{{ t("stage.kicker") }}</p>
      <h1>{{ t("stage.title") }}</h1>
      <p class="lede">{{ t("stage.lede") }}</p>
    </header>

    <aside class="panel" :aria-label="t('stage.panelAria')">
      <label class="field">
        <span>{{ t("stage.addModel") }}</span>
        <select v-model="addModelId">
          <option v-for="m in catalogOptions" :key="m.id" :value="m.id">
            {{ m.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>{{ t("stage.spawnCount") }}</span>
        <input v-model.number="spawnCount" type="number" min="1" max="32"/>
      </label>

      <label class="field">
        <span>{{ t("stage.actorSize") }}</span>
        <input v-model.number="actorSize" type="number" min="96" max="720" step="16"/>
      </label>

      <label class="field">
        <span>{{ t("stage.renderer") }}</span>
        <select v-model="preferKind">
          <option value="canvas2d">Canvas2D</option>
          <option value="webgl2">WebGL2</option>
          <option value="webgpu">WebGPU</option>
        </select>
      </label>

      <label class="check">
        <input v-model="autoSway" type="checkbox"/>
        <span>{{ t("stage.autoSway") }}</span>
      </label>

      <div class="actions">
        <button type="button" class="primary" @click="addSelected">{{ t("stage.add") }}</button>
        <button type="button" :disabled="!selectedUid" @click="duplicateSelected">
          {{ t("stage.duplicate") }}
        </button>
        <button type="button" :disabled="!selectedUid" @click="removeSelected">
          {{ t("stage.remove") }}
        </button>
        <button type="button" :disabled="!actors.length" @click="clearStage">
          {{ t("stage.clear") }}
        </button>
      </div>

      <dl class="stats">
        <div>
          <dt>{{ t("stage.statInstances") }}</dt>
          <dd>{{ stats.instances }} <small>({{ stats.ready }} ready)</small></dd>
        </div>
        <div>
          <dt>{{ t("stage.statFps") }}</dt>
          <dd>{{ stats.fpsAvg.toFixed(1) }} <small>min {{ stats.fpsMin.toFixed(1) }}</small></dd>
        </div>
        <div>
          <dt>{{ t("stage.statFrame") }}</dt>
          <dd>{{ stats.frameMsSum.toFixed(1) }} ms</dd>
        </div>
        <div>
          <dt>{{ t("stage.statEval") }}</dt>
          <dd>{{ stats.evaluateMsSum.toFixed(1) }} ms</dd>
        </div>
        <div>
          <dt>{{ t("stage.statDraw") }}</dt>
          <dd>{{ stats.drawMsSum.toFixed(1) }} ms</dd>
        </div>
      </dl>

      <p class="hint">{{ t("stage.hint") }}</p>
    </aside>

    <section ref="stageRef" class="stage" :aria-label="t('stage.stageAria')">
      <p v-if="!actors.length" class="empty">{{ t("stage.empty") }}</p>

      <div
        v-for="actor in actors"
        :key="actor.uid"
        class="actor"
        :class="{ selected: selectedUid === actor.uid }"
        :style="{
          left: `${actor.x}px`,
          top: `${actor.y}px`,
          width: `${actor.w}px`,
          zIndex: actor.z,
        }"
        @pointerdown="selectActor(actor.uid)"
      >
        <div
          class="chrome"
          @pointerdown.stop="onDragStart($event, actor.uid)"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        >
          <span class="chrome-title">{{ labelFor(actor.modelId) }}</span>
          <span class="chrome-fps">
            {{
              profiles[actor.uid]
                ? `${(profiles[actor.uid]!.fpsSmooth || profiles[actor.uid]!.fps || 0).toFixed(0)} fps`
                : "…"
            }}
          </span>
        </div>
        <Live2D
          :key="`${actor.uid}-${preferKind}`"
          :model="actor.source"
          :width="actor.w"
          :height="actor.h"
          :prefer="prefer"
          :autoplay="true"
          :auto-sway="autoSway"
          :show-progress="false"
          @profile="onProfile(actor.uid, $event)"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.stage-page {
  --stage-ink: var(--ink);
  display: grid;
  grid-template-columns: minmax(15rem, 18rem) 1fr;
  grid-template-rows: auto 1fr;
  gap: 0 1.25rem;
  max-width: 96rem;
  margin: 0 auto;
  padding: 1.25rem 1.25rem 2.5rem;
  min-height: calc(100vh - 4.5rem);
}

.hero {
  grid-column: 1 / -1;
  max-width: 40rem;
  margin-bottom: 1rem;
}

.kicker {
  margin: 0 0 0.45rem;
  color: #377ba8;
  font: 650 0.72rem/1 var(--font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 2.8vw, 2.3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.lede {
  margin: 0.55rem 0 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

.panel {
  display: grid;
  gap: 0.75rem;
  align-content: start;
  padding: 0.85rem 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  background: #f7fbff;
}

.field {
  display: grid;
  gap: 0.3rem;
  font: 650 0.72rem/1 var(--font-display);
  color: #377ba8;
}

.field select,
.field input[type="number"] {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: #fff;
  color: var(--ink);
  padding: 0.4rem 0.5rem;
  font: 500 0.85rem/1.2 var(--font-body);
}

.check {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font: 600 0.82rem/1.2 var(--font-body);
  color: var(--ink);
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.actions button {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: #fff;
  color: var(--ink);
  padding: 0.45rem 0.5rem;
  font: 650 0.78rem/1 var(--font-display);
  cursor: pointer;
}

.actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.actions .primary {
  grid-column: 1 / -1;
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  background: var(--accent);
  color: #fff;
}

.stats {
  margin: 0.35rem 0 0;
  display: grid;
  gap: 0.35rem;
}

.stats div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.78rem;
}

.stats dt {
  margin: 0;
  color: var(--muted);
  font: 600 0.72rem/1.2 var(--font-display);
}

.stats dd {
  margin: 0;
  font: 650 0.82rem/1.2 var(--font-display);
  text-align: right;
}

.stats small {
  color: var(--muted);
  font-weight: 500;
}

.hint {
  margin: 0.2rem 0 0;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.stage {
  position: relative;
  min-height: 32rem;
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  background:
    linear-gradient(180deg, #f4fbff 0%, #eaf4ff 100%);
  overflow: hidden;
  touch-action: none;
}

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--muted);
  font: 600 0.95rem/1.4 var(--font-display);
  pointer-events: none;
}

.actor {
  position: absolute;
  display: grid;
  grid-template-rows: auto 1fr;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--ink) 6%, transparent);
}

.actor.selected {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  outline: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}

.chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.28rem 0.45rem;
  background: #edf6ff;
  color: var(--ink);
  cursor: grab;
  user-select: none;
  font: 650 0.68rem/1 var(--font-display);
}

.chrome:active {
  cursor: grabbing;
}

.chrome-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chrome-fps {
  color: #377ba8;
  flex: none;
}

@media (max-width: 900px) {
  .stage-page {
    grid-template-columns: 1fr;
  }

  .stage {
    min-height: 24rem;
  }
}
</style>

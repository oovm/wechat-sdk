<script setup lang="ts">
import {
    type FrameProfile,
    type InternalModel,
    type LoadProgress,
    MotionPriority,
    type ParameterBinding,
    type PlayMotionOptions,
    type RendererKind,
    resolveModelSourceUrl,
    type SessionState,
} from "@doki-land/live2d";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Live2D } from "vue-plugin-live2d";
import { useI18n } from "../i18n";
import { displayNameFor, type CatalogLocalizedName } from "../lib/catalog";

interface Preset {
    id: string;
    name?: CatalogLocalizedName;
    /** @deprecated use name */
    label?: string;
    source: string;
    local?: boolean;
}

type PanelTab = "source" | "status" | "properties";

const LOAD_STAGES = [
    "mounting",
    "resolve",
    "settings",
    "moc",
    "textures",
    "decode",
    "ready",
] as const;

type LoadStageId = (typeof LOAD_STAGES)[number];

const { t, locale } = useI18n();
const route = useRoute();

const tabs = computed(() => [
    { id: "source" as const, label: t("playground.tabSource") },
    { id: "status" as const, label: t("playground.tabStatus") },
    { id: "properties" as const, label: t("playground.tabProperties") },
]);

const activeTab = ref<PanelTab>("source");

const DEFAULT_PRESET_ID = "local-wanko";
const DEFAULT_PRESET_SOURCE = "/models/samples/moc3-wanko/Wanko.model3.json";

const presets = ref<Preset[]>([
    {
        id: DEFAULT_PRESET_ID,
        name: {
            "en-us": "Local moc3 Wanko",
            "zh-cn": "本地 moc3 Wanko",
        },
        source: DEFAULT_PRESET_SOURCE,
        local: true,
    },
    {
        id: "cpu-quad",
        name: {
            "en-us": "Local CPU program (quad)",
            "zh-cn": "本地 CPU program（方块）",
        },
        source: "/models/quad/quad.model3.json",
        local: true,
    },
]);

function presetLabel(p: Preset): string {
    if (p.name) return displayNameFor({ id: p.id, name: p.name }, locale.value);
    return p.label || p.id;
}

const mode = ref<"preset" | "url" | "npm">("preset");
const presetId = ref(DEFAULT_PRESET_ID);
const customUrl = ref(
    "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@b1de66b/Samples/Resources/Wanko/Wanko.model3.json",
);

/** Known jsDelivr npm: models — fills package + path together. */
const npmExamples = [
    {
        id: "hijiki",
        package: "live2d-widget-model-hijiki@1.0.5",
        path: "assets/hijiki.model.json",
    },
    {
        id: "tororo",
        package: "live2d-widget-model-tororo@1.0.5",
        path: "assets/tororo.model.json",
    },
] as const;

const npmExampleId = ref<(typeof npmExamples)[number]["id"] | "">("hijiki");
const npmPackage = ref<string>(npmExamples[0].package);
const npmPath = ref<string>(npmExamples[0].path);

function applyNpmExample(id: string) {
    const ex = npmExamples.find((e) => e.id === id);
    if (!ex) {
        npmExampleId.value = "";
        return;
    }
    npmExampleId.value = ex.id;
    npmPackage.value = ex.package;
    npmPath.value = ex.path;
}

function syncNpmExampleFromFields() {
    const hit = npmExamples.find(
        (e) =>
            e.package === npmPackage.value.trim() &&
            e.path === npmPath.value.trim().replace(/^\/+/, ""),
    );
    npmExampleId.value = hit?.id ?? "";
}
const appliedSource = ref<string | null>(null);
const status = ref("idle");
const errorText = ref("");
const resolvedHint = ref("");
const progress = ref<LoadProgress | null>(null);
const frameProfile = ref<FrameProfile | null>(null);
const loadStartedAt = ref<number | null>(null);
const loadElapsedMs = ref<number | null>(null);

const modelInfo = ref<InternalModel | null>(null);
const sessionState = ref<SessionState | null>(null);
const rendererKind = ref<string>("—");
const parameters = ref<ParameterBinding[]>([]);
const paramOverrides = ref<Record<string, number>>({});

const progressPercent = computed(() =>
    Math.round(Math.min(1, Math.max(0, progress.value?.progress ?? 0)) * 100),
);

const currentStage = computed(
    () => (progress.value?.stage ?? null) as LoadStageId | null,
);

const pipelineRows = computed(() => {
    const cur = currentStage.value;
    const curIdx = cur ? LOAD_STAGES.indexOf(cur) : -1;
    const failed = status.value === "error";
    return LOAD_STAGES.map((id, idx) => {
        let state: "pending" | "active" | "done" | "error" = "pending";
        if (failed && cur === id) state = "error";
        else if (status.value.startsWith("ready") && id === "ready")
            state = "done";
        else if (curIdx >= 0 && idx < curIdx) state = "done";
        else if (cur === id && status.value.startsWith("loading"))
            state = "active";
        else if (cur === id && status.value.startsWith("ready")) state = "done";
        return {
            id,
            state,
            detail: cur === id ? (progress.value?.detail ?? "") : "",
        };
    });
});

const stuckHint = computed(() => {
    if (status.value === "error") {
        return t("playground.stuckFailed", {
            stage: currentStage.value ?? "unknown",
        });
    }
    if (status.value.startsWith("loading")) {
        return t("playground.stuckRunning", {
            stage: currentStage.value ?? "?",
            percent: progressPercent.value,
        });
    }
    if (status.value.startsWith("ready")) return t("playground.stuckComplete");
    return status.value;
});

const profileRows = computed(() => {
    const p = frameProfile.value;
    if (!p) return [] as { key: string; value: string }[];
    return [
        { key: "fps", value: p.fpsSmooth.toFixed(1) },
        { key: "frame", value: `${p.frameMs.toFixed(2)} ms` },
        { key: "evaluate", value: `${p.evaluateMs.toFixed(2)} ms` },
        { key: "draw", value: `${p.drawMs.toFixed(2)} ms` },
        { key: "drawables", value: String(p.drawableCount) },
        { key: "vertices", value: String(Math.round(p.vertexCount)) },
        {
            key: "triangles",
            value: String(Math.round(p.indexCount / 3)),
        },
    ];
});

const width = ref(360);
const height = ref(360);
const preferKey = ref<RendererKind>("canvas2d");

/** Homepage picks one backend — no fallback chain (fail loud for testing). */
const prefer = computed<RendererKind[]>(() => [preferKey.value]);

const rendererChoices: readonly {
    id: RendererKind;
    blurbKey:
        | "playground.rendererCanvas2d"
        | "playground.rendererWebgl2"
        | "playground.rendererWebgpu";
}[] = [
    { id: "canvas2d", blurbKey: "playground.rendererCanvas2d" },
    { id: "webgl2", blurbKey: "playground.rendererWebgl2" },
    { id: "webgpu", blurbKey: "playground.rendererWebgpu" },
];

const live2dRef = ref<{
    getRuntime: () => {
        model: InternalModel | null;
        state: SessionState;
        renderer: { kind: string };
        listParameters: () => readonly ParameterBinding[];
        setParameter: (id: string, value: number) => void;
    } | null;
    setParameter: (id: string, value: number) => void;
    clearManualAngleX: () => void;
    listParameters: () => readonly ParameterBinding[];
    playMotion: (
        group: string,
        index?: number,
        options?: PlayMotionOptions,
    ) => Promise<boolean>;
    stopMotion: (opts?: { fade?: boolean; slot?: string }) => void;
    listPlayingMotions: () => ReadonlyArray<{
        slot: string;
        group: string;
        index: number;
        time: number;
        priority: number;
    }>;
    reload: () => Promise<void>;
} | null>(null);

const activePreset = computed(
    () => presets.value.find((p) => p.id === presetId.value) ?? null,
);

const motionGroupEntries = computed(() => {
    const groups = modelInfo.value?.settings.motionGroups ?? {};
    return Object.entries(groups).map(([name, motions]) => ({
        name,
        count: motions.length,
        files: motions.map((m, index) => ({ file: m.file, index })),
    }));
});

async function playMotion(group: string, index: number) {
    try {
        const lower = group.toLowerCase();
        const isIdle = lower === "idle" || lower.includes("idle");
        await live2dRef.value?.playMotion(group, index, {
            priority: isIdle ? MotionPriority.idle : MotionPriority.normal,
            loop: isIdle,
        });
    } catch (err) {
        console.error(err);
        status.value = `motion failed: ${String(err)}`;
    }
}
const propertyRows = computed(() => {
    const m = modelInfo.value;
    if (!m) return [] as { key: string; value: string }[];
    const s = m.settings;
    return [
        { key: "id", value: m.id },
        { key: "format", value: m.format },
        { key: "name", value: s.name ?? "—" },
        { key: "settings url", value: s.url },
        { key: "moc", value: s.moc },
        { key: "textures", value: s.textures.join(", ") || "—" },
        {
            key: "expressions",
            value:
                s.expressions.map((e) => e.name).join(", ") ||
                String(s.expressions.length),
        },
        {
            key: "hit areas",
            value: s.hitAreas.map((h) => h.name).join(", ") || "—",
        },
        { key: "physics", value: s.physics ?? "—" },
        { key: "pose", value: s.pose ?? "—" },
        { key: "renderer", value: rendererKind.value },
        {
            key: "session",
            value: sessionState.value
                ? `${sessionState.value.phase} · gen ${sessionState.value.generation}`
                : "—",
        },
    ];
});

function buildSource(): string {
    if (mode.value === "preset") {
        return activePreset.value?.source ?? DEFAULT_PRESET_SOURCE;
    }
    if (mode.value === "url") {
        return customUrl.value.trim();
    }
    const pkg = npmPackage.value.trim().replace(/^npm:/, "");
    const path = npmPath.value.trim().replace(/^\/+/, "");
    if (!pkg || !path) {
        throw new Error("npm package and asset path are both required");
    }
    // Guard against accidental `pkg/path` stuffed into the package field alone.
    if (pkg.includes("/") && !path) {
        return `npm:${pkg}`;
    }
    return `npm:${pkg}/${path}`;
}

function refreshResolvedHint() {
    try {
        resolvedHint.value = resolveModelSourceUrl(buildSource());
    } catch (err) {
        resolvedHint.value = err instanceof Error ? err.message : String(err);
    }
}

function clearModelInspect() {
    modelInfo.value = null;
    sessionState.value = null;
    rendererKind.value = "—";
    parameters.value = [];
    paramOverrides.value = {};
    frameProfile.value = null;
    lastProfileUiAt = 0;
}

function refreshModelInspect() {
    const runtime = live2dRef.value?.getRuntime() ?? null;
    if (!runtime?.model) {
        clearModelInspect();
        return;
    }
    modelInfo.value = runtime.model;
    sessionState.value = runtime.state;
    rendererKind.value = runtime.renderer.kind;
    const listed = [...(live2dRef.value?.listParameters() ?? [])];
    parameters.value = listed;
    const next: Record<string, number> = {};
    for (const p of listed) {
        next[p.id] = paramOverrides.value[p.id] ?? p.value;
    }
    paramOverrides.value = next;
}

async function applyLoad() {
    errorText.value = "";
    progress.value = {
        stage: "mounting",
        progress: 0.01,
        detail: "initialize renderer",
    };
    status.value = "loading";
    loadStartedAt.value =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    loadElapsedMs.value = null;
    clearModelInspect();
    refreshResolvedHint();
    const src = buildSource();
    const same = appliedSource.value === src;
    appliedSource.value = src;
    await nextTick();
    // Same source: soft-reload. Key remount races renderer init + fetch and
    // was getting stuck at resolve/settings 0–5%.
    if (same && live2dRef.value) {
        try {
            await live2dRef.value.reload();
        } catch (err) {
            onError(err);
        }
    }
}

function onReady(id: string) {
    status.value = `ready:${id}`;
    progress.value = { stage: "ready", progress: 1, detail: id };
    if (loadStartedAt.value != null) {
        const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
        loadElapsedMs.value = now - loadStartedAt.value;
    }
    void nextTick(() => {
        refreshModelInspect();
    });
}

function onError(err: unknown) {
    status.value = "error";
    errorText.value = err instanceof Error ? err.message : String(err);
    clearModelInspect();
}

function onProgress(p: LoadProgress) {
    progress.value = p;
    if (!status.value.startsWith("ready")) {
        status.value = `loading:${p.stage} ${Math.round(p.progress * 100)}%`;
    }
    const rt = live2dRef.value?.getRuntime();
    if (rt) {
        sessionState.value = rt.state;
        rendererKind.value = rt.renderer.kind;
    }
}

let lastProfileUiAt = 0;

function onProfile(p: FrameProfile) {
    // ~5 Hz UI refresh — enough to compare backends without thrashing Vue.
    const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    if (
        frameProfile.value &&
        lastProfileUiAt !== 0 &&
        now - lastProfileUiAt < 200
    ) {
        return;
    }
    lastProfileUiAt = now;
    frameProfile.value = p;
}

function onParamInput(id: string, value: number) {
    paramOverrides.value = { ...paramOverrides.value, [id]: value };
    live2dRef.value?.setParameter(id, value);
}

onMounted(async () => {
    try {
        const res = await fetch("/models/catalog.json");
        if (res.ok) {
            const catalog = (await res.json()) as { models?: Preset[] };
            if (catalog.models?.length) {
                presets.value = catalog.models;
                const fromQuery = String(route.query.preset ?? "");
                const preferred =
                    (fromQuery &&
                        catalog.models.find((p) => p.id === fromQuery)) ||
                    catalog.models.find((p) => p.id === DEFAULT_PRESET_ID) ||
                    catalog.models.find((p) => p.id !== "cpu-quad") ||
                    catalog.models[0];
                if (preferred) {
                    presetId.value = preferred.id;
                    mode.value = "preset";
                }
            }
        }
    } catch {
        // keep built-in preset
    }
    refreshResolvedHint();
    applyLoad();
});

watch(
    () => route.query.preset,
    (id) => {
        if (typeof id !== "string" || !id) return;
        if (!presets.value.some((p) => p.id === id)) return;
        presetId.value = id;
        mode.value = "preset";
        applyLoad();
    },
);
watch([mode, presetId, customUrl, npmPackage, npmPath], () => {
    if (mode.value === "npm") syncNpmExampleFromFields();
    refreshResolvedHint();
});
</script>

<template>
  <main class="playground">
    <header>
      <h1>{{ t("playground.title") }}</h1>
    </header>

    <div class="layout">
      <section class="panel">
        <div class="tabs" role="tablist" :aria-label="t('playground.tabsAria')">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="tab"
            :class="{ active: activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <div
          v-show="activeTab === 'source'"
          role="tabpanel"
          class="tab-panel"
        >
          <div class="modes">
            <label>
              <input v-model="mode" type="radio" value="preset"/>
              {{ t("playground.modePreset") }}
            </label>
            <label>
              <input v-model="mode" type="radio" value="npm"/>
              {{ t("playground.modeNpm") }}
            </label>
            <label>
              <input v-model="mode" type="radio" value="url"/>
              {{ t("playground.modeUrl") }}
            </label>
          </div>

          <div v-if="mode === 'preset'" class="field">
            <label for="preset">{{ t("playground.model") }}</label>
            <select id="preset" v-model="presetId">
              <option v-for="p in presets" :key="p.id" :value="p.id">
                {{ presetLabel(p) }}
              </option>
            </select>
          </div>

          <div v-else-if="mode === 'npm'" class="npm-fields">
            <div class="field">
              <label for="npm-example">{{ t("playground.npmExample") }}</label>
              <select
                id="npm-example"
                v-model="npmExampleId"
                @change="applyNpmExample(npmExampleId)"
              >
                <option value="">{{ t("playground.npmExampleCustom") }}</option>
                <option
                  v-for="ex in npmExamples"
                  :key="ex.id"
                  :value="ex.id"
                >
                  {{ t(`playground.npmExamples.${ex.id}`) }}
                </option>
              </select>
              <p class="field-hint">{{ t("playground.npmExampleHint") }}</p>
            </div>
            <div class="field">
              <label for="npm-pkg">{{ t("playground.npmPkg") }}</label>
              <input
                id="npm-pkg"
                v-model="npmPackage"
                class="mono"
                type="text"
                spellcheck="false"
                autocomplete="off"
                placeholder="live2d-widget-model-hijiki@1.0.5"
              />
            </div>
            <div class="field">
              <label for="npm-path">{{ t("playground.npmPath") }}</label>
              <input
                id="npm-path"
                v-model="npmPath"
                class="mono"
                type="text"
                spellcheck="false"
                autocomplete="off"
                placeholder="assets/hijiki.model.json"
              />
            </div>
          </div>

          <div v-else class="field">
            <label for="url">{{ t("playground.urlLabel") }}</label>
            <input id="url" v-model="customUrl" type="url" spellcheck="false"/>
          </div>

          <p class="resolved">
            {{ t("playground.resolved") }}:
            <code>{{ resolvedHint }}</code>
          </p>

          <fieldset class="renderer-field">
            <legend>{{ t("playground.renderer") }}</legend>
            <div
              class="renderer-cards"
              role="radiogroup"
              :aria-label="t('playground.renderer')"
            >
              <label
                v-for="choice in rendererChoices"
                :key="choice.id"
                class="renderer-card"
                :class="{ active: preferKey === choice.id }"
              >
                <input
                  v-model="preferKey"
                  type="radio"
                  name="renderer"
                  :value="choice.id"
                />
                <span class="renderer-card__name">{{ choice.id }}</span>
                <span class="renderer-card__blurb">{{ t(choice.blurbKey) }}</span>
              </label>
            </div>
          </fieldset>

          <div class="field-grid">
            <div class="field">
              <label for="w">{{ t("playground.width") }}</label>
              <input
                id="w"
                v-model.number="width"
                type="number"
                min="120"
                max="1024"
              />
            </div>
            <div class="field">
              <label for="h">{{ t("playground.height") }}</label>
              <input
                id="h"
                v-model.number="height"
                type="number"
                min="120"
                max="1024"
              />
            </div>
          </div>

          <button type="button" class="load" @click="applyLoad">
            {{ t("playground.load") }}
          </button>

          <div class="load-feedback">
            <div
              v-if="status.startsWith('loading')"
              class="progress-block"
            >
              <div
                class="progress-track"
                role="progressbar"
                :aria-valuenow="progressPercent"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="progress-fill"
                  :style="{ width: `${progressPercent}%` }"
                />
              </div>
              <p class="progress-meta">{{ stuckHint }}</p>
            </div>
            <p
              v-else-if="status.startsWith('ready')"
              class="load-ok"
            >
              {{ stuckHint }} · {{ status }}
            </p>
            <p v-else-if="status === 'error'" class="error">
              {{ errorText || stuckHint }}
            </p>
            <p v-else class="load-idle">{{ status }}</p>
          </div>
        </div>

        <div
          v-show="activeTab === 'status'"
          role="tabpanel"
          class="tab-panel"
        >
          <p class="stuck">{{ stuckHint }}</p>

          <div class="progress-block">
            <div
              class="progress-track"
              role="progressbar"
              :aria-valuenow="progressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="progress-fill"
                :style="{ width: `${progressPercent}%` }"
              />
            </div>
            <p class="progress-meta">
              {{ progress?.stage ?? "—" }} · {{ progressPercent }}%
              <template
                v-if="
                  progress?.bytesLoaded != null &&
                  progress.bytesTotal != null &&
                  progress.bytesTotal > 0
                "
              >
                · {{ (progress.bytesLoaded / 1024).toFixed(0) }} /
                {{ (progress.bytesTotal / 1024).toFixed(0) }} KB
              </template>
            </p>
          </div>

          <ol class="pipeline">
            <li
              v-for="row in pipelineRows"
              :key="row.id"
              class="pipeline-row"
              :class="row.state"
            >
              <span class="pipeline-mark" aria-hidden="true"/>
              <span class="pipeline-id">{{ row.id }}</span>
              <span class="pipeline-detail">{{ row.detail }}</span>
            </li>
          </ol>

          <dl class="props">
            <div class="prop-row">
              <dt>status</dt>
              <dd class="status">{{ status }}</dd>
            </div>
            <div class="prop-row">
              <dt>session</dt>
              <dd>
                {{
                  sessionState
                    ? `${sessionState.phase} · gen ${sessionState.generation}`
                    : "—"
                }}
              </dd>
            </div>
            <div class="prop-row">
              <dt>renderer</dt>
              <dd>{{ rendererKind }}</dd>
            </div>
            <div class="prop-row">
              <dt>source</dt>
              <dd>{{ appliedSource ?? "—" }}</dd>
            </div>
            <div class="prop-row">
              <dt>load</dt>
              <dd>
                {{
                  loadElapsedMs != null
                    ? `${loadElapsedMs.toFixed(0)} ms`
                    : "—"
                }}
              </dd>
            </div>
          </dl>

          <h3>{{ t("playground.profileHeading") }}</h3>
          <p class="muted profile-hint">{{ t("playground.profileHint") }}</p>
          <dl v-if="profileRows.length" class="props profile-grid">
            <div
              v-for="row in profileRows"
              :key="row.key"
              class="prop-row"
            >
              <dt>{{ row.key }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
          <p v-else class="muted">{{ t("playground.profileEmpty") }}</p>

          <p v-if="errorText" class="error">{{ errorText }}</p>
        </div>

        <div
          v-show="activeTab === 'properties'"
          role="tabpanel"
          class="tab-panel tab-panel--props"
        >
          <template v-if="modelInfo">
            <h3>{{ t("playground.modelHeading") }}</h3>
            <dl class="props">
              <div v-for="row in propertyRows" :key="row.key" class="prop-row">
                <dt>{{ row.key }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>

            <h3>{{ t("playground.motionsHeading") }}</h3>
            <ul v-if="motionGroupEntries.length" class="list motion-list">
              <li v-for="g in motionGroupEntries" :key="g.name">
                <strong>{{ g.name }}</strong>
                ({{ g.count }})
                <ul class="motion-files">
                  <li v-for="m in g.files" :key="`${g.name}-${m.index}`">
                    <button
                      type="button"
                      class="motion-play"
                      @click="playMotion(g.name, m.index)"
                    >
                      {{ t("playground.playMotion") }}
                    </button>
                    <span class="muted mono">{{ m.file }}</span>
                  </li>
                </ul>
              </li>
            </ul>
            <p v-else class="muted">{{ t("playground.noMotions") }}</p>

            <h3>{{ t("playground.paramsHeading") }}</h3>
            <div v-if="parameters.length" class="param-list">
              <div
                v-for="p in parameters"
                :key="p.id"
                class="param-row"
              >
                <label :for="`param-${p.id}`">
                  <span class="param-id">{{ p.id }}</span>
                  <span class="param-val">{{
                      (paramOverrides[p.id] ?? p.value).toFixed(2)
                    }}</span>
                </label>
                <input
                  :id="`param-${p.id}`"
                  type="range"
                  :min="p.min"
                  :max="p.max"
                  step="0.01"
                  :value="paramOverrides[p.id] ?? p.value"
                  @input="
                    onParamInput(
                      p.id,
                      Number(($event.target as HTMLInputElement).value),
                    )
                  "
                />
              </div>
            </div>
            <p v-else class="muted">{{ t("playground.paramsEmpty") }}</p>
          </template>
          <p v-else class="muted">{{ t("playground.propsEmpty") }}</p>
        </div>
      </section>

      <section class="stage">
        <div class="stage-toolbar">
          <div><span class="stage-dot"></span><strong>LIVE SESSION</strong><small>{{ rendererKind }} · {{
              status
            }}</small></div>
          <div class="stage-toolbar-actions"><span>{{ width }} × {{ height }}</span></div>
        </div>
        <Live2D
          v-if="appliedSource"
          ref="live2dRef"
          :key="`${appliedSource}|${preferKey}|${width}x${height}`"
          :model="appliedSource"
          :width="width"
          :height="height"
          :prefer="prefer"
          @ready="onReady"
          @error="onError"
          @progress="onProgress"
          @profile="onProfile"
        />
      </section>
    </div>
  </main>
</template>

<style scoped>
.playground {
  max-width: 72rem;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 1.25rem 1.25rem 2rem;
  display: grid;
  gap: 0.85rem;
}

header h1 {
  margin: 0;
  font-size: 1.55rem;
}

.layout {
  display: grid;
  gap: 1rem;
  min-height: 0;
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
    align-items: start;
  }

  .panel {
    max-height: calc(100dvh - 5.25rem);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .stage {
    position: sticky;
    top: 4.25rem;
    align-self: start;
  }
}

.panel,
.stage {
  background: #fff;
  border: 1px solid #d7e0ee;
  padding: 0.75rem 0.95rem 0.95rem;
}

.stage {
  display: grid;
  place-items: center;
  min-height: 20rem;
}

.panel {
  text-align: left;
  display: grid;
  gap: 0.65rem;
  align-content: start;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-bottom: 1px solid #d7e0ee;
  margin: 0 -0.15rem;
  padding: 0 0.15rem 0.55rem;
}

.tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: #40506a;
  font: inherit;
  font-size: 0.88rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tab.active {
  color: #1b3a6b;
  border-bottom-color: #1b3a6b;
  font-weight: 600;
}

.tab-panel {
  display: grid;
  gap: 0.65rem;
}

.tab-panel h3 {
  margin: 0.15rem 0 0;
  font-size: 0.88rem;
  color: #1b3a6b;
}

.tab-panel--props {
  gap: 0.45rem;
}

.tab-panel--props h3 {
  margin: 0.55rem 0 0;
  font-size: 0.82rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #5a6b84;
}

.tab-panel--props h3:first-child {
  margin-top: 0;
}

.modes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.modes label,
.check {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.9rem;
}

.field,
.field-grid {
  display: grid;
  gap: 0.35rem;
}

.field-grid {
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.npm-fields {
  display: grid;
  gap: 0.75rem;
}

.field-hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: #5a6b84;
}

input.mono,
code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

input.mono {
  font-size: 0.82rem;
}

.param-list {
  display: grid;
  gap: 0.28rem;
  margin: 0;
  padding: 0.15rem 0 0.25rem;
}

.param-row {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.param-row label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.72rem;
  line-height: 1.25;
  color: #40506a;
}

.param-id {
  font-family: ui-monospace, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.param-val {
  flex: none;
  font-variant-numeric: tabular-nums;
  color: #5a6b84;
}

label {
  font-size: 0.85rem;
  color: #40506a;
}

input[type="text"],
input[type="url"],
input[type="number"],
select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.65rem;
  border: 1px solid #c5d0e0;
  font: inherit;
}

input[type="range"] {
  width: 100%;
  height: 1.05rem;
  margin: 0;
  padding: 0;
  accent-color: #1b3a6b;
}

.resolved {
  margin: 0;
  font-size: 0.82rem;
  color: #40506a;
  word-break: break-all;
}

.renderer-field {
  margin: 0;
  padding: 0;
  border: 0;
  display: grid;
  gap: 0.45rem;
}

.renderer-field legend {
  padding: 0;
  font-size: 0.85rem;
  color: #40506a;
}

.renderer-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.renderer-card {
  position: relative;
  display: grid;
  gap: 0.2rem;
  align-content: start;
  margin: 0;
  padding: 0.65rem 0.55rem;
  border: 1px solid #c5d0e0;
  background: #fff;
  cursor: pointer;
  color: #40506a;
  transition: border-color 140ms ease,
  background 140ms ease,
  color 140ms ease;
}

.renderer-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.renderer-card__name {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.86rem;
  font-weight: 600;
  color: #1b2433;
}

.renderer-card__blurb {
  font-size: 0.72rem;
  line-height: 1.35;
  color: #5a6b84;
}

.renderer-card:hover {
  border-color: #1b3a6b;
}

.renderer-card.active {
  border-color: #1b3a6b;
  background: color-mix(in srgb, #1b3a6b 8%, #fff);
}

.renderer-card.active .renderer-card__name {
  color: #1b3a6b;
}

@media (max-width: 520px) {
  .renderer-cards {
    grid-template-columns: 1fr;
  }
}

.load {
  justify-self: start;
  padding: 0.55rem 1rem;
  border: 1px solid #1b3a6b;
  background: #1b3a6b;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.load-feedback {
  display: grid;
  gap: 0.35rem;
}

.load-ok {
  margin: 0;
  font-size: 0.85rem;
  color: #2f4f2f;
  font-family: ui-monospace, Consolas, monospace;
  word-break: break-all;
}

.load-idle {
  margin: 0;
  font-size: 0.82rem;
  color: #5a6b84;
  font-family: ui-monospace, Consolas, monospace;
}

.stuck {
  margin: 0;
  font: 600 0.95rem/1.35 ui-sans-serif, system-ui, sans-serif;
  color: #1b3a6b;
}

.progress-block {
  display: grid;
  gap: 0.35rem;
}

.progress-track {
  height: 0.5rem;
  border-radius: 999px;
  background: #e3eaf5;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #1b3a6b;
  transition: width 80ms linear;
}

.progress-meta {
  margin: 0;
  font-size: 0.82rem;
  color: #40506a;
}

.profile-hint {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
}

.pipeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.pipeline-row {
  display: grid;
  grid-template-columns: 0.7rem 6.5rem 1fr;
  gap: 0.45rem;
  align-items: baseline;
  font-size: 0.82rem;
  color: #8a96a8;
}

.pipeline-mark {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #d0d8e6;
  margin-top: 0.2rem;
}

.pipeline-row.done {
  color: #2f4f2f;
}

.pipeline-row.done .pipeline-mark {
  background: #3d8b5a;
}

.pipeline-row.active {
  color: #1b3a6b;
  font-weight: 600;
}

.pipeline-row.active .pipeline-mark {
  background: #1b3a6b;
  box-shadow: 0 0 0 3px color-mix(in srgb, #1b3a6b 22%, transparent);
}

.pipeline-row.error {
  color: #a11;
  font-weight: 600;
}

.pipeline-row.error .pipeline-mark {
  background: #a11;
}

.pipeline-id {
  font-family: ui-monospace, Consolas, monospace;
}

.pipeline-detail {
  word-break: break-all;
  color: inherit;
  opacity: 0.85;
  font-weight: 400;
}

.status {
  margin: 0;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.85rem;
}

.error {
  color: #a11;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.props {
  margin: 0;
  display: grid;
  gap: 0.28rem;
}

.prop-row {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 0.4rem;
  font-size: 0.78rem;
  line-height: 1.35;
}

.prop-row dt {
  margin: 0;
  color: #5a6b84;
}

.prop-row dd {
  margin: 0;
  word-break: break-all;
  color: #1b2433;
}

.list {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.82rem;
}

.motion-files {
  margin: 0.35rem 0 0;
  padding-left: 0;
  list-style: none;
  display: grid;
  gap: 0.3rem;
}

.motion-files li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.motion-play {
  appearance: none;
  border: 1px solid #9fc3dc;
  background: #eef7fc;
  color: #1a5f8a;
  font: inherit;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  cursor: pointer;
}

.motion-play:hover {
  border-color: #1677c8;
  color: #0f4f78;
}

.mono {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.75rem;
}

.muted {
  margin: 0;
  color: #5a6b84;
  font-size: 0.85rem;
}
</style>

<style scoped>
.playground {
  max-width: 86rem;
  padding: 2.25rem max(1.25rem, 3vw) 3rem;
  gap: 1.25rem;
  background: #f8fcff;
}

.playground > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid #cfe3f1;
}

.playground > header h1 {
  color: #172a49;
  font: 700 clamp(1.8rem, 3vw, 2.5rem)/1 var(--font-display);
  letter-spacing: 0;
}

.layout {
  grid-template-columns: minmax(20rem, 25rem) minmax(0, 1fr);
  gap: 1.25rem;
}

.panel, .stage {
  border: 1px solid #c9dfef;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(37, 92, 128, 0.07);
}

.panel {
  padding: 0.8rem;
}

.tabs {
  gap: 0.3rem;
  border: 0;
  background: #edf7fd;
  border-radius: 7px;
  padding: 0.25rem;
  margin: 0;
}

.tab {
  flex: 1;
  border: 0;
  border-radius: 5px;
  margin: 0;
  color: #52708b;
  padding: 0.55rem 0.45rem;
}

.tab.active {
  background: #ffffff;
  border: 1px solid #c5e0f1;
  color: #176ea8;
  box-shadow: 0 2px 6px rgba(37, 92, 128, 0.08);
}

.stage {
  min-height: 36rem;
  padding: 0.8rem;
  display: grid;
  align-content: start;
  gap: 0.75rem;
  background: #eef8ff;
}

.stage-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.4rem 0.2rem;
  color: #2e6a90;
  font: 650 0.72rem/1 var(--font-display);
}

.stage-toolbar > div:first-child {
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.25rem 0.4rem;
  align-items: center;
}

.stage-toolbar small {
  grid-column: 2;
  color: #7695aa;
  font-weight: 500;
}

.stage-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #55d6be;
  grid-row: span 2;
}

.stage-toolbar-actions {
  display: flex;
  gap: 0.35rem;
}

.stage-toolbar-actions span {
  padding: 0.3rem 0.45rem;
  border: 1px solid #c1dceb;
  background: #ffffff;
  color: #52708b;
}

.stage :deep(canvas) {
  width: min(100%, 42rem) !important;
  height: auto !important;
  aspect-ratio: 1;
  justify-self: center;
  background: #ffffff;
  border: 1px solid #c9dfef;
  box-shadow: 12px 12px 0 #d8effc;
}

.field input, .field select, .field-grid input, .field-grid select {
  border-color: #c5ddea;
  border-radius: 5px;
  background: #fbfdff;
}

.renderer-card {
  border-color: #c5ddea;
  border-radius: 6px;
}

.renderer-card.active {
  border-color: #48a3d6;
  background: #eef9ff;
}

.load {
  border-color: #1677c8;
  border-radius: 5px;
  background: #1677c8;
  box-shadow: 3px 3px 0 #b8b5f4;
}

.progress-track {
  border-radius: 4px;
  background: #e3f0f8;
}

.progress-fill {
  border-radius: 4px;
  background: #48a3d6;
}

.prop-row {
  grid-template-columns: 5.25rem 1fr;
  padding: 0.22rem 0;
  border-bottom: 1px solid #edf3f7;
}

.prop-row dd {
  color: #27425e;
}

.tab-panel--props h3 {
  color: #2676a6;
  font: 700 0.78rem/1 var(--font-display);
  letter-spacing: 0;
  text-transform: none;
}

@media (max-width: 959px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .stage {
    order: -1;
    min-height: 25rem;
  }

  .panel {
    max-height: none;
  }
}

@media (max-width: 560px) {
  .playground {
    padding-inline: 0.8rem;
  }

  .playground > header {
    display: block;
  }

  .stage-toolbar-actions {
    display: none;
  }
}
</style>

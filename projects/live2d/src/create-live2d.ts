import type {
    AssetResolver,
    FrameSnapshot,
    InternalModel,
    Live2DSession,
    LoadProgress,
    ModelSource,
    SessionPhase,
    SessionState,
} from "@doki-land/live2d-core";
import { EventEmitter, modelSourceUrl } from "@doki-land/live2d-core";
import {
    createUrlAssetResolver,
    fetchModelJson,
    normalizeModelSettings,
    resolveModelSourceUrl,
} from "@doki-land/live2d-loader";
import type {
    ModelBackend,
    ParameterBinding,
    Renderer,
    RendererKind,
    TextureData,
} from "@doki-land/live2d-renderer";
import {
    createMoc2Backend,
    createMoc3Backend,
    createRenderer,
    selectModelBackend,
} from "@doki-land/live2d-renderer";
import { loadTextureData, releaseTextureData } from "./load-textures.js";

export interface CreateLive2DOptions {
    backends?: ModelBackend[];
    /** Defaults to `createRenderer({ prefer })` (async fallback on initialize). */
    renderer?: Renderer;
    /**
     * Renderer try order when `renderer` is omitted.
     * Default: `["webgpu", "webgl2", "canvas2d"]`.
     */
    prefer?: RendererKind[];
}

export interface Live2DRuntime extends Live2DSession {
    readonly renderer: Renderer;
    readonly backends: readonly ModelBackend[];

    setParameter(id: string, value: number): void;

    listParameters(): readonly ParameterBinding[];

    /** Hit-test the current model in normalized canvas coordinates (-1..1). */
    hitTest(x: number, y: number): string | null;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Wire moc backends and a renderer into one session. */
export function createLive2D(options: CreateLive2DOptions = {}): Live2DRuntime {
    const backends = options.backends ?? [
        createMoc2Backend(),
        createMoc3Backend(),
    ];
    const renderer =
        options.renderer ?? createRenderer({ prefer: options.prefer });
    const events = new EventEmitter();

    let canvas: HTMLCanvasElement | null = null;
    let model: InternalModel | null = null;
    let activeBackend: ModelBackend | null = null;
    let drawPass: ReturnType<Renderer["createModelDrawPass"]> | null = null;
    let loadedTextures: TextureData[] = [];
    let initPromise: Promise<void> | null = null;
    let phase: SessionPhase = "idle";
    let lastError: unknown | null = null;
    let generation = 0;
    let loadGeneration = 0;
    let fpsSmooth = 0;

    const clearTextures = () => {
        if (loadedTextures.length > 0) {
            releaseTextureData(loadedTextures);
            loadedTextures = [];
        }
        drawPass?.setTextures([]);
    };

    const setPhase = (next: SessionPhase) => {
        phase = next;
        events.emit("phase", { phase, generation });
    };

    const report = (payload: LoadProgress) => {
        events.emit("progress", payload);
    };

    const state = (): SessionState => ({
        phase,
        lastError,
        generation,
    });

    const ensureInitialized = async (): Promise<void> => {
        if (!canvas) {
            throw new Error(
                "@doki-land/live2d: call mount(canvas) before loadModel",
            );
        }
        if (!initPromise) {
            setPhase("mounting");
            const gen = generation;
            initPromise = renderer
                .initialize(canvas)
                .then(() => {
                    if (gen !== generation) return;
                    drawPass = renderer.createModelDrawPass();
                    setPhase("ready");
                })
                .catch((err) => {
                    lastError = err;
                    setPhase("error");
                    events.emit("error", { error: err });
                    throw err;
                });
        }
        await initPromise;
    };

    const runtime: Live2DRuntime = {
        events,
        backends,
        renderer,
        get model() {
            return model;
        },
        get state() {
            return state();
        },
        mount(target) {
            generation += 1;
            canvas = target;
            initPromise = null;
            clearTextures();
            drawPass?.destroy();
            drawPass = null;
            setPhase("idle");
            void ensureInitialized();
        },
        async loadModel(source: ModelSource, resolver?: AssetResolver) {
            const gen = ++loadGeneration;
            setPhase("loading");
            report({
                stage: "mounting",
                progress: 0.01,
                detail: "initialize renderer",
            });
            await ensureInitialized();
            if (gen !== loadGeneration) {
                throw new Error("@doki-land/live2d: load cancelled");
            }
            report({
                stage: "resolve",
                progress: 0.02,
                detail: "resolve source",
            });
            try {
                let json: unknown;
                let baseUrl: string;
                let settingsUrl: string;

                if (typeof source === "object" && source.kind === "json") {
                    json = source.json;
                    baseUrl = source.baseUrl;
                    settingsUrl = source.baseUrl;
                    report({
                        stage: "settings",
                        progress: 0.2,
                        detail: "inline settings",
                    });
                } else {
                    const raw =
                        typeof source === "string"
                            ? source
                            : source.kind === "npm"
                              ? modelSourceUrl(source)
                              : source.url;
                    const cdnBase =
                        typeof source === "object" && source.kind === "npm"
                            ? source.cdnBase
                            : undefined;
                    const fetchUrl = resolveModelSourceUrl(raw, {
                        npmCdnBase: cdnBase,
                    });
                    report({
                        stage: "settings",
                        progress: 0.05,
                        detail: fetchUrl,
                    });
                    json = await fetchModelJson(fetchUrl, (u) => {
                        const ratio =
                            u.bytesTotal && u.bytesTotal > 0
                                ? u.bytesLoaded / u.bytesTotal
                                : 0;
                        report({
                            stage: "settings",
                            progress: lerp(0.05, 0.22, ratio),
                            detail: fetchUrl,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    });
                    baseUrl = fetchUrl;
                    settingsUrl = fetchUrl;
                }
                if (gen !== loadGeneration) {
                    throw new Error("@doki-land/live2d: load cancelled");
                }

                const settings = normalizeModelSettings(json, settingsUrl);
                report({
                    stage: "moc",
                    progress: 0.25,
                    detail: settings.moc,
                });

                const assetResolver =
                    resolver ??
                    createUrlAssetResolver(baseUrl, {
                        onBytesProgress: (key, u) => {
                            const isMoc = key === settings.moc;
                            const ratio =
                                u.bytesTotal && u.bytesTotal > 0
                                    ? u.bytesLoaded / u.bytesTotal
                                    : 0;
                            if (isMoc) {
                                report({
                                    stage: "moc",
                                    progress: lerp(0.25, 0.8, ratio),
                                    detail: key,
                                    bytesLoaded: u.bytesLoaded,
                                    bytesTotal: u.bytesTotal,
                                });
                            } else {
                                report({
                                    stage: "textures",
                                    progress: lerp(0.8, 0.9, ratio),
                                    detail: key,
                                    bytesLoaded: u.bytesLoaded,
                                    bytesTotal: u.bytesTotal,
                                });
                            }
                        },
                    });

                const backend = selectModelBackend(backends, json);
                report({
                    stage: "decode",
                    progress: 0.85,
                    detail: `decode ${settings.format}`,
                });
                const next = await backend.createModel(settings, {
                    renderer,
                    resolver: assetResolver,
                });
                if (gen !== loadGeneration) {
                    backend.destroyModel(next);
                    throw new Error("@doki-land/live2d: load cancelled");
                }

                clearTextures();
                if (settings.textures.length > 0 && drawPass) {
                    report({
                        stage: "textures",
                        progress: 0.88,
                        detail: `${settings.textures.length} textures`,
                    });
                    const textures = await loadTextureData(
                        assetResolver,
                        settings.textures,
                        {
                            onProgress: (u) => {
                                const ratio =
                                    u.total > 0 ? (u.index + 1) / u.total : 1;
                                report({
                                    stage: "textures",
                                    progress: lerp(0.88, 0.96, ratio),
                                    detail: u.key,
                                    bytesLoaded: u.bytesLoaded,
                                    bytesTotal: u.bytesTotal,
                                });
                            },
                        },
                    );
                    if (gen !== loadGeneration) {
                        releaseTextureData(textures);
                        backend.destroyModel(next);
                        throw new Error("@doki-land/live2d: load cancelled");
                    }
                    loadedTextures = textures;
                    drawPass.setTextures(textures);
                }

                if (model && activeBackend) {
                    activeBackend.destroyModel(model);
                }
                model = next;
                activeBackend = backend;
                lastError = null;
                setPhase("live");
                report({
                    stage: "ready",
                    progress: 1,
                    detail: model.id,
                });
                events.emit("ready", { modelId: model.id });
                return model;
            } catch (err) {
                lastError = err;
                setPhase("error");
                events.emit("error", { error: err });
                throw err;
            }
        },
        captureFrame(): FrameSnapshot | null {
            if (!model || !activeBackend?.captureFrame) return null;
            return activeBackend.captureFrame(model);
        },
        setParameter(id, value) {
            if (!model || !activeBackend?.setParameter) return;
            activeBackend.setParameter(model, id, value);
        },
        hitTest(x, y) {
            if (!model || !activeBackend) return null;
            const drawables = activeBackend.getDrawables(model);
            for (let n = drawables.length - 1; n >= 0; n -= 1) {
                const d = drawables[n]!;
                if (!d.visible || d.opacity <= 0) continue;
                const p = d.vertexPositions;
                const idx = d.indices;
                for (let i = 0; i + 2 < idx.length; i += 3) {
                    const a = idx[i]! * 2,
                        b = idx[i + 1]! * 2,
                        c = idx[i + 2]! * 2;
                    const ax = p[a]!,
                        ay = p[a + 1]!;
                    const bx = p[b]!,
                        by = p[b + 1]!;
                    const cx = p[c]!,
                        cy = p[c + 1]!;
                    const s = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
                    const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
                    const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
                    if (
                        (s >= 0 && s1 >= 0 && s2 >= 0) ||
                        (s <= 0 && s1 <= 0 && s2 <= 0)
                    ) {
                        return `drawable:${d.index}`;
                    }
                }
            }
            return null;
        },
        listParameters() {
            if (!model || !activeBackend?.listParameters) return [];
            return activeBackend.listParameters(model);
        },
        update(deltaTimeSeconds) {
            if (!model || !activeBackend || !drawPass) return;
            if (phase !== "live") return;

            const t0 = nowMs();
            activeBackend.updateModel(model, deltaTimeSeconds);
            const drawables = activeBackend.getDrawables(model);
            const t1 = nowMs();

            renderer.beginFrame();
            drawPass.draw(drawables, new Float32Array(16));
            renderer.endFrame();
            const t2 = nowMs();

            let vertexCount = 0;
            let indexCount = 0;
            for (const d of drawables) {
                vertexCount += d.vertexPositions.length / 2;
                indexCount += d.indices.length;
            }

            const frameMs = t2 - t0;
            const evaluateMs = t1 - t0;
            const drawMs = t2 - t1;
            const fps = deltaTimeSeconds > 0 ? 1 / deltaTimeSeconds : 0;
            fpsSmooth = fpsSmooth <= 0 ? fps : fpsSmooth * 0.85 + fps * 0.15;

            events.emit("profile", {
                fps,
                fpsSmooth,
                frameMs,
                evaluateMs,
                drawMs,
                drawableCount: drawables.length,
                vertexCount,
                indexCount,
            });
        },
        destroy() {
            loadGeneration += 1;
            generation += 1;
            if (model && activeBackend) {
                activeBackend.destroyModel(model);
            }
            model = null;
            activeBackend = null;
            clearTextures();
            drawPass?.destroy();
            drawPass = null;
            initPromise = null;
            renderer.destroy();
            canvas = null;
            setPhase("destroyed");
            events.clear();
        },
    };

    return runtime;
}

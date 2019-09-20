import type {
    AssetResolver,
    InternalModel,
    LoadProgress,
    ModelSource,
} from "@doki-land/live2d-core";
import { modelSourceUrl } from "@doki-land/live2d-core";
import {
    createUrlAssetResolver,
    fetchModelJson,
    normalizeModelSettings,
    resolveModelSourceUrl,
} from "@doki-land/live2d-loader";
import type {
    DrawableMesh,
    ModelBackend,
    ParameterBinding,
    Renderer,
    TextureData,
} from "@doki-land/live2d-renderer";
import { selectModelBackend } from "@doki-land/live2d-renderer";
import { loadTextureData, releaseTextureData } from "../load-textures.js";
import {
    type Motion3Clip,
    MotionPlayer,
    MotionPriority,
    type PlayMotionOptions,
    parseMotion3,
} from "../motion/index.js";

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}

export interface ActorModelSlotOptions {
    backends: readonly ModelBackend[];
    renderer: Renderer;
    onProgress?: (payload: LoadProgress) => void;
    onMotionStart?: (payload: {
        group: string;
        index: number;
        slot: string;
    }) => void;
    onMotionFinish?: (payload: {
        group: string;
        index: number;
        slot: string;
    }) => void;
}

/** One loaded model + draw pass owned by an actor (not a renderer). */
export class ActorModelSlot {
    readonly #backends: readonly ModelBackend[];
    readonly #renderer: Renderer;
    readonly #onProgress?: (payload: LoadProgress) => void;
    readonly #motionPlayer: MotionPlayer;
    readonly #motionCache = new Map<string, Motion3Clip>();

    #drawPass: ReturnType<Renderer["createModelDrawPass"]> | null = null;
    #model: InternalModel | null = null;
    #backend: ModelBackend | null = null;
    #textures: TextureData[] = [];
    #resolver: AssetResolver | null = null;
    #loadGeneration = 0;

    constructor(options: ActorModelSlotOptions) {
        this.#backends = options.backends;
        this.#renderer = options.renderer;
        this.#onProgress = options.onProgress;
        this.#motionPlayer = new MotionPlayer({
            onStart: options.onMotionStart,
            onFinish: options.onMotionFinish,
        });
    }

    get model(): InternalModel | null {
        return this.#model;
    }

    get drawPass(): ReturnType<Renderer["createModelDrawPass"]> | null {
        return this.#drawPass;
    }

    ensureDrawPass(): ReturnType<Renderer["createModelDrawPass"]> {
        if (!this.#drawPass) {
            this.#drawPass = this.#renderer.createModelDrawPass();
        }
        return this.#drawPass;
    }

    #report(payload: LoadProgress): void {
        this.#onProgress?.(payload);
    }

    #clearTextures(): void {
        if (this.#textures.length > 0) {
            releaseTextureData(this.#textures);
            this.#textures = [];
        }
        this.#drawPass?.setTextures([]);
    }

    #applyMotionSamples(samples: ReturnType<MotionPlayer["update"]>): void {
        if (!this.#model || !this.#backend) return;
        for (const s of samples) {
            if (s.weight <= 0) continue;
            if (s.target === "PartOpacity") {
                if (!this.#backend.setPartOpacity) continue;
                if (s.weight >= 1) {
                    this.#backend.setPartOpacity(this.#model, s.id, s.value);
                } else {
                    const cur = 1;
                    this.#backend.setPartOpacity(
                        this.#model,
                        s.id,
                        cur + (s.value - cur) * s.weight,
                    );
                }
                continue;
            }
            if (s.target !== "Parameter" || !this.#backend.setParameter)
                continue;
            if (s.weight >= 1) {
                this.#backend.setParameter(this.#model, s.id, s.value);
                continue;
            }
            const cur =
                this.#backend
                    .listParameters?.(this.#model)
                    .find((p) => p.id === s.id)?.value ?? s.value;
            this.#backend.setParameter(
                this.#model,
                s.id,
                cur + (s.value - cur) * s.weight,
            );
        }
    }

    async load(
        source: ModelSource,
        resolver?: AssetResolver,
    ): Promise<InternalModel> {
        const gen = ++this.#loadGeneration;
        this.#report({
            stage: "mounting",
            progress: 0.01,
            detail: "prepare draw pass",
        });
        const drawPass = this.ensureDrawPass();

        this.#report({
            stage: "resolve",
            progress: 0.02,
            detail: "resolve source",
        });

        let json: unknown;
        let baseUrl: string;
        let settingsUrl: string;

        if (typeof source === "object" && source.kind === "json") {
            json = source.json;
            baseUrl = source.baseUrl;
            settingsUrl = source.baseUrl;
            this.#report({
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
            this.#report({
                stage: "settings",
                progress: 0.05,
                detail: fetchUrl,
            });
            json = await fetchModelJson(fetchUrl, (u) => {
                const ratio =
                    u.bytesTotal && u.bytesTotal > 0
                        ? u.bytesLoaded / u.bytesTotal
                        : 0;
                this.#report({
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
        if (gen !== this.#loadGeneration) {
            throw new Error("@doki-land/live2d: load cancelled");
        }

        const settings = normalizeModelSettings(json, settingsUrl);
        this.#report({
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
                        this.#report({
                            stage: "moc",
                            progress: lerp(0.25, 0.8, ratio),
                            detail: key,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    } else {
                        this.#report({
                            stage: "textures",
                            progress: lerp(0.8, 0.9, ratio),
                            detail: key,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    }
                },
            });
        this.#resolver = assetResolver;
        this.#motionPlayer.clear();
        this.#motionCache.clear();

        const backend = selectModelBackend([...this.#backends], json);
        this.#report({
            stage: "decode",
            progress: 0.85,
            detail: `decode ${settings.format}`,
        });
        const next = await backend.createModel(settings, {
            renderer: this.#renderer,
            resolver: assetResolver,
        });
        if (gen !== this.#loadGeneration) {
            backend.destroyModel(next);
            throw new Error("@doki-land/live2d: load cancelled");
        }

        this.#clearTextures();
        if (settings.textures.length > 0) {
            this.#report({
                stage: "textures",
                progress: 0.88,
                detail: `${settings.textures.length} textures`,
            });
            const textures = await loadTextureData(
                assetResolver,
                settings.textures,
                {
                    onProgress: (u) => {
                        const ratio = u.total > 0 ? (u.index + 1) / u.total : 1;
                        this.#report({
                            stage: "textures",
                            progress: lerp(0.88, 0.96, ratio),
                            detail: u.key,
                            bytesLoaded: u.bytesLoaded,
                            bytesTotal: u.bytesTotal,
                        });
                    },
                },
            );
            if (gen !== this.#loadGeneration) {
                releaseTextureData(textures);
                backend.destroyModel(next);
                throw new Error("@doki-land/live2d: load cancelled");
            }
            this.#textures = textures;
            drawPass.setTextures(textures);
        }

        if (this.#model && this.#backend) {
            this.#backend.destroyModel(this.#model);
        }
        this.#model = next;
        this.#backend = backend;
        this.#report({
            stage: "ready",
            progress: 1,
            detail: next.id,
        });
        return next;
    }

    setParameter(id: string, value: number): void {
        if (!this.#model || !this.#backend?.setParameter) return;
        this.#backend.setParameter(this.#model, id, value);
    }

    listParameters(): readonly ParameterBinding[] {
        if (!this.#model || !this.#backend?.listParameters) return [];
        return this.#backend.listParameters(this.#model);
    }

    listMotionGroups(): Record<
        string,
        readonly import("@doki-land/live2d-core").MotionDefinition[]
    > {
        return this.#model?.settings.motionGroups ?? {};
    }

    async playMotion(
        group: string,
        index = 0,
        options: PlayMotionOptions = {},
    ): Promise<boolean> {
        if (!this.#model || !this.#resolver) return false;
        const list = this.#model.settings.motionGroups[group];
        const def = list?.[index];
        if (!def) return false;

        let clip = this.#motionCache.get(def.file);
        if (!clip) {
            const json = await this.#resolver.fetchJson(def.file);
            clip = parseMotion3(json);
            this.#motionCache.set(def.file, clip);
        }

        const fadeInTime =
            options.fadeInTime ?? def.fadeInTime ?? clip.fadeInTime;
        const fadeOutTime =
            options.fadeOutTime ?? def.fadeOutTime ?? clip.fadeOutTime;

        return this.#motionPlayer.start(group, index, clip, {
            priority: options.priority ?? MotionPriority.normal,
            slot: options.slot,
            queue: options.queue,
            loop: options.loop,
            fadeInTime,
            fadeOutTime,
        });
    }

    stopMotion(opts?: { fade?: boolean; slot?: string }): void {
        this.#motionPlayer.stop(opts?.fade !== false, opts?.slot);
    }

    listPlayingMotions(): ReadonlyArray<{
        slot: string;
        group: string;
        index: number;
        time: number;
        priority: number;
    }> {
        return this.#motionPlayer.listPlaying();
    }

    update(deltaTimeSeconds: number): DrawableMesh[] | null {
        if (!this.#model || !this.#backend || !this.#drawPass) return null;
        this.#applyMotionSamples(this.#motionPlayer.update(deltaTimeSeconds));
        this.#backend.updateModel(this.#model, deltaTimeSeconds);
        return this.#backend.getDrawables(this.#model);
    }

    hitTestModelCoords(modelX: number, modelY: number): string | null {
        if (!this.#model || !this.#backend) return null;
        const drawables = this.#backend.getDrawables(this.#model);
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
                const s = (ax - cx) * (modelY - cy) - (ay - cy) * (modelX - cx);
                const s1 =
                    (bx - ax) * (modelY - ay) - (by - ay) * (modelX - ax);
                const s2 =
                    (cx - bx) * (modelY - by) - (cy - by) * (modelX - bx);
                if (
                    (s >= 0 && s1 >= 0 && s2 >= 0) ||
                    (s <= 0 && s1 <= 0 && s2 <= 0)
                ) {
                    const hitArea = this.#model.settings.hitAreas.find(
                        (h) => h.id === `D_${d.index}` || h.id === `${d.index}`,
                    );
                    return hitArea?.name ?? `drawable:${d.index}`;
                }
            }
        }
        return null;
    }

    destroy(): void {
        this.#loadGeneration += 1;
        this.#motionPlayer.clear();
        this.#motionCache.clear();
        this.#resolver = null;
        if (this.#model && this.#backend) {
            this.#backend.destroyModel(this.#model);
        }
        this.#model = null;
        this.#backend = null;
        this.#clearTextures();
        this.#drawPass?.destroy();
        this.#drawPass = null;
    }
}

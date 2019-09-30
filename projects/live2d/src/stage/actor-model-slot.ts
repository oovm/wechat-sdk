import type {
    AssetResolver,
    InternalModel,
    LoadProgress,
    ModelAsset,
    ModelSource,
} from "@doki-land/live2d-core";
import type {
    DrawableMesh,
    ModelBackend,
    ParameterBinding,
    Renderer,
} from "@doki-land/live2d-renderer";
import {
    MotionPlayer,
    MotionPriority,
    type PlayMotionOptions,
    parseMotion3,
} from "../motion/index.js";
import type {
    ModelAssetLease,
    ModelAssetRegistry,
} from "./model-asset-registry.js";

type ModelDrawPass = ReturnType<Renderer["createModelDrawPass"]>;

export interface ActorModelSlotOptions {
    assets: ModelAssetRegistry;
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
    readonly #assets: ModelAssetRegistry;
    readonly #renderer: Renderer;
    readonly #onProgress?: (payload: LoadProgress) => void;
    readonly #motionPlayer: MotionPlayer;

    #drawPass: ModelDrawPass | null = null;
    #model: InternalModel | null = null;
    #backend: ModelBackend | null = null;
    #lease: ModelAssetLease | null = null;
    #loadGeneration = 0;

    constructor(options: ActorModelSlotOptions) {
        this.#assets = options.assets;
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

    get drawPass(): ModelDrawPass | null {
        return this.#drawPass;
    }

    ensureDrawPass(): ModelDrawPass {
        if (!this.#drawPass) {
            this.#drawPass = this.#renderer.createModelDrawPass();
        }
        return this.#drawPass;
    }

    #report(payload: LoadProgress): void {
        this.#onProgress?.(payload);
    }

    #releaseLease(): void {
        this.#lease?.release();
        this.#lease = null;
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

        const lease = await this.#assets.acquire(source, resolver, (p) =>
            this.#report(p),
        );
        if (gen !== this.#loadGeneration) {
            lease.release();
            throw new Error("@doki-land/live2d: load cancelled");
        }

        return await this.#attachLease(lease, drawPass, gen);
    }

    async loadAsset(asset: ModelAsset): Promise<InternalModel> {
        const gen = ++this.#loadGeneration;
        this.#report({
            stage: "mounting",
            progress: 0.01,
            detail: "prepare draw pass",
        });
        const drawPass = this.ensureDrawPass();

        const lease = this.#assets.acquireExisting(asset);
        if (gen !== this.#loadGeneration) {
            lease.release();
            throw new Error("@doki-land/live2d: load cancelled");
        }

        this.#report({
            stage: "decode",
            progress: 0.85,
            detail: `reuse ${asset.key}`,
        });

        return await this.#attachLease(lease, drawPass, gen);
    }

    async #attachLease(
        lease: ModelAssetLease,
        drawPass: ModelDrawPass,
        gen: number,
    ): Promise<InternalModel> {
        this.#motionPlayer.clear();
        this.#releaseLease();

        const { model, backend } = await lease.createInstance(this.#renderer);
        if (gen !== this.#loadGeneration) {
            backend.destroyModel(model);
            lease.release();
            throw new Error("@doki-land/live2d: load cancelled");
        }

        if (this.#model && this.#backend) {
            this.#backend.destroyModel(this.#model);
        }

        drawPass.setTextures([...lease.textures]);
        this.#lease = lease;
        this.#model = model;
        this.#backend = backend;
        this.#report({
            stage: "ready",
            progress: 1,
            detail: model.id,
        });
        return model;
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
        if (!this.#model || !this.#lease) return false;
        const list = this.#model.settings.motionGroups[group];
        const def = list?.[index];
        if (!def) return false;

        const cache = this.#lease.motionCache;
        let clip = cache.get(def.file);
        if (!clip) {
            const json = await this.#lease.resolver.fetchJson(def.file);
            clip = parseMotion3(json);
            cache.set(def.file, clip);
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
        if (this.#model && this.#backend) {
            this.#backend.destroyModel(this.#model);
        }
        this.#model = null;
        this.#backend = null;
        this.#releaseLease();
        this.#drawPass?.setTextures([]);
        this.#drawPass?.destroy();
        this.#drawPass = null;
    }
}

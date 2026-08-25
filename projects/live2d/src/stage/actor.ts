import type {
    ActorHit,
    ActorTransform,
    CreateActorOptions,
    InternalModel,
    Live2dActor,
    ModelAsset,
    PlayMotionActorOptions,
} from "@doki-land/live2d-core";
import type { DrawableMesh, Renderer } from "@doki-land/live2d-renderer";
import type { PlayMotionOptions } from "../motion/index.js";
import { ActorModelSlot } from "./actor-model-slot.js";
import { focusParameterUpdates } from "./assets/focus.js";
import type { ModelAssetRegistry } from "./model-asset-registry.js";
import {
    resolveActorTransform,
    stageFocusDrag,
    stageToModelNdc,
} from "./transform.js";

let nextActorId = 0;

export interface Live2dActorImplOptions {
    id: string;
    creationIndex: number;
    assets: ModelAssetRegistry;
    renderer: Renderer;
}

export class Live2dActorImpl implements Live2dActor {
    readonly id: string;
    readonly creationIndex: number;
    #transform: ActorTransform;
    #visible = true;
    #opacity = 1;
    #layer = "characters";
    #order = 0;
    #destroyed = false;
    #lastDrawables: DrawableMesh[] | null = null;
    readonly #slot: ActorModelSlot;

    constructor(
        options: CreateActorOptions | undefined,
        shared: Live2dActorImplOptions,
    ) {
        this.id = options?.id ?? shared.id;
        this.creationIndex = shared.creationIndex;
        this.#transform = resolveActorTransform(options?.transform);
        this.#visible = options?.visible ?? true;
        this.#opacity = options?.opacity ?? 1;
        this.#layer = options?.layer ?? "characters";
        this.#order = options?.order ?? 0;
        this.#slot = new ActorModelSlot({
            assets: shared.assets,
            renderer: shared.renderer,
        });
    }

    get model(): InternalModel | null {
        return this.#slot.model;
    }

    get visible(): boolean {
        return this.#visible;
    }

    set visible(value: boolean) {
        this.#visible = value;
    }

    get opacity(): number {
        return this.#opacity;
    }

    set opacity(value: number) {
        this.#opacity = Math.min(1, Math.max(0, value));
    }

    get layer(): string {
        return this.#layer;
    }

    set layer(value: string) {
        this.#layer = value;
    }

    get order(): number {
        return this.#order;
    }

    set order(value: number) {
        this.#order = value;
    }

    getTransform(): ActorTransform {
        return { ...this.#transform };
    }

    setTransform(patch: Partial<ActorTransform>): void {
        this.#transform = resolveActorTransform({
            ...this.#transform,
            ...patch,
        });
    }

    async load(
        source: Parameters<Live2dActor["load"]>[0],
        resolver?: Parameters<Live2dActor["load"]>[1],
    ): Promise<InternalModel> {
        if (this.#destroyed) {
            throw new Error("@doki-land/live2d: actor destroyed");
        }
        return await this.#slot.load(source, resolver);
    }

    async loadAsset(asset: ModelAsset): Promise<InternalModel> {
        if (this.#destroyed) {
            throw new Error("@doki-land/live2d: actor destroyed");
        }
        return await this.#slot.loadAsset(asset);
    }

    setParameter(id: string, value: number): void {
        this.#slot.setParameter(id, value);
    }

    listParameters() {
        return this.#slot.listParameters();
    }

    parameterMap() {
        return this.#slot.parameterMap();
    }

    resolveParameter(id: string) {
        return this.#slot.resolveParameter(id);
    }

    listMotionGroups() {
        return this.#slot.listMotionGroups();
    }

    playMotion(
        group: string,
        index?: number,
        options?: PlayMotionActorOptions,
    ) {
        return this.#slot.playMotion(
            group,
            index,
            options as PlayMotionOptions | undefined,
        );
    }

    stopMotion(opts?: { fade?: boolean; slot?: string }) {
        this.#slot.stopMotion(opts);
    }

    listPlayingMotions() {
        return this.#slot.listPlayingMotions();
    }

    lookAt(stageX: number, stageY: number): void {
        const { dragX, dragY } = stageFocusDrag(
            stageX,
            stageY,
            this.#transform,
        );
        for (const u of focusParameterUpdates(
            this.#slot.parameterMap(),
            dragX,
            dragY,
        )) {
            this.#slot.setParameter(u.id, u.value);
        }
    }

    /** Internal: evaluate motion/physics and cache drawables for render. */
    update(deltaTimeSeconds: number): DrawableMesh[] | null {
        if (!this.#visible || this.#opacity <= 0) {
            this.#lastDrawables = null;
            return null;
        }
        this.#lastDrawables = this.#slot.update(deltaTimeSeconds);
        return this.#lastDrawables;
    }

    get lastDrawables(): DrawableMesh[] | null {
        return this.#lastDrawables;
    }

    get slot(): ActorModelSlot {
        return this.#slot;
    }

    hitTestStage(
        stageX: number,
        stageY: number,
    ): Omit<ActorHit, "actor"> | null {
        if (!this.#visible || this.#opacity <= 0 || !this.#slot.model)
            return null;
        const { modelX, modelY } = stageToModelNdc(
            stageX,
            stageY,
            this.#transform,
        );
        const area = this.#slot.hitTestModelCoords(modelX, modelY);
        if (!area) return null;
        const drawableMatch = /^drawable:(\d+)$/.exec(area);
        return {
            actorId: this.id,
            area,
            drawableIndex: drawableMatch ? Number(drawableMatch[1]) : -1,
            stageX,
            stageY,
            localX: modelX,
            localY: modelY,
        };
    }

    destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.#slot.destroy();
    }
}

export function allocateActorId(prefix = "actor"): string {
    nextActorId += 1;
    return `${prefix}-${nextActorId}`;
}

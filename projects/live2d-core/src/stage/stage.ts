import type { AssetResolver, ModelSource } from "../contracts.js";
import type {
    ExpressionDefinition,
    InternalModel,
    MotionDefinition,
} from "../model/model.js";
import type { ModelAsset } from "../model/model-asset.js";

/** Normalized stage placement for one actor (0,0) top-left → (1,1) bottom-right. */
export interface ActorTransform {
    /** Anchor point X in stage space. */
    x: number;
    /** Anchor point Y in stage space. */
    y: number;
    /** Uniform scale; ignored when `scaleX` / `scaleY` are set. */
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    /** Radians, counter-clockwise. */
    rotation?: number;
    /** Horizontal anchor within the model bounds (0 = left, 1 = right). */
    anchorX?: number;
    /** Vertical anchor within the model bounds (0 = top, 1 = bottom in stage space). */
    anchorY?: number;
}

export const DEFAULT_ACTOR_TRANSFORM: Readonly<ActorTransform> = {
    x: 0.5,
    y: 1,
    scale: 1,
    anchorX: 0.5,
    anchorY: 1,
};

export type PointerTrackingMode =
    | "all"
    | "focused"
    | "hovered"
    | "nearest"
    | "none"
    | "custom";

export interface PointerTrackingPolicy {
    mode: PointerTrackingMode;
    /** Used when `mode` is `custom`. */
    targetActorId?: string;
}

export interface CreateActorOptions {
    id?: string;
    transform?: Partial<ActorTransform>;
    layer?: string;
    order?: number;
    visible?: boolean;
    opacity?: number;
}

export interface ActorHit {
    readonly actor: Live2dActor;
    readonly actorId: string;
    readonly area: string;
    readonly drawableIndex: number;
    readonly stageX: number;
    readonly stageY: number;
    readonly localX: number;
    readonly localY: number;
}

export interface StagePointerEvent {
    readonly actor: Live2dActor | null;
    readonly actorId: string | null;
    readonly area: string | null;
    readonly stageX: number;
    readonly stageY: number;
    readonly clientX: number;
    readonly clientY: number;
    readonly hit: ActorHit | null;
}

export type StageUpdateMode = "auto" | "manual";

export interface CreateLive2dStageOptions {
    updateMode?: StageUpdateMode;
}

export interface PlayMotionActorOptions {
    priority?: number;
    slot?: string;
    queue?: boolean;
    loop?: boolean;
    fadeInTime?: number;
    fadeOutTime?: number;
}

/** Read-only actor surface exposed by the stage. */
export interface Live2dActor {
    readonly id: string;
    readonly model: InternalModel | null;
    readonly visible: boolean;
    readonly opacity: number;
    readonly layer: string;
    readonly order: number;
    readonly creationIndex: number;

    getTransform(): ActorTransform;

    setTransform(patch: Partial<ActorTransform>): void;

    load(source: ModelSource, resolver?: AssetResolver): Promise<InternalModel>;

    /** Attach a stage-cached {@link ModelAsset} without re-fetching resources. */
    loadAsset(asset: ModelAsset): Promise<InternalModel>;

    setParameter(id: string, value: number): void;

    listParameters(): ReadonlyArray<{
        id: string;
        min: number;
        max: number;
        defaultValue: number;
        value: number;
    }>;

    /** Load-time stable id → binding map (binding.value updated on setParameter). */
    parameterMap(): ReadonlyMap<
        string,
        {
            id: string;
            min: number;
            max: number;
            defaultValue: number;
            value: number;
        }
    >;

    /** Resolve parameter id → index (O(1) after load). */
    resolveParameter(id: string): number | undefined;

    listMotionGroups(): Record<string, readonly MotionDefinition[]>;

    playMotion(
        group: string,
        index?: number,
        options?: PlayMotionActorOptions,
    ): Promise<boolean>;

    stopMotion(opts?: { fade?: boolean; slot?: string }): void;

    listPlayingMotions(): ReadonlyArray<{
        slot: string;
        group: string;
        index: number;
        time: number;
        priority: number;
    }>;

    listExpressions(): readonly ExpressionDefinition[];

    /** Apply an expression by settings name; pass `null` to clear. */
    setExpression(name: string | null): Promise<boolean>;

    lookAt(stageX: number, stageY: number): void;

    destroy(): void;
}

/** Multi-character stage owning one canvas surface and shared renderer. */
export interface Live2dStage {
    readonly actors: readonly Live2dActor[];

    /** Shared model resource cache for multi-actor reuse. */
    readonly assets: import("../model/model-asset.js").Live2dStageAssets;

    mount(canvas: HTMLCanvasElement): Promise<void>;

    createActor(options?: CreateActorOptions): Live2dActor;

    getActor(id: string): Live2dActor | null;

    removeActor(actor: Live2dActor | string): void;

    defineLayers(layers: readonly string[]): void;

    /** Sync canvas backing store and renderer to CSS or explicit pixel size. */
    resize(width?: number, height?: number): void;

    update(deltaTimeSeconds: number): void;

    render(): void;

    /** Subscribe to the stage-owned frame loop (before `update`). Returns unsubscribe. */
    onFrame(listener: (deltaTimeSeconds: number) => void): () => void;

    start(): void;

    pause(): void;

    resume(): void;

    stop(): void;

    hitTest(stageX: number, stageY: number): ActorHit | null;

    hitTestAll(stageX: number, stageY: number): readonly ActorHit[];

    addEventListener(
        type: "pointerdown" | "pointermove" | "pointerup",
        listener: (event: StagePointerEvent) => void,
    ): void;

    removeEventListener(
        type: "pointerdown" | "pointermove" | "pointerup",
        listener: (event: StagePointerEvent) => void,
    ): void;

    destroy(): void;

    pointerTracking: PointerTrackingPolicy;
}

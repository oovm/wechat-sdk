import type {
    AssetResolver,
    FrameSnapshot,
    InternalModel,
    ModelFormat,
    ModelSettings,
} from "@doki-land/live2d-core";
import type { DrawableMesh, Renderer } from "../types.js";

/**
 * Model-format runtime contract (moc2 / moc3 / cpu-program).
 * Not a graphics backend — those live under `backends/`.
 */
export interface ModelBackendOptions {
    /** Bound graphics renderer, if the runtime needs GPU handles. */
    renderer?: Renderer | null;
    /** Asset resolver for moc / textures. */
    resolver?: AssetResolver;
    /** Preloaded moc bytes (tests). */
    mocBytes?: ArrayBuffer;
    /** Reuse a prior compile from {@link SharedModelCompile}. */
    sharedCompile?: SharedModelCompile;
}

/** Live parameter binding for inspectors / playground. */
export interface ParameterBinding {
    readonly id: string;
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
    readonly value: number;
}

/** Shared read-only decode payload (renderer-internal; set by stage asset cache). */
export interface SharedModelCompile {
    readonly mocBytes: ArrayBuffer;
    /** Parsed binary `.moc3` document. */
    readonly moc3Doc?: unknown;
    /** moc3 CPU `.program.json` program. */
    readonly cpuProgram?: import("@doki-land/live2d-core").ModelProgram;
    /** Parsed moc2 model graph. */
    readonly moc2Model?: unknown;
}

/** moc2 / moc3 model runtime. */
export interface ModelBackend {
    readonly format: ModelFormat;

    canHandle(json: unknown): boolean;

    createModel(
        settings: ModelSettings,
        options?: ModelBackendOptions,
    ): Promise<InternalModel>;

    updateModel(model: InternalModel, deltaTimeSeconds: number): void;

    getDrawables(model: InternalModel): DrawableMesh[];

    hitTest(model: InternalModel, x: number, y: number): string | null;

    destroyModel(model: InternalModel): void;

    /** Optional CPU snapshot (moc3 CPU path). */
    captureFrame?(model: InternalModel): FrameSnapshot | null;

    setParameter?(model: InternalModel, id: string, value: number): void;

    /** Optional PartOpacity override (moc3 parts / pose / motion). */
    setPartOpacity?(model: InternalModel, id: string, value: number): void;

    listParameters?(model: InternalModel): readonly ParameterBinding[];
}

export function selectModelBackend(
    backends: ModelBackend[],
    json: unknown,
): ModelBackend {
    const hit = backends.find((b) => b.canHandle(json));
    if (!hit) {
        throw new Error(
            "@doki-land/live2d-renderer: no ModelBackend can handle this model JSON",
        );
    }
    return hit;
}

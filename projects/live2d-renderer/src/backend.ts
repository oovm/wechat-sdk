import type {
    AssetResolver,
    FrameSnapshot,
    InternalModel,
    ModelFormat,
    ModelSettings,
} from "@doki-land/live2d-core";
import type { DrawableMesh, Renderer } from "./types.js";

export interface ModelBackendOptions {
    /** Bound graphics renderer, if the backend needs GPU handles. */
    renderer?: Renderer | null;
    /** Asset resolver for moc / textures. */
    resolver?: AssetResolver;
    /** Preloaded moc bytes (tests). */
    mocBytes?: ArrayBuffer;
}

/** Live parameter binding for inspectors / playground. */
export interface ParameterBinding {
    readonly id: string;
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
    readonly value: number;
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

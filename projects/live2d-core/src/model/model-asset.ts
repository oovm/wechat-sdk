import type { AssetResolver, ModelSource } from "../contracts.js";
import type { InternalModel, ModelSettings } from "./model.js";

/**
 * Read-only model resources shared across actors on one stage
 * (settings, decoded topology, textures, motion definitions).
 */
export interface ModelAsset {
    readonly key: string;
    readonly settings: ModelSettings;
}

/** Stage-scoped model resource cache (`stage.assets`). */
export interface Live2dStageAssets {
    load(source: ModelSource, resolver?: AssetResolver): Promise<ModelAsset>;
}

/** Per-actor mutable runtime bound to a shared {@link ModelAsset}. */
export interface ActorInstance {
    readonly asset: ModelAsset;
    readonly model: InternalModel;
}

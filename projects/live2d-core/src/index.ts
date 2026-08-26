/**
 * `@doki-land/live2d-core` — types, events, session contracts.
 *
 * Layout:
 * - `format/`  — settings JSON format detection
 * - `model/`   — settings / asset / actor instance types
 * - `stage/`   — stage + actor contracts
 * - root       — contracts, events, frame, program, session
 */

export type {
    AssetKey,
    AssetResolver,
    ModelSource,
    SessionPhase,
    SessionState,
} from "./contracts.js";
export { modelSourceUrl } from "./contracts.js";
export {
    EventEmitter,
    type FrameProfile,
    type Live2dEventMap,
    type Live2dEventName,
    type Live2dListener,
    type LoadProgress,
    type LoadProgressStage,
    /** @deprecated Use `Live2dEventMap`. */
    type Live2DEventMap,
    /** @deprecated Use `Live2dEventName`. */
    type Live2DEventName,
    /** @deprecated Use `Live2dListener`. */
    type Live2DListener,
} from "./events.js";
export { detectModelSettingsFormat } from "./format/detect-format.js";
export {
    FrameBlendMode,
    type FrameDrawable,
    type FrameSnapshot,
} from "./frame.js";
export type {
    ExpressionDefinition,
    HitAreaDefinition,
    InternalModel,
    ModelFormat,
    ModelSettings,
    MotionDefinition,
} from "./model/model.js";
export type {
    ActorInstance,
    Live2dStageAssets,
    ModelAsset,
} from "./model/model-asset.js";
export type {
    DrawableProgram,
    ModelInstance,
    ModelProgram,
    ParameterProgram,
} from "./program.js";
export {
    createSessionStub,
    type Live2dSession,
    /** @deprecated Use `Live2dSession`. */
    type Live2DSession,
} from "./session.js";
export type {
    ActorHit,
    ActorTransform,
    CreateActorOptions,
    CreateLive2dStageOptions,
    Live2dActor,
    Live2dStage,
    PlayMotionActorOptions,
    PointerTrackingMode,
    PointerTrackingPolicy,
    StagePointerEvent,
    StageUpdateMode,
} from "./stage/stage.js";
export { DEFAULT_ACTOR_TRANSFORM } from "./stage/stage.js";

export const LIVE2D_CORE_VERSION = "0.0.0" as const;

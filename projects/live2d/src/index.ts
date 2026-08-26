/**
 * `@doki-land/live2d` — public facade.
 *
 * Layout:
 * - `facade/`    — `createLive2d()` default stage + actor entry
 * - `motion/`    — motion3 parse + playback
 * - `stage/`     — multi-actor stage, assets, transforms
 * - `reexports/` — optional subpath `@doki-land/live2d/{core,loader,renderer}`
 *
 * ```ts
 * import { createLive2d } from "@doki-land/live2d";
 * ```
 */

export type {
    ActorHit,
    ActorInstance,
    ActorTransform,
    AssetResolver,
    CreateActorOptions,
    CreateLive2dStageOptions,
    FrameProfile,
    FrameSnapshot,
    InternalModel,
    Live2dActor,
    Live2dSession,
    Live2dStage,
    Live2dStageAssets,
    LoadProgress,
    LoadProgressStage,
    ModelAsset,
    ModelFormat,
    ModelInstance,
    ModelProgram,
    ModelSettings,
    ModelSource,
    PlayMotionActorOptions,
    PointerTrackingMode,
    PointerTrackingPolicy,
    SessionPhase,
    SessionState,
    StagePointerEvent,
    StageUpdateMode,
} from "@doki-land/live2d-core";
export { DEFAULT_ACTOR_TRANSFORM, EventEmitter } from "@doki-land/live2d-core";
export {
    DEFAULT_NPM_CDN,
    resolveModelSourceUrl,
    resolveNpmSpecifier,
} from "@doki-land/live2d-loader";
export {
    createCanvas2DRenderer,
    createMoc2Backend,
    createMoc3Backend,
    createQuadProgram,
    createRenderer,
    createWebGl2Renderer,
    createWebGpuRenderer,
    decodeMoc3,
    evaluateFrame,
    fingerprintSnapshot,
    type ModelBackend,
    type ParameterBinding,
    parseCpuProgram,
    type Renderer,
    type RendererKind,
    serializeCpuProgram,
} from "@doki-land/live2d-renderer";
export {
    applyExpression3Clip,
    type Expression3Clip,
    type Expression3Parameter,
    type ExpressionBlendMode,
    parseExpression3,
} from "./expression/index.js";
export {
    type CreateLive2dOptions,
    createLive2d,
    type Live2dRuntime,
    MotionPriority,
    type PlayMotionOptions,
} from "./facade/create-live2d.js";
export {
    blendMotionLayers,
    evaluateCurve,
    evaluateMotion3,
    type Motion3Clip,
    type MotionApplySample,
    MotionPlayer,
    parseMotion3,
} from "./motion/index.js";
export {
    applyPhysics3,
    type Physics3ApplyBinding,
    type Physics3Clip,
    type Physics3Output,
    type Physics3Setting,
    parsePhysics3,
} from "./physics/index.js";
export {
    applyPose3Activation,
    type Pose3Clip,
    parsePose3,
} from "./pose/index.js";
export { allocateActorId } from "./stage/actor.js";
export { focusParameterUpdates } from "./stage/assets/focus.js";
export { resolveHitAreaName } from "./stage/hit-area.js";
export {
    type CreateLive2dStageFullOptions,
    createLive2dStage,
} from "./stage/stage.js";

export const LIVE2D_VERSION = "0.0.0" as const;

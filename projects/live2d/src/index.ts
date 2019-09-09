/**
 * `@doki-land/live2d` — public facade.
 *
 * ```ts
 * import { createLive2D } from "@doki-land/live2d";
 * ```
 */

export type {
    AssetResolver,
    FrameProfile,
    FrameSnapshot,
    InternalModel,
    Live2DSession,
    LoadProgress,
    LoadProgressStage,
    ModelFormat,
    ModelInstance,
    ModelProgram,
    ModelSettings,
    ModelSource,
    SessionPhase,
    SessionState,
} from "@doki-land/live2d-core";
export { EventEmitter } from "@doki-land/live2d-core";
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
    type CreateLive2DOptions,
    createLive2D,
    type Live2DRuntime,
    MotionPriority,
    type PlayMotionOptions,
} from "./create-live2d.js";
export { focusParameterUpdates } from "./focus.js";
export {
    blendMotionLayers,
    evaluateCurve,
    evaluateMotion3,
    type Motion3Clip,
    type MotionApplySample,
    MotionPlayer,
    parseMotion3,
} from "./motion/index.js";

export const LIVE2D_VERSION = "0.0.0" as const;

/**
 * `@doki-land/live2d-renderer`
 *
 * Layout:
 * - `backends/`  — graphics only (webgpu / webgl2 / canvas2d)
 * - `moc/`       — moc2 / moc3 decode + model runtimes (not graphics backends)
 * - `cpu/`       — CPU evaluate + cpu-program fixture codec
 * - `render/`    — blend, clipping, coords, preview styling helpers
 * - `runtime/`   — renderer factory + model runtime glue
 * - `format/`    — moc binary / settings format peek (shared with core)
 * - `tests/`     — all vitest suites (package root)
 */

export {
    Canvas2DRendererImpl,
    type Canvas2DRendererOptions,
    createCanvas2DRenderer,
    isCanvas2DAvailable,
} from "./backends/canvas2d.js";
export {
    createWebGl2Renderer,
    isWebGl2Available,
    WebGl2RendererImpl,
    type WebGl2RendererOptions,
} from "./backends/webgl2.js";
export {
    createWebGpuRenderer,
    isWebGpuAvailable,
    WebGpuRendererImpl,
    type WebGpuRendererOptions,
} from "./backends/webgpu.js";
export {
    CPU_PROGRAM_KIND,
    type CpuProgramFile,
    createQuadProgram,
    isCpuProgramBytes,
    parseCpuProgram,
    serializeCpuProgram,
} from "./cpu/cpu-program.js";
export {
    createModelInstance,
    evaluateFrame,
    fingerprintSnapshot,
    setParameterValue,
} from "./cpu/evaluate.js";
export {
    detectMocBinaryFormat,
    detectModelSettingsFormat,
} from "./format/detect-format.js";
export {
    type DecodedMoc2,
    type DecodedMoc3,
    decodeMoc2,
    decodeMoc3,
} from "./moc/decode.js";
export {
    decodeMoc2ColorComposition,
    decodeMoc3DrawableFlags,
    Moc3DrawableFlag,
} from "./moc/drawable-flags.js";
export { createMoc2Backend, Moc2Backend } from "./moc/moc2.js";
export { createMoc3Backend, Moc3Backend } from "./moc/moc3.js";
export {
    applyMoc3Glues,
    loadMoc3Glues,
    type Moc3GlueDef,
    type Moc3GluePair,
    meanGlueSeamDistance,
} from "./moc/moc3-glue.js";
export {
    applyWebGl2BlendMode,
    canvasCompositeForBlendMode,
    webGpuBlendState,
} from "./render/blend.js";
export {
    buildClippingContexts,
    type ClippingContext,
    type ClippingDrawableRef,
    type ClippingPartition,
    calcClippedDrawableBounds,
    calcVertexBounds,
    expandBounds,
    FULL_NDC_BOUNDS,
    fitClippingContexts,
    type LaidOutClippingContext,
    layoutMaskAtlas,
    layoutMaskAtlasRgba,
    layoutMaskAtlasUvGrid,
    MASK_CHANNEL_FLAGS,
    type MaskAtlasMode,
    type MaskAtlasOptions,
    type MaskChannelFlag,
    type MaskLayoutRect,
    maskChannelVec4,
    maskLayoutVec4,
    partitionForClipping,
} from "./render/clipping.js";
export {
    PREVIEW_FILL,
    PREVIEW_STROKE,
    triangleEdgesToLineList,
} from "./render/preview-style.js";
export {
    type CreateRendererOptions,
    createRenderer,
} from "./runtime/create-renderer.js";
export {
    type ModelBackend,
    type ModelBackendOptions,
    type ParameterBinding,
    type SharedModelCompile,
    selectModelBackend,
} from "./runtime/model-runtime.js";
export { compileSharedModelCompile } from "./runtime/shared-compile.js";
export {
    BlendMode,
    type DrawableMesh,
    type ModelDrawPass,
    type Renderer,
    type RendererKind,
    type TextureData,
    type WebGl2Renderer,
    type WebGpuRenderer,
} from "./types.js";

export const LIVE2D_RENDERER_VERSION = "0.0.0" as const;

/**
 * `@doki-land/live2d-renderer` — WebGPU/WebGL2/Canvas2D renderers and moc2/moc3 backends.
 */

export {
    type ModelBackend,
    type ModelBackendOptions,
    type ParameterBinding,
    selectModelBackend,
} from "./backend.js";
export { createMoc2Backend, Moc2Backend } from "./backends/moc2.js";
export { createMoc3Backend, Moc3Backend } from "./backends/moc3.js";
export {
    applyWebGl2BlendMode,
    canvasCompositeForBlendMode,
    webGpuBlendState,
} from "./blend.js";
export {
    Canvas2DRendererImpl,
    type Canvas2DRendererOptions,
    createCanvas2DRenderer,
    isCanvas2DAvailable,
} from "./canvas2d.js";
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
} from "./clipping.js";
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
    type CreateRendererOptions,
    createRenderer,
} from "./create-renderer.js";
export {
    detectMocBinaryFormat,
    detectModelSettingsFormat,
} from "./detect-format.js";
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
export {
    applyMoc3Glues,
    loadMoc3Glues,
    type Moc3GlueDef,
    type Moc3GluePair,
    meanGlueSeamDistance,
} from "./moc/moc3-glue.js";
export {
    PREVIEW_FILL,
    PREVIEW_STROKE,
    triangleEdgesToLineList,
} from "./preview-style.js";
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
export {
    createWebGl2Renderer,
    isWebGl2Available,
    WebGl2RendererImpl,
    type WebGl2RendererOptions,
} from "./webgl2.js";
export {
    createWebGpuRenderer,
    isWebGpuAvailable,
    WebGpuRendererImpl,
    type WebGpuRendererOptions,
} from "./webgpu.js";

export const LIVE2D_RENDERER_VERSION = "0.0.0" as const;

/**
 * `@doki-land/live2d-loader` — model JSON fetch and load pipeline.
 */

export {
    type FetchProgressHandler,
    fetchArrayBufferWithProgress,
    fetchJsonWithProgress,
} from "./fetch-progress.js";
export {
    createUrlAssetResolver,
    detectModelFormat,
    fetchModelJson,
    type LoadMiddleware,
    type LoadPipelineContext,
    normalizeModelSettings,
    resolveAssetUrl,
    runLoadPipeline,
    type UrlAssetResolverOptions,
} from "./pipeline.js";
export {
    DEFAULT_NPM_CDN,
    type ResolveModelSourceOptions,
    resolveModelSourceUrl,
    resolveNpmSpecifier,
} from "./resolve-source.js";

export const LIVE2D_LOADER_VERSION = "0.0.0" as const;

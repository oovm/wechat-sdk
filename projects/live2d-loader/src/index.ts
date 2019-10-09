/**
 * `@doki-land/live2d-loader` — model JSON fetch and load pipeline.
 *
 * Layout:
 * - `fetch/`     — progress-aware fetch helpers
 * - `pipeline/`  — normalize settings + load middleware
 * - `resolve/`   — npm: / URL source resolution
 */

export {
    type FetchProgressHandler,
    fetchArrayBufferWithProgress,
    fetchJsonWithProgress,
} from "./fetch/index.js";
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
} from "./pipeline/index.js";
export {
    DEFAULT_NPM_CDN,
    type ResolveModelSourceOptions,
    resolveModelSourceUrl,
    resolveNpmSpecifier,
} from "./resolve/index.js";

export const LIVE2D_LOADER_VERSION = "0.0.0" as const;

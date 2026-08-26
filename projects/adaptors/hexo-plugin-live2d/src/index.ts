/**
 * Typed helpers for tests / tooling. Hexo loads `index.cjs` at runtime.
 */

export type HexoRendererPrefer = "webgpu" | "webgl2" | "canvas2d";

export type HexoLive2dLoader = "esm" | "bundle" | "ce";

export interface HexoLive2dConfig {
    enable?: boolean;
    /** Model settings URL, `npm:…` specifier, or site-relative path. */
    model?: string;
    width?: number;
    height?: number;
    /** CSS selector for an existing host; default injects `#doki-live2d`. */
    target?: string;
    /** Extra class on the injected host element. */
    className?: string;
    /**
     * Asset delivery mode.
     * - `esm` (default): import map + vendor dist + thin bootstrap module
     * - `ce`: optional CE path — inject `<live-2d-widget>` + `@doki-land/live2d-element`
     * - `bundle` (deprecated): monolithic `doki-live2d-hexo.js` IIFE
     */
    loader?: HexoLive2dLoader;
    /**
     * Browser entry URL. Defaults from `loader` when omitted.
     */
    scriptUrl?: string;
    /** Public output directory prefix for generated assets. */
    pluginRootPath?: string;
    /**
     * Renderer try order (FallbackRenderer).
     * Default: webgpu → webgl2 → canvas2d.
     */
    prefer?: HexoRendererPrefer[];
    /** Sine-drive PARAM_ANGLE_X. Default true. */
    autoSway?: boolean;
    /**
     * Widget chrome (tips / hitokoto / photo / quit).
     * Default true. Pass `false` to disable, or an options object.
     */
    chrome?: boolean | Record<string, unknown>;
}

export const DEFAULT_HEXO_LIVE2D_CONFIG: Required<
    Pick<
        HexoLive2dConfig,
        | "enable"
        | "width"
        | "height"
        | "target"
        | "className"
        | "loader"
        | "pluginRootPath"
        | "prefer"
        | "autoSway"
        | "chrome"
    >
> & { model: string } = {
    enable: true,
    model: "",
    width: 280,
    height: 400,
    target: "#doki-live2d",
    className: "doki-live2d",
    loader: "esm",
    scriptUrl: "",
    pluginRootPath: "live2dw/",
    prefer: ["webgpu", "webgl2", "canvas2d"],
    autoSway: true,
    chrome: true,
};

export function mergeHexoLive2dConfig(
    ...layers: Array<HexoLive2dConfig | undefined>
): HexoLive2dConfig {
    return Object.assign(
        {},
        DEFAULT_HEXO_LIVE2D_CONFIG,
        ...layers.filter(Boolean),
    );
}

function normalizePrefer(prefer: unknown): HexoRendererPrefer[] | undefined {
    if (!Array.isArray(prefer)) return undefined;
    const allowed = new Set(["webgpu", "webgl2", "canvas2d"]);
    const out = prefer.filter(
        (k): k is HexoRendererPrefer => typeof k === "string" && allowed.has(k),
    );
    return out.length ? out : undefined;
}

function normalizePublicPrefix(pluginRootPath: string): string {
    let p = pluginRootPath || "live2dw/";
    if (!p.startsWith("/")) p = `/${p}`;
    if (!p.endsWith("/")) p = `${p}/`;
    return p;
}

export function buildHexoImportMap(pluginRootPath: string): {
    imports: Record<string, string>;
} {
    const root = normalizePublicPrefix(pluginRootPath);
    return {
        imports: {
            "@doki-land/live2d": `${root}vendor/live2d/index.js`,
            "@doki-land/live2d/core": `${root}vendor/live2d/reexports/core.js`,
            "@doki-land/live2d/loader": `${root}vendor/live2d/reexports/loader.js`,
            "@doki-land/live2d/renderer": `${root}vendor/live2d/reexports/renderer.js`,
            "@doki-land/live2d-core": `${root}vendor/live2d-core/index.js`,
            "@doki-land/live2d-loader": `${root}vendor/live2d-loader/index.js`,
            "@doki-land/live2d-renderer": `${root}vendor/live2d-renderer/index.js`,
            "@doki-land/live2d-widget": `${root}vendor/live2d-widget/index.js`,
            "@doki-land/live2d-element": `${root}vendor/live2d-element/index.js`,
        },
    };
}

export function resolveHexoLive2dLoader(
    loader: HexoLive2dLoader | undefined,
): HexoLive2dLoader {
    if (loader === "bundle" || loader === "ce") return loader;
    return "esm";
}

export function defaultHexoScriptUrl(
    loader: HexoLive2dLoader,
    pluginRootPath: string,
): string {
    const root = normalizePublicPrefix(pluginRootPath);
    if (loader === "bundle") {
        return `${root}doki-live2d-hexo.js`;
    }
    if (loader === "ce") {
        return `${root}vendor/live2d-element/index.js`;
    }
    return `${root}doki-live2d-hexo.bootstrap.mjs`;
}

/** Body-end HTML: host node + bootstrap / CE script tag. */
export function renderHexoLive2dInjector(config: HexoLive2dConfig): string {
    const cfg = mergeHexoLive2dConfig(config);
    if (!cfg.enable) return "";
    const loader = resolveHexoLive2dLoader(cfg.loader);
    const model = JSON.stringify(cfg.model ?? "");
    const target = JSON.stringify(cfg.target ?? "#doki-live2d");
    const width = Number(cfg.width ?? 280);
    const height = Number(cfg.height ?? 400);
    const className = cfg.className ?? "doki-live2d";
    const pluginRootPath =
        cfg.pluginRootPath ?? DEFAULT_HEXO_LIVE2D_CONFIG.pluginRootPath;
    const scriptUrl =
        config.scriptUrl && config.scriptUrl.length > 0
            ? config.scriptUrl
            : defaultHexoScriptUrl(loader, pluginRootPath);
    const prefer =
        normalizePrefer(cfg.prefer) ?? DEFAULT_HEXO_LIVE2D_CONFIG.prefer;
    const autoSway = cfg.autoSway !== false;
    const chrome =
        cfg.chrome === undefined || cfg.chrome === null ? true : cfg.chrome;
    const modelAttr = String(cfg.model ?? "").replace(/"/g, "&quot;");

    if (loader === "ce") {
        const importMap = `<script type="importmap">${JSON.stringify(buildHexoImportMap(pluginRootPath))}</script>\n`;
        const widget = `<live-2d-widget id="doki-live2d" class="${className}" model="${modelAttr}" width="${width}" height="${height}" autoplay style="position:fixed;left:0;bottom:0;z-index:999;"></live-2d-widget>\n`;
        return `${widget}${importMap}<script type="module" src="${scriptUrl}"></script>\n`;
    }

    const needsHost = (cfg.target ?? "#doki-live2d") === "#doki-live2d";
    const host = needsHost
        ? `<div id="doki-live2d" class="${className}" style="position:fixed;left:0;bottom:0;z-index:999;pointer-events:none;" aria-hidden="true"></div>\n`
        : "";

    const importMap =
        loader === "esm"
            ? `<script type="importmap">${JSON.stringify(buildHexoImportMap(pluginRootPath))}</script>\n`
            : "";

    const scriptTag =
        loader === "esm"
            ? `<script type="module" src="${scriptUrl}"></script>`
            : `<script defer src="${scriptUrl}"></script>`;

    return `${host}${importMap}<script>
window.__DOKI_LIVE2D_HEXO__ = {
  model: ${model},
  target: ${target},
  width: ${width},
  height: ${height},
  prefer: ${JSON.stringify(prefer)},
  autoSway: ${autoSway ? "true" : "false"},
  chrome: ${JSON.stringify(chrome)}
};
</script>
${scriptTag}
`;
}

export const HEXO_PLUGIN_LIVE2D_VERSION = "0.0.0" as const;

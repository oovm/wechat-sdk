/**
 * Typed helpers for tests / tooling. Hexo loads `index.cjs` at runtime.
 */

export type HexoRendererPrefer = "webgpu" | "webgl2" | "canvas2d";

export interface HexoLive2DConfig {
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
     * Browser entry URL for the widget bootstrap script.
     * Default: `/live2dw/doki-live2d-hexo.js`
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
}

export const DEFAULT_HEXO_LIVE2D_CONFIG: Required<
    Pick<
        HexoLive2DConfig,
        | "enable"
        | "width"
        | "height"
        | "target"
        | "className"
        | "scriptUrl"
        | "pluginRootPath"
        | "prefer"
        | "autoSway"
    >
> & { model: string } = {
    enable: true,
    model: "",
    width: 280,
    height: 400,
    target: "#doki-live2d",
    className: "doki-live2d",
    scriptUrl: "/live2dw/doki-live2d-hexo.js",
    pluginRootPath: "live2dw/",
    prefer: ["webgpu", "webgl2", "canvas2d"],
    autoSway: true,
};

export function mergeHexoLive2DConfig(
    ...layers: Array<HexoLive2DConfig | undefined>
): HexoLive2DConfig {
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

/** Body-end HTML: host node + bootstrap script tag. */
export function renderHexoLive2DInjector(config: HexoLive2DConfig): string {
    const cfg = mergeHexoLive2DConfig(config);
    if (!cfg.enable) return "";
    const model = JSON.stringify(cfg.model ?? "");
    const target = JSON.stringify(cfg.target ?? "#doki-live2d");
    const width = Number(cfg.width ?? 280);
    const height = Number(cfg.height ?? 400);
    const className = cfg.className ?? "doki-live2d";
    const scriptUrl = cfg.scriptUrl ?? DEFAULT_HEXO_LIVE2D_CONFIG.scriptUrl;
    const prefer =
        normalizePrefer(cfg.prefer) ?? DEFAULT_HEXO_LIVE2D_CONFIG.prefer;
    const autoSway = cfg.autoSway !== false;
    const needsHost = (cfg.target ?? "#doki-live2d") === "#doki-live2d";

    const host = needsHost
        ? `<div id="doki-live2d" class="${className}" style="position:fixed;left:0;bottom:0;z-index:999;pointer-events:none;" aria-hidden="true"></div>\n`
        : "";

    return `${host}<script>
window.__DOKI_LIVE2D_HEXO__ = {
  model: ${model},
  target: ${target},
  width: ${width},
  height: ${height},
  prefer: ${JSON.stringify(prefer)},
  autoSway: ${autoSway ? "true" : "false"}
};
</script>
<script defer src="${scriptUrl}"></script>
`;
}

export const HEXO_PLUGIN_LIVE2D_VERSION = "0.0.0" as const;

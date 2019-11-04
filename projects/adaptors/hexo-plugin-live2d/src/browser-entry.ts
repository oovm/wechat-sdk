/**
 * Browser bootstrap for hexo-plugin-live2d.
 * ESM default: `browser/doki-live2d-hexo.bootstrap.mjs` + import map vendor.
 * Legacy: bundled IIFE `browser/doki-live2d-hexo.js` (deprecated).
 */
import type { RendererKind } from "@doki-land/live2d";
import {
    Live2dWidget,
    mountWidget,
    type WidgetChromeOptions,
} from "@doki-land/live2d-widget";

declare global {
    // eslint-disable-next-line no-var
    var __DOKI_LIVE2D_HEXO__:
        | {
              model?: string;
              target?: string;
              width?: number;
              height?: number;
              prefer?: RendererKind[];
              autoSway?: boolean;
              chrome?: boolean | WidgetChromeOptions;
          }
        | undefined;
    // eslint-disable-next-line no-var
    var DokiLive2D:
        | {
              mountWidget: typeof mountWidget;
              Live2dWidget: typeof Live2dWidget;
          }
        | undefined;
}

globalThis.DokiLive2D = {
    mountWidget,
    Live2dWidget,
};

const cfg = globalThis.__DOKI_LIVE2D_HEXO__ ?? {};

void mountWidget({
    target: cfg.target || "#doki-live2d",
    model: cfg.model || undefined,
    width: cfg.width ?? 280,
    height: cfg.height ?? 400,
    prefer: cfg.prefer,
    autoSway: cfg.autoSway !== false,
    chrome: cfg.chrome === undefined ? true : cfg.chrome,
    autoplay: true,
    onHit: (payload) => {
        console.debug("[hexo-plugin-live2d] hit", payload.area);
    },
}).catch((err) => {
    console.error("[hexo-plugin-live2d]", err);
});

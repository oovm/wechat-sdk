import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
    DEFAULT_HEXO_LIVE2D_CONFIG,
    HEXO_PLUGIN_LIVE2D_VERSION,
    renderHexoLive2DInjector,
} from "../src/index.js";

const require = createRequire(import.meta.url);
const cjs = require("../index.cjs") as {
    renderInjector: (config: Record<string, unknown>) => string;
    DEFAULTS: Record<string, unknown>;
    PLUGIN_ID: string;
};

describe("hexo-plugin-live2d", () => {
    it("exports 0.0.0 version", () => {
        expect(HEXO_PLUGIN_LIVE2D_VERSION).toBe("0.0.0");
        expect(cjs.PLUGIN_ID).toBe("hexo-plugin-live2d");
    });

    it("renders injector with prefer fallback list", () => {
        const html = renderHexoLive2DInjector({
            enable: true,
            model: "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
        });
        expect(html).toContain('id="doki-live2d"');
        expect(html).toContain("window.__DOKI_LIVE2D_HEXO__");
        expect(html).toContain(DEFAULT_HEXO_LIVE2D_CONFIG.scriptUrl);
        expect(html).toContain("hijiki.model.json");
        expect(html).toContain('"webgpu"');
        expect(html).toContain('"webgl2"');
        expect(html).toContain('"canvas2d"');
        expect(html).toContain("autoSway: true");
        expect(html).toContain("chrome: true");
        expect(cjs.renderInjector({ enable: true, model: "x" })).toContain(
            '"webgpu"',
        );
        expect(
            renderHexoLive2DInjector({ enable: true, chrome: false }),
        ).toContain("chrome: false");
    });

    it("returns empty HTML when disabled", () => {
        expect(renderHexoLive2DInjector({ enable: false })).toBe("");
        expect(cjs.renderInjector({ enable: false })).toBe("");
    });
});

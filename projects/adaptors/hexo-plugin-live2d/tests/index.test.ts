import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
    buildHexoImportMap,
    DEFAULT_HEXO_LIVE2D_CONFIG,
    HEXO_PLUGIN_LIVE2D_VERSION,
    renderHexoLive2DInjector,
} from "../src/index.js";

const require = createRequire(import.meta.url);
const cjs = require("../index.cjs") as {
    renderInjector: (config: Record<string, unknown>) => string;
    DEFAULTS: Record<string, unknown>;
    PLUGIN_ID: string;
    resolveLoader: (config: Record<string, unknown>) => "esm" | "bundle";
    resolveScriptUrl: (config: Record<string, unknown>) => string;
    collectAssetRoutes: (config: Record<string, unknown>) => {
        missing: string | null;
        routes: { path: string }[];
    };
};

describe("hexo-plugin-live2d", () => {
    it("exports 0.0.0 version", () => {
        expect(HEXO_PLUGIN_LIVE2D_VERSION).toBe("0.0.0");
        expect(cjs.PLUGIN_ID).toBe("hexo-plugin-live2d");
        expect(cjs.DEFAULTS.loader).toBe("esm");
    });

    it("renders ESM injector with import map by default", () => {
        const html = renderHexoLive2DInjector({
            enable: true,
            model: "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
        });
        expect(html).toContain('type="importmap"');
        expect(html).toContain("@doki-land/live2d");
        expect(html).toContain('type="module"');
        expect(html).toContain("doki-live2d-hexo.bootstrap.mjs");
        expect(html).toContain('id="doki-live2d"');
        expect(html).toContain("window.__DOKI_LIVE2D_HEXO__");
        expect(html).toContain("hijiki.model.json");
        expect(html).toContain('"webgpu"');
        expect(html).toContain("autoSway: true");
        expect(html).toContain("chrome: true");
    });

    it("renders legacy bundle injector when loader is bundle", () => {
        const html = renderHexoLive2DInjector({
            enable: true,
            loader: "bundle",
            model: "x",
        });
        expect(html).not.toContain("importmap");
        expect(html).toContain('defer src="/live2dw/doki-live2d-hexo.js"');
        expect(
            cjs.renderInjector({ enable: true, loader: "bundle", model: "x" }),
        ).toContain("doki-live2d-hexo.js");
    });

    it("builds import map under pluginRootPath", () => {
        const map = buildHexoImportMap("assets/live2dw/");
        expect(map.imports["@doki-land/live2d"]).toBe(
            "/assets/live2dw/vendor/live2d/index.js",
        );
        expect(map.imports["@doki-land/live2d-widget"]).toContain(
            "live2d-widget/index.js",
        );
    });

    it("returns empty HTML when disabled", () => {
        expect(renderHexoLive2DInjector({ enable: false })).toBe("");
        expect(cjs.renderInjector({ enable: false })).toBe("");
    });

    it("defaults script URL from loader in cjs helpers", () => {
        expect(
            cjs.resolveScriptUrl({
                loader: "esm",
                pluginRootPath: "live2dw/",
            }),
        ).toBe("/live2dw/doki-live2d-hexo.bootstrap.mjs");
        expect(
            cjs.resolveScriptUrl({
                loader: "bundle",
                pluginRootPath: "live2dw/",
            }),
        ).toContain("doki-live2d-hexo.js");
    });

    it("collectAssetRoutes reports missing vendor for esm when not built", () => {
        const result = cjs.collectAssetRoutes({
            loader: "esm",
            pluginRootPath: "live2dw/",
        });
        expect(["vendor", "bootstrap"]).toContain(result.missing);
    });

    it("collectAssetRoutes lists legacy bundle when loader is bundle", () => {
        const result = cjs.collectAssetRoutes({
            loader: "bundle",
            pluginRootPath: "live2dw/",
        });
        if (result.missing === null) {
            expect(
                result.routes.some((r) =>
                    r.path.includes("doki-live2d-hexo.js"),
                ),
            ).toBe(true);
        } else {
            expect(result.missing).toBe("legacy");
        }
    });
});

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    buildHexoImportMap,
    DEFAULT_HEXO_LIVE2D_CONFIG,
    HEXO_PLUGIN_LIVE2D_VERSION,
    renderHexoLive2dInjector,
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

/** Isolated browser/ tree — never depends on repo build artifacts. */
function withTempBrowserRoot(
    setup: (browserRoot: string) => void,
    run: (browserRoot: string) => void,
) {
    const browserRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "hexo-live2d-browser-"),
    );
    try {
        setup(browserRoot);
        run(browserRoot);
    } finally {
        fs.rmSync(browserRoot, { recursive: true, force: true });
    }
}

describe("hexo-plugin-live2d", () => {
    it("exports 0.0.0 version", () => {
        expect(HEXO_PLUGIN_LIVE2D_VERSION).toBe("0.0.0");
        expect(cjs.PLUGIN_ID).toBe("hexo-plugin-live2d");
        expect(cjs.DEFAULTS.loader).toBe("esm");
    });

    it("renders ESM injector with import map by default", () => {
        const html = renderHexoLive2dInjector({
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
        const html = renderHexoLive2dInjector({
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
        expect(renderHexoLive2dInjector({ enable: false })).toBe("");
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

    it("collectAssetRoutes reports missing bootstrap for esm in empty browser root", () => {
        withTempBrowserRoot(
            () => {},
            (browserRoot) => {
                const result = cjs.collectAssetRoutes({
                    loader: "esm",
                    pluginRootPath: "live2dw/",
                    browserRoot,
                });
                expect(result.missing).toBe("bootstrap");
                expect(result.routes).toEqual([]);
            },
        );
    });

    it("collectAssetRoutes reports missing vendor when bootstrap exists without vendor files", () => {
        withTempBrowserRoot(
            (browserRoot) => {
                fs.writeFileSync(
                    path.join(browserRoot, "doki-live2d-hexo.bootstrap.mjs"),
                    "export {}",
                );
            },
            (browserRoot) => {
                const result = cjs.collectAssetRoutes({
                    loader: "esm",
                    pluginRootPath: "live2dw/",
                    browserRoot,
                });
                expect(result.missing).toBe("vendor");
                expect(result.routes).toHaveLength(1);
                expect(result.routes[0]?.path).toBe(
                    "live2dw/doki-live2d-hexo.bootstrap.mjs",
                );
            },
        );
    });

    it("collectAssetRoutes lists esm vendor and bootstrap when both exist", () => {
        withTempBrowserRoot(
            (browserRoot) => {
                fs.writeFileSync(
                    path.join(browserRoot, "doki-live2d-hexo.bootstrap.mjs"),
                    "export {}",
                );
                const vendorFile = path.join(
                    browserRoot,
                    "vendor",
                    "live2d",
                    "index.js",
                );
                fs.mkdirSync(path.dirname(vendorFile), { recursive: true });
                fs.writeFileSync(vendorFile, "export {}");
            },
            (browserRoot) => {
                const result = cjs.collectAssetRoutes({
                    loader: "esm",
                    pluginRootPath: "live2dw/",
                    browserRoot,
                });
                expect(result.missing).toBeNull();
                expect(
                    result.routes.some((r) =>
                        r.path.includes("doki-live2d-hexo.bootstrap.mjs"),
                    ),
                ).toBe(true);
                expect(
                    result.routes.some((r) =>
                        r.path.includes("vendor/live2d/index.js"),
                    ),
                ).toBe(true);
            },
        );
    });

    it("collectAssetRoutes reports missing legacy bundle when loader is bundle", () => {
        withTempBrowserRoot(
            () => {},
            (browserRoot) => {
                const result = cjs.collectAssetRoutes({
                    loader: "bundle",
                    pluginRootPath: "live2dw/",
                    browserRoot,
                });
                expect(result.missing).toBe("legacy");
                expect(result.routes).toEqual([]);
            },
        );
    });

    it("collectAssetRoutes lists legacy bundle when loader is bundle and file exists", () => {
        withTempBrowserRoot(
            (browserRoot) => {
                fs.writeFileSync(
                    path.join(browserRoot, "doki-live2d-hexo.js"),
                    "/* legacy */",
                );
            },
            (browserRoot) => {
                const result = cjs.collectAssetRoutes({
                    loader: "bundle",
                    pluginRootPath: "live2dw/",
                    browserRoot,
                });
                expect(result.missing).toBeNull();
                expect(
                    result.routes.some((r) =>
                        r.path.includes("doki-live2d-hexo.js"),
                    ),
                ).toBe(true);
            },
        );
    });

    it("renders CE injector with live-2d-widget when loader is ce", () => {
        const html = renderHexoLive2dInjector({
            enable: true,
            loader: "ce",
            model: "/models/demo.model3.json",
            width: 300,
            height: 400,
        });
        expect(html).toContain("<live-2d-widget");
        expect(html).toContain('model="/models/demo.model3.json"');
        expect(html).toContain("@doki-land/live2d-element");
        expect(html).toContain("vendor/live2d-element/index.js");
        expect(html).not.toContain("window.__DOKI_LIVE2D_HEXO__");
        expect(
            cjs.renderInjector({
                enable: true,
                loader: "ce",
                model: "/models/demo.model3.json",
            }),
        ).toContain("<live-2d-widget");
    });

    it("collectAssetRoutes reports missing ce when live2d-element vendor absent", () => {
        withTempBrowserRoot(
            () => {},
            (browserRoot) => {
                const result = cjs.collectAssetRoutes({
                    loader: "ce",
                    pluginRootPath: "live2dw/",
                    browserRoot,
                });
                expect(result.missing).toBe("ce");
            },
        );
    });
});

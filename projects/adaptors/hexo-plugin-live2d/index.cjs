/**
 * Hexo plugin entry (CommonJS).
 *
 * Usage:
 *   npm i hexo-plugin-live2d
 *   # Hexo auto-loads packages named hexo-* from site dependencies
 *
 * _config.yml:
 *   live2d:
 *     enable: true
 *     loader: esm          # default; legacy: bundle
 *     model: npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json
 *     prefer: [webgpu, webgl2, canvas2d]
 *     autoSway: true
 *     chrome: true
 *     width: 280
 *     height: 400
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildHexoImportMap, defaultScriptUrl } = require("./import-map.cjs");

const PLUGIN_ID = "hexo-plugin-live2d";

const DEFAULTS = {
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

function mergeConfig(hexo) {
    const fromSite = hexo.config?.live2d || {};
    const fromTheme = hexo.theme?.config?.live2d || {};
    return Object.assign({}, DEFAULTS, fromTheme, fromSite);
}

/** @param {string} dir @param {string} rel @param {string} pluginRootPath @param {{ path: string; data: () => import('node:fs').ReadStream }[]} out */
function walkVendorAssets(dir, rel, pluginRootPath, out) {
    for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        const relPath = rel ? `${rel}/${name}` : name;
        if (fs.statSync(abs).isDirectory()) {
            walkVendorAssets(abs, relPath, pluginRootPath, out);
        } else {
            out.push({
                path: `${pluginRootPath}vendor/${relPath}`,
                data: () => fs.createReadStream(abs),
            });
        }
    }
}

function normalizePrefer(prefer) {
    if (!Array.isArray(prefer)) return DEFAULTS.prefer.slice();
    const allowed = new Set(["webgpu", "webgl2", "canvas2d"]);
    const out = prefer.filter((k) => typeof k === "string" && allowed.has(k));
    return out.length ? out : DEFAULTS.prefer.slice();
}

function resolveLoader(config) {
    return config.loader === "bundle" ? "bundle" : "esm";
}

function resolveScriptUrl(config) {
    if (config.scriptUrl && String(config.scriptUrl).length > 0) {
        return config.scriptUrl;
    }
    const loader = resolveLoader(config);
    return defaultScriptUrl(
        loader,
        config.pluginRootPath || DEFAULTS.pluginRootPath,
    );
}

function renderInjector(config) {
    if (!config.enable) return "";
    const loader = resolveLoader(config);
    const model = JSON.stringify(config.model || "");
    const target = JSON.stringify(config.target || "#doki-live2d");
    const width = Number(config.width || 280);
    const height = Number(config.height || 400);
    const className = config.className || "doki-live2d";
    const scriptUrl = resolveScriptUrl(config);
    const prefer = normalizePrefer(config.prefer);
    const autoSway = config.autoSway !== false;
    const chrome =
        config.chrome === undefined || config.chrome === null
            ? true
            : config.chrome;
    const needsHost = (config.target || "#doki-live2d") === "#doki-live2d";
    const host = needsHost
        ? `<div id="doki-live2d" class="${className}" style="position:fixed;left:0;bottom:0;z-index:999;pointer-events:none;" aria-hidden="true"></div>\n`
        : "";

    const importMap =
        loader === "esm"
            ? `<script type="importmap">${JSON.stringify(
                  buildHexoImportMap(
                      config.pluginRootPath || DEFAULTS.pluginRootPath,
                  ),
              )}</script>\n`
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

function collectAssetRoutes(config) {
    const pluginRootPath = config.pluginRootPath || DEFAULTS.pluginRootPath;
    const loader = resolveLoader(config);
    const browserRoot = path.join(__dirname, "browser");
    /** @type {{ path: string; data: () => import('node:fs').ReadStream }[]} */
    const out = [];

    if (loader === "esm") {
        const vendorDir = path.join(browserRoot, "vendor");
        if (fs.existsSync(vendorDir)) {
            walkVendorAssets(vendorDir, "", pluginRootPath, out);
        }
        const bootstrap = path.join(
            browserRoot,
            "doki-live2d-hexo.bootstrap.mjs",
        );
        if (fs.existsSync(bootstrap)) {
            out.push({
                path: `${pluginRootPath}doki-live2d-hexo.bootstrap.mjs`,
                data: () => fs.createReadStream(bootstrap),
            });
        } else {
            return { missing: "bootstrap", routes: out };
        }
        if (out.length <= 1) {
            return { missing: "vendor", routes: out };
        }
        return { missing: null, routes: out };
    }

    const legacy = path.join(browserRoot, "doki-live2d-hexo.js");
    if (!fs.existsSync(legacy)) {
        return { missing: "legacy", routes: out };
    }
    out.push({
        path: `${pluginRootPath}doki-live2d-hexo.js`,
        data: () => fs.createReadStream(legacy),
    });
    return { missing: null, routes: out };
}

function register(hexo) {
    const config = mergeConfig(hexo);
    if (!config.enable) {
        hexo.log.info(`[${PLUGIN_ID}] disabled via live2d.enable=false`);
        return;
    }

    const loader = resolveLoader(config);
    if (loader === "bundle") {
        hexo.log.warn(
            `[${PLUGIN_ID}] live2d.loader=bundle is deprecated — switch to loader: esm`,
        );
    }

    hexo.extend.generator.register("doki-live2d-hexo-assets", () => {
        const { missing, routes } = collectAssetRoutes(config);
        if (missing === "bootstrap") {
            hexo.log.warn(
                `[${PLUGIN_ID}] missing browser/doki-live2d-hexo.bootstrap.mjs — run pnpm --filter hexo-plugin-live2d build`,
            );
            return [];
        }
        if (missing === "vendor") {
            hexo.log.warn(
                `[${PLUGIN_ID}] missing browser/vendor — run pnpm --filter hexo-plugin-live2d build`,
            );
            return [];
        }
        if (missing === "legacy") {
            hexo.log.warn(
                `[${PLUGIN_ID}] missing browser/doki-live2d-hexo.js — run pnpm --filter hexo-plugin-live2d build:legacy`,
            );
            return [];
        }
        return routes;
    });

    if (hexo.extend.injector) {
        hexo.extend.injector.register("body_end", () => renderInjector(config));
    } else {
        hexo.extend.filter.register("theme_inject", (injects) => {
            if (injects?.bodyEnd?.raw) {
                injects.bodyEnd.raw("doki-live2d-hexo", renderInjector(config));
            }
        });
    }

    const prefer = normalizePrefer(config.prefer).join("→");
    hexo.log.info(
        `[${PLUGIN_ID}] registered (loader=${loader}; model=${config.model || "(none)"}; prefer=${prefer})`,
    );
}

if (typeof hexo !== "undefined") {
    register(hexo);
}

module.exports = {
    register,
    renderInjector,
    mergeConfig,
    normalizePrefer,
    resolveLoader,
    resolveScriptUrl,
    collectAssetRoutes,
    DEFAULTS,
    PLUGIN_ID,
};

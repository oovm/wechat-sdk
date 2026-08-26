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
 *     loader: ce           # default; legacy ESM chrome: esm
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
    loader: "ce",
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
    return config.loader === "esm" ? "esm" : "ce";
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

function renderCeWidgetTag(options) {
    const parts = [
        'id="doki-live2d"',
        `class="${options.className}"`,
        `width="${options.width}"`,
        `height="${options.height}"`,
        "autoplay",
    ];
    if (options.interactive) parts.push("interactive");
    if (options.autoSway) parts.push("autosway");
    parts.push('style="position:fixed;left:0;bottom:0;z-index:999;"');
    return `<live-2d-widget ${parts.join(" ")}></live-2d-widget>\n`;
}

function renderCeInitScript(model, prefer) {
    return `<script type="module">
import "@doki-land/live2d-element";
const w = document.getElementById("doki-live2d");
if (w) {
  w.renderOptions = { prefer: ${JSON.stringify(prefer)} };
  w.model = ${JSON.stringify(model)};
}
</script>\n`;
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
    const interactive = config.chrome !== false;
    const modelText = String(config.model || "");
    const pluginRootPath = config.pluginRootPath || DEFAULTS.pluginRootPath;

    if (loader === "ce") {
        const importMap = `<script type="importmap">${JSON.stringify(
            buildHexoImportMap(pluginRootPath),
        )}</script>\n`;
        const widget = renderCeWidgetTag({
            className,
            width,
            height,
            interactive,
            autoSway,
        });
        const init = renderCeInitScript(modelText, prefer);
        return `${widget}${importMap}${init}`;
    }

    const needsHost = (config.target || "#doki-live2d") === "#doki-live2d";
    const host = needsHost
        ? `<div id="doki-live2d" class="${className}" style="position:fixed;left:0;bottom:0;z-index:999;pointer-events:none;" aria-hidden="true"></div>\n`
        : "";

    const importMap = `<script type="importmap">${JSON.stringify(
        buildHexoImportMap(pluginRootPath),
    )}</script>\n`;

    const scriptTag = `<script type="module" src="${scriptUrl}"></script>`;

    const chrome =
        config.chrome === undefined || config.chrome === null
            ? true
            : config.chrome;

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
    /** @internal test hook — not read from site `_config.yml` */
    const browserRoot =
        typeof config.browserRoot === "string"
            ? config.browserRoot
            : path.join(__dirname, "browser");
    /** @type {{ path: string; data: () => import('node:fs').ReadStream }[]} */
    const out = [];

    if (loader === "ce") {
        const elementEntry = path.join(
            browserRoot,
            "vendor",
            "live2d-element",
            "index.js",
        );
        const vendorDir = path.join(browserRoot, "vendor");
        if (fs.existsSync(vendorDir)) {
            walkVendorAssets(vendorDir, "", pluginRootPath, out);
        }
        if (!fs.existsSync(elementEntry)) {
            return { missing: "ce", routes: out };
        }
        return { missing: null, routes: out };
    }

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

    return { missing: "ce", routes: out };
}

function register(hexo) {
    const config = mergeConfig(hexo);
    if (!config.enable) {
        hexo.log.info(`[${PLUGIN_ID}] disabled via live2d.enable=false`);
        return;
    }

    const loader = resolveLoader(config);

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
        if (missing === "ce") {
            hexo.log.warn(
                `[${PLUGIN_ID}] missing browser/vendor/live2d-element — run pnpm --filter hexo-plugin-live2d build`,
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

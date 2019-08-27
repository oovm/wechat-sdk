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
 *     model: npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json
 *     prefer: [webgpu, webgl2, canvas2d]
 *     autoSway: true
 *     width: 280
 *     height: 400
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PLUGIN_ID = "hexo-plugin-live2d";

const DEFAULTS = {
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

function mergeConfig(hexo) {
    const fromSite = (hexo.config && hexo.config.live2d) || {};
    const fromTheme =
        (hexo.theme && hexo.theme.config && hexo.theme.config.live2d) || {};
    return Object.assign({}, DEFAULTS, fromTheme, fromSite);
}

function normalizePrefer(prefer) {
    if (!Array.isArray(prefer)) return DEFAULTS.prefer.slice();
    const allowed = new Set(["webgpu", "webgl2", "canvas2d"]);
    const out = prefer.filter((k) => typeof k === "string" && allowed.has(k));
    return out.length ? out : DEFAULTS.prefer.slice();
}

function renderInjector(config) {
    if (!config.enable) return "";
    const model = JSON.stringify(config.model || "");
    const target = JSON.stringify(config.target || "#doki-live2d");
    const width = Number(config.width || 280);
    const height = Number(config.height || 400);
    const className = config.className || "doki-live2d";
    const scriptUrl = config.scriptUrl || DEFAULTS.scriptUrl;
    const prefer = normalizePrefer(config.prefer);
    const autoSway = config.autoSway !== false;
    const needsHost = (config.target || "#doki-live2d") === "#doki-live2d";
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

function register(hexo) {
    const config = mergeConfig(hexo);
    if (!config.enable) {
        hexo.log.info(`[${PLUGIN_ID}] disabled via live2d.enable=false`);
        return;
    }

    hexo.extend.generator.register("doki-live2d-hexo-assets", () => {
        const browserEntry = path.join(
            __dirname,
            "browser",
            "doki-live2d-hexo.js",
        );
        if (!fs.existsSync(browserEntry)) {
            hexo.log.warn(
                `[${PLUGIN_ID}] missing browser/doki-live2d-hexo.js — run pnpm --filter hexo-plugin-live2d build`,
            );
            return [];
        }
        return {
            path: `${config.pluginRootPath}doki-live2d-hexo.js`,
            data: () => fs.createReadStream(browserEntry),
        };
    });

    if (hexo.extend.injector) {
        hexo.extend.injector.register("body_end", () => renderInjector(config));
    } else {
        hexo.extend.filter.register("theme_inject", (injects) => {
            if (injects && injects.bodyEnd && injects.bodyEnd.raw) {
                injects.bodyEnd.raw("doki-live2d-hexo", renderInjector(config));
            }
        });
    }

    const prefer = normalizePrefer(config.prefer).join("→");
    hexo.log.info(
        `[${PLUGIN_ID}] registered (model=${config.model || "(none)"}; prefer=${prefer})`,
    );
}

// Hexo loads plugins with a global `hexo` binding.
if (typeof hexo !== "undefined") {
    register(hexo);
}

module.exports = {
    register,
    renderInjector,
    mergeConfig,
    normalizePrefer,
    DEFAULTS,
    PLUGIN_ID,
};

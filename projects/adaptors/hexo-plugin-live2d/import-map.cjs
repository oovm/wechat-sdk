"use strict";

/** @param {string} pluginRootPath */
function normalizePublicPrefix(pluginRootPath) {
    let p = pluginRootPath || "live2dw/";
    if (!p.startsWith("/")) p = `/${p}`;
    if (!p.endsWith("/")) p = `${p}/`;
    return p;
}

/** @param {string} pluginRootPath */
function buildHexoImportMap(pluginRootPath) {
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
        },
    };
}

/** @param {"esm" | "bundle"} loader @param {string} pluginRootPath */
function defaultScriptUrl(loader, pluginRootPath) {
    const root = normalizePublicPrefix(pluginRootPath);
    if (loader === "bundle") {
        return `${root}doki-live2d-hexo.js`;
    }
    return `${root}doki-live2d-hexo.bootstrap.mjs`;
}

module.exports = {
    buildHexoImportMap,
    defaultScriptUrl,
    normalizePublicPrefix,
};

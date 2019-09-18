/**
 * Thin ESM bootstrap — runtime lives in browser/vendor/ (import map).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(root, "..");

await esbuild.build({
    absWorkingDir: pkgRoot,
    entryPoints: [join(pkgRoot, "src/browser-entry.ts")],
    outfile: join(pkgRoot, "browser/doki-live2d-hexo.bootstrap.mjs"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    logLevel: "info",
    external: ["@doki-land/live2d", "@doki-land/live2d-widget"],
});

console.log("wrote browser/doki-live2d-hexo.bootstrap.mjs");

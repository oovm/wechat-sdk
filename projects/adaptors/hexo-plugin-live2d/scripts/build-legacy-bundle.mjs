/**
 * Deprecated IIFE monolith (loader: bundle). Scheduled for removal.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(root, "..");

await esbuild.build({
    absWorkingDir: pkgRoot,
    entryPoints: [join(pkgRoot, "src/browser-entry.ts")],
    outfile: join(pkgRoot, "browser/doki-live2d-hexo.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    sourcemap: true,
    logLevel: "info",
});

console.warn(
    "hexo build-legacy: wrote deprecated browser/doki-live2d-hexo.js — prefer loader: esm",
);

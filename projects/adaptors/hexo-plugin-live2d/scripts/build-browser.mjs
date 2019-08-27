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
    // Workspace packages resolve via pnpm links from this package.
});

console.log("wrote browser/doki-live2d-hexo.js");

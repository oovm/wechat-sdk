/**
 * Copy prebuilt @doki-land/* dist into browser/vendor/ for Hexo ESM loader.
 * Run after `pnpm build` on core packages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pkgRoot, "../../..");
const vendorRoot = path.join(pkgRoot, "browser", "vendor");

/** @type {{ dir: string; vendorName: string }[]} */
const VENDOR_PACKAGES = [
    { dir: "projects/live2d", vendorName: "live2d" },
    { dir: "projects/live2d-core", vendorName: "live2d-core" },
    { dir: "projects/live2d-loader", vendorName: "live2d-loader" },
    { dir: "projects/live2d-renderer", vendorName: "live2d-renderer" },
    { dir: "projects/live2d-widget", vendorName: "live2d-widget" },
    { dir: "projects/live2d-element", vendorName: "live2d-element" },
];

function copyTree(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
        if (name.endsWith(".map")) continue;
        const from = path.join(src, name);
        const to = path.join(dest, name);
        if (fs.statSync(from).isDirectory()) copyTree(from, to);
        else fs.copyFileSync(from, to);
    }
}

fs.rmSync(vendorRoot, { recursive: true, force: true });

for (const { dir, vendorName } of VENDOR_PACKAGES) {
    const dist = path.join(repoRoot, dir, "dist");
    if (!fs.existsSync(dist)) {
        console.error(
            `hexo sync-vendor: missing ${dist} — run pnpm build on @doki-land/* first`,
        );
        process.exit(1);
    }
    copyTree(dist, path.join(vendorRoot, vendorName));
    console.log(`hexo sync-vendor: ${vendorName}`);
}

console.log(`hexo sync-vendor: wrote ${vendorRoot}`);

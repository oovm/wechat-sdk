/**
 * Copy built @doki-land/* dist into live2d-element fixtures/.vendor/
 * for Playwright CE browser-matrix (CI Chromium gate).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

/** @type {{ dir: string; vendorName: string }[]} */
const VENDOR_PACKAGES = [
    { dir: "projects/live2d", vendorName: "live2d" },
    { dir: "projects/live2d-core", vendorName: "live2d-core" },
    { dir: "projects/live2d-loader", vendorName: "live2d-loader" },
    { dir: "projects/live2d-renderer", vendorName: "live2d-renderer" },
    { dir: "projects/live2d-widget", vendorName: "live2d-widget" },
    { dir: "projects/live2d-element", vendorName: "live2d-element" },
];

const vendorRoot = path.join(ROOT, "projects/live2d-element/fixtures/.vendor");

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
    const dist = path.join(ROOT, dir, "dist");
    if (!fs.existsSync(dist)) {
        console.error(
            `prepare-ce-browser-fixture: missing ${dist} — run pnpm build first`,
        );
        process.exit(1);
    }
    copyTree(dist, path.join(vendorRoot, vendorName));
}

console.log(`prepare-ce-browser-fixture: wrote ${vendorRoot}`);

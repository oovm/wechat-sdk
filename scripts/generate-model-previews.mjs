/**
 * Local-only: render catalog path-sources to PNG under
 * `projects/homepage/public/models/previews/`.
 *
 * Not run in CI. Maintainers / contributors:
 *   pnpm --filter @doki-land/live2d-homepage exec playwright install chromium
 *   LIVE2D_PREVIEW_DEV=1 pnpm --filter @doki-land/live2d-homepage generate:previews
 *
 * Does not rewrite catalog.json — previews are optional files named `{id}.png`.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
    isPathSource,
    listGalleryModels,
    loadModelsCatalog,
    previewUrlFor,
} from "./models-catalog.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const homepageRoot = join(here, "..", "projects", "homepage");
const publicModels = join(homepageRoot, "public", "models");
const previewDir = join(publicModels, "previews");
const useDev = process.env.LIVE2D_PREVIEW_DEV === "1";
const port = Number(process.env.LIVE2D_PREVIEW_PORT || 4179);
const size = Number(process.env.LIVE2D_PREVIEW_SIZE || 512);
const onlyLocal =
    process.env.LIVE2D_PREVIEW_LOCAL_ONLY !== "0" &&
    process.env.LIVE2D_PREVIEW_LOCAL_ONLY !== "false";

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function waitHttp(url, attempts = 60) {
    for (let i = 0; i < attempts; i += 1) {
        try {
            const res = await fetch(url);
            if (res.ok || res.status === 404) return;
        } catch {
            // retry
        }
        await sleep(500);
    }
    throw new Error(`server not ready: ${url}`);
}

function startServer() {
    const dist = join(homepageRoot, "dist");
    const cmd = useDev || !existsSync(dist) ? "dev" : "preview";
    const args =
        cmd === "dev"
            ? ["exec", "vite", "--port", String(port), "--strictPort"]
            : [
                  "exec",
                  "vite",
                  "preview",
                  "--port",
                  String(port),
                  "--strictPort",
              ];
    console.log(`[previews] starting vite ${cmd} on :${port}`);
    const child = spawn("pnpm", args, {
        cwd: homepageRoot,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        env: { ...process.env },
    });
    child.stdout.on("data", (d) => process.stdout.write(d));
    child.stderr.on("data", (d) => process.stderr.write(d));
    return child;
}

async function main() {
    const catalog = loadModelsCatalog();
    let presets = listGalleryModels(catalog).filter((p) =>
        isPathSource(p.source),
    );
    if (onlyLocal) {
        presets = presets.filter((p) => p.local);
    }
    if (!presets.length) {
        console.warn("[previews] no path-source models to capture");
        return;
    }

    mkdirSync(previewDir, { recursive: true });
    const server = startServer();
    const base = `http://127.0.0.1:${port}`;
    try {
        await waitHttp(`${base}/models/catalog.json`);
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({
            viewport: { width: size + 40, height: size + 80 },
            deviceScaleFactor: 1,
        });

        for (const preset of presets) {
            const url = `${base}/_capture?preset=${encodeURIComponent(preset.id)}&w=${size}&h=${size}`;
            console.log(
                `[previews] capture ${preset.id} → ${previewUrlFor(preset)}`,
            );
            await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
            const result = await page.waitForFunction(
                () => {
                    const api = window.__LIVE2D_CAPTURE__;
                    if (!api) return null;
                    if (api.ready && api.pngBase64) return api;
                    if (api.error) return api;
                    return null;
                },
                { timeout: 120_000 },
            );
            const api = await result.jsonValue();
            if (!api?.pngBase64) {
                console.warn(
                    `[previews] skip ${preset.id}: ${api?.error ?? "no png"}`,
                );
                continue;
            }
            const out = join(previewDir, `${preset.id}.png`);
            writeFileSync(out, Buffer.from(api.pngBase64, "base64"));
            console.log(`[previews] wrote ${out}`);
        }

        await browser.close();
    } finally {
        server.kill("SIGTERM");
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

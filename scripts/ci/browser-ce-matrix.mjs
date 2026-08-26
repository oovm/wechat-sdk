/**
 * Playwright Chromium gate: CE load/render/DPR/disconnect on static fixture.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

const FIXTURE_ROOT = path.join(ROOT, "projects/live2d-element/fixtures");
const PORT = Number(process.env.CE_MATRIX_PORT || 8765);

function contentType(filePath) {
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    return "application/octet-stream";
}

function startServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url?.split("?")[0] ?? "/");
            const rel = urlPath === "/" ? "/browser-matrix.html" : urlPath;
            const abs = path.join(FIXTURE_ROOT, rel.replace(/^\//, ""));
            if (!abs.startsWith(FIXTURE_ROOT)) {
                res.writeHead(403);
                res.end("forbidden");
                return;
            }
            if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
                res.writeHead(404);
                res.end("not found");
                return;
            }
            res.writeHead(200, { "Content-Type": contentType(abs) });
            fs.createReadStream(abs).pipe(res);
        });
        server.on("error", reject);
        server.listen(PORT, "127.0.0.1", () => resolve(server));
    });
}

async function waitStatus(page, state, timeout = 30_000) {
    await page.waitForFunction(
        (expected) =>
            document.getElementById("status")?.dataset.state === expected,
        state,
        { timeout },
    );
}

async function runScenario(page, name, fn) {
    try {
        await fn();
        return { name, ok: true };
    } catch (error) {
        return {
            name,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function main() {
    const vendor = path.join(FIXTURE_ROOT, ".vendor/live2d-element/index.js");
    if (!fs.existsSync(vendor)) {
        console.error(
            "browser-ce-matrix: missing fixtures/.vendor — run prepare-ce-browser-fixture first",
        );
        process.exit(1);
    }

    const server = await startServer();
    const base = `http://127.0.0.1:${PORT}`;
    const browser = await chromium.launch({ headless: true });
    const results = [];

    try {
        {
            const page = await browser.newPage();
            await page.goto(`${base}/browser-matrix.html`);
            results.push(
                await runScenario(page, "load-ready", async () => {
                    await waitStatus(page, "ready");
                    const renderer = await page.getAttribute(
                        "#actor",
                        "data-renderer",
                    );
                    if (!renderer) throw new Error("missing data-renderer");
                }),
            );
            await page.close();
        }

        {
            const page = await browser.newPage();
            await page.goto(`${base}/browser-matrix.html`);
            results.push(
                await runScenario(page, "render-live-canvas", async () => {
                    await waitStatus(page, "ready");
                    const phase = await page.getAttribute(
                        "#actor",
                        "data-phase",
                    );
                    if (phase !== "live") {
                        throw new Error(
                            `expected data-phase=live got ${phase}`,
                        );
                    }
                    const size = await page.evaluate(() => {
                        const canvas = document.querySelector("#actor canvas");
                        return canvas
                            ? { w: canvas.width, h: canvas.height }
                            : { w: 0, h: 0 };
                    });
                    if (size.w <= 0 || size.h <= 0) {
                        throw new Error(
                            `canvas has zero dimensions: ${JSON.stringify(size)}`,
                        );
                    }
                }),
            );
            await page.close();
        }

        for (const dpr of [1, 2]) {
            const context = await browser.newContext({
                deviceScaleFactor: dpr,
            });
            const page = await context.newPage();
            await page.goto(`${base}/browser-matrix.html`);
            results.push(
                await runScenario(page, `dpr-${dpr}`, async () => {
                    await waitStatus(page, "ready");
                    const size = await page.evaluate(() => {
                        const canvas = document.querySelector("#actor canvas");
                        return canvas
                            ? { w: canvas.width, h: canvas.height }
                            : { w: 0, h: 0 };
                    });
                    const min = 128 * dpr;
                    if (size.w < min || size.h < min) {
                        throw new Error(
                            `DPR ${dpr} canvas too small: ${JSON.stringify(size)}`,
                        );
                    }
                }),
            );
            await context.close();
        }

        {
            const page = await browser.newPage();
            await page.goto(`${base}/browser-matrix.html?scenario=missing`);
            results.push(
                await runScenario(page, "missing-model-error", async () => {
                    await waitStatus(page, "error");
                }),
            );
            await page.close();
        }

        {
            const page = await browser.newPage();
            await page.goto(`${base}/browser-matrix.html`);
            await waitStatus(page, "ready");
            results.push(
                await runScenario(page, "disconnect-no-throw", async () => {
                    await page.evaluate(() => {
                        const el = document.getElementById("actor");
                        el?.remove();
                    });
                    await page.waitForTimeout(100);
                }),
            );
            await page.close();
        }
    } finally {
        await browser.close();
        server.close();
    }

    const failed = results.filter((r) => !r.ok);
    const summary = {
        ok: failed.length === 0,
        scenarios: results,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (failed.length) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

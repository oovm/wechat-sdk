/**
 * Sync model assets declared in the hand-edited catalog:
 * `projects/homepage/public/models/catalog.json`.
 *
 * - Does **not** rewrite the models list (contributions edit catalog.json).
 * - Only syncs entries with `local: true` (`sample` / `npm` / `fixture`).
 * - Preview PNGs are never generated here (see generate-model-previews.mjs).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listLocalModels, loadModelsCatalog } from "./models-catalog.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "..");
const homepageRoot = join(workspaceRoot, "projects", "homepage");
const sparkRoot = join(workspaceRoot, "..");
const refRepos = join(sparkRoot, "live2d-ts-ref-repos");
const publicModels = join(homepageRoot, "public", "models");
const requireLocalSamples =
    process.env.LIVE2D_REQUIRE_LOCAL_SAMPLES === "1" ||
    process.env.LIVE2D_REQUIRE_LOCAL_SAMPLES === "true";

function copyTree(src, dest) {
    mkdirSync(dirname(dest), { recursive: true });
    if (process.platform === "win32") {
        const r = spawnSync(
            "robocopy",
            [
                src,
                dest,
                "/E",
                "/NFL",
                "/NDL",
                "/NJH",
                "/NJS",
                "/nc",
                "/ns",
                "/np",
            ],
            { encoding: "utf8" },
        );
        const code = r.status ?? 0;
        if (code >= 8) {
            throw new Error(`robocopy failed (${code}): ${src} -> ${dest}`);
        }
        return;
    }
    spawnSync("rm", ["-rf", dest], { stdio: "ignore" });
    mkdirSync(dirname(dest), { recursive: true });
    const r = spawnSync("cp", ["-R", src, dest], { encoding: "utf8" });
    if (r.status !== 0) {
        throw new Error(`cp failed: ${src} -> ${dest}`);
    }
}

const catalog = loadModelsCatalog();
const localModels = listLocalModels(catalog);

const needsRefSamples = localModels.some((m) => m.sample);
const syncRef = join(refRepos, "scripts", "sync-sample-models.mjs");
if (needsRefSamples && existsSync(syncRef)) {
    const r = spawnSync(process.execPath, [syncRef], { stdio: "inherit" });
    if ((r.status ?? 1) !== 0) {
        throw new Error("ref-repos sync-sample-models failed");
    }
}

const sampleRoot = join(refRepos, "sample-models");
mkdirSync(publicModels, { recursive: true });

const require = createRequire(import.meta.url);

for (const model of localModels) {
    if (model.sample) {
        const src = join(sampleRoot, model.sample);
        if (!existsSync(src)) {
            const msg = `missing sample ${model.sample} for ${model.id}: ${src}`;
            if (requireLocalSamples) throw new Error(msg);
            console.warn(`[sync-models] skip ${msg}`);
            continue;
        }
        copyTree(src, join(publicModels, "samples", model.sample));
        console.log("synced sample", model.sample, "→", model.id);
        continue;
    }

    if (model.npm) {
        const pkgName = model.npm.package;
        const assetsDir = model.npm.assets ?? "assets";
        const destId = model.npm.dest;
        try {
            const pkgJson = require.resolve(`${pkgName}/package.json`, {
                paths: [homepageRoot, workspaceRoot],
            });
            const assets = join(dirname(pkgJson), assetsDir);
            if (!existsSync(assets)) {
                console.warn("npm package missing assets:", pkgName);
                continue;
            }
            copyTree(assets, join(publicModels, "npm", destId, assetsDir));
            console.log("synced npm", pkgName, "→", destId);
        } catch {
            console.warn("npm package not installed yet:", pkgName);
        }
        continue;
    }

    if (model.fixture === "cpu-quad") {
        // written below via write-fixtures.mjs
        continue;
    }

    console.warn(
        `[sync-models] local model ${model.id} has no sample/npm/fixture — nothing to copy`,
    );
}

const dki = spawnSync(process.execPath, [join(here, "write-fixtures.mjs")], {
    stdio: "inherit",
});
if ((dki.status ?? 1) !== 0) {
    throw new Error("write-fixtures failed");
}

console.log(
    `catalog ok: ${catalog.models.length} models (${localModels.length} local)`,
);

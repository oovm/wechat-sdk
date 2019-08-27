/**
 * Sync real moc2/moc3 samples + CPU program fixture into
 * `projects/homepage/public/models`.
 *
 * Local samples come from sibling `live2d-ts-ref-repos/sample-models`
 * (dev machine only). CI / Cloudflare may omit that tree; then local
 * presets are skipped and remote/npm presets remain in catalog.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const syncRef = join(refRepos, "scripts", "sync-sample-models.mjs");
if (existsSync(syncRef)) {
    const r = spawnSync(process.execPath, [syncRef], { stdio: "inherit" });
    if ((r.status ?? 1) !== 0) {
        throw new Error("ref-repos sync-sample-models failed");
    }
}

const sampleRoot = join(refRepos, "sample-models");
mkdirSync(publicModels, { recursive: true });

const localCopies = [
    ["moc3-wanko", join(sampleRoot, "moc3-wanko")],
    ["moc2-hijiki", join(sampleRoot, "moc2-hijiki")],
    ["moc2-tororo", join(sampleRoot, "moc2-tororo")],
];

const syncedLocal = [];
for (const [id, src] of localCopies) {
    if (!existsSync(src)) {
        const msg = `missing sample ${id}: ${src}`;
        if (requireLocalSamples) {
            throw new Error(msg);
        }
        console.warn(`[sync-models] skip ${msg}`);
        continue;
    }
    copyTree(src, join(publicModels, "samples", id));
    syncedLocal.push(id);
    console.log("synced local sample", id);
}

const require = createRequire(import.meta.url);
const npmPackages = [
    { id: "npm-hijiki", pkg: "live2d-widget-model-hijiki", assets: "assets" },
    { id: "npm-tororo", pkg: "live2d-widget-model-tororo", assets: "assets" },
];

for (const item of npmPackages) {
    try {
        const pkgJson = require.resolve(`${item.pkg}/package.json`, {
            paths: [homepageRoot, workspaceRoot],
        });
        const assets = join(dirname(pkgJson), item.assets);
        if (!existsSync(assets)) {
            console.warn("npm package missing assets:", item.pkg);
            continue;
        }
        copyTree(assets, join(publicModels, "npm", item.id));
        console.log("synced npm package", item.pkg, "→", item.id);
    } catch {
        console.warn("npm package not installed yet:", item.pkg);
    }
}

const dki = spawnSync(process.execPath, [join(here, "write-fixtures.mjs")], {
    stdio: "inherit",
});
if ((dki.status ?? 1) !== 0) {
    throw new Error("write-fixtures failed");
}

/** @type {{ id: string; label: string; source: string }[]} */
const presets = [
    {
        id: "cpu-quad",
        label: "Local CPU program (quad)",
        source: "/models/quad/quad.model3.json",
    },
];

if (syncedLocal.includes("moc3-wanko")) {
    presets.push({
        id: "local-wanko",
        label: "Local moc3 Wanko",
        source: "/models/samples/moc3-wanko/Wanko.model3.json",
    });
}
if (syncedLocal.includes("moc2-hijiki")) {
    presets.push({
        id: "local-hijiki",
        label: "Local moc2 Hijiki",
        source: "/models/samples/moc2-hijiki/hijiki.model.json",
    });
}
if (existsSync(join(publicModels, "npm", "npm-hijiki", "hijiki.model.json"))) {
    presets.push({
        id: "npm-mirrored-hijiki",
        label: "npm package (mirrored) Hijiki",
        source: "/models/npm/npm-hijiki/hijiki.model.json",
    });
}

presets.push(
    {
        id: "npm-cdn-hijiki",
        label: "npm: CDN Hijiki",
        source: "npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json",
    },
    {
        id: "npm-cdn-tororo",
        label: "npm: CDN Tororo",
        source: "npm:live2d-widget-model-tororo@1.0.5/assets/tororo.model.json",
    },
    {
        id: "remote-wanko",
        label: "Remote moc3 Wanko (jsDelivr gh)",
        source: "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@b1de66b/Samples/Resources/Wanko/Wanko.model3.json",
    },
);

writeFileSync(
    join(publicModels, "catalog.json"),
    `${JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            presets,
        },
        null,
        2,
    )}\n`,
);

console.log("wrote", join(publicModels, "catalog.json"));

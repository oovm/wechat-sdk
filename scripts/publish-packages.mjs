/**
 * Publish workspace packages as 0.0.0 placeholders on npm.
 *
 * Order: core → loader/renderer → facade → widget → adaptors.
 * Homepage is private and skipped.
 *
 * Usage:
 *   node scripts/publish-packages.mjs              # dry-run (default)
 *   node scripts/publish-packages.mjs --dry-run
 *   node scripts/publish-packages.mjs --yes         # real publish
 *   node scripts/publish-packages.mjs --yes --otp=123456
 *   node scripts/publish-packages.mjs --yes --skip-build
 *
 * Env:
 *   LIVE2D_PUBLISH_YES=1     same as --yes
 *   npm_config_otp=…         2FA OTP (or pass --otp=)
 *
 * Requires: logged-in npm user with publish rights for `@doki-land/*`
 * and unscoped `vue-plugin-live2d` / `hexo-plugin-live2d` / `cocos-plugin-live2d`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = "0.0.0";

/** @type {{ dir: string; build?: boolean }[]} */
const PACKAGES = [
    { dir: "projects/live2d-core", build: true },
    { dir: "projects/live2d-loader", build: true },
    { dir: "projects/live2d-renderer", build: true },
    { dir: "projects/live2d", build: true },
    { dir: "projects/live2d-widget", build: true },
    { dir: "projects/adaptors/vue-plugin-live2d", build: false },
    { dir: "projects/adaptors/hexo-plugin-live2d", build: true },
    { dir: "projects/adaptors/cocos-plugin-live2d", build: false },
];

const args = process.argv.slice(2);
const argSet = new Set(args);
const yes =
    argSet.has("--yes") ||
    process.env.LIVE2D_PUBLISH_YES === "1" ||
    process.env.LIVE2D_PUBLISH_YES === "true";
const dryRun = !yes || argSet.has("--dry-run");
const skipBuild = argSet.has("--skip-build");
const tag = "latest";
const otpArg = args.find((a) => a.startsWith("--otp="));
const otp = otpArg?.slice("--otp=".length) || process.env.npm_config_otp || "";

function run(command, commandArgs, cwd) {
    console.log(`\n> ${command} ${commandArgs.join(" ")}  (cwd=${cwd})`);
    const r = spawnSync(command, commandArgs, {
        cwd,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: process.env,
    });
    if ((r.status ?? 1) !== 0) {
        throw new Error(`command failed (${r.status}): ${command}`);
    }
}

/** @returns {boolean} */
function versionExistsOnNpm(name, version) {
    const r = spawnSync(
        "npm",
        ["view", `${name}@${version}`, "version", "--json"],
        {
            encoding: "utf8",
            shell: process.platform === "win32",
            env: process.env,
        },
    );
    if ((r.status ?? 1) !== 0) return false;
    const out = (r.stdout || "").trim();
    if (!out || out === "null" || out.startsWith("E404")) return false;
    try {
        const parsed = JSON.parse(out);
        if (Array.isArray(parsed)) return parsed.includes(version);
        return parsed === version || String(parsed) === version;
    } catch {
        return out.includes(version);
    }
}

function readPkg(dir) {
    const path = join(root, dir, "package.json");
    return {
        path,
        json: JSON.parse(readFileSync(path, "utf8")),
    };
}

function main() {
    console.log(
        dryRun
            ? "[publish] DRY RUN — pass --yes to publish for real"
            : "[publish] LIVE publish to npm (0.0.0 placeholders)",
    );

    /** @type {{ dir: string; name: string; build?: boolean }[]} */
    const queue = [];
    for (const item of PACKAGES) {
        const { json } = readPkg(item.dir);
        if (json.private === true) {
            console.log(`[publish] skip private ${json.name}`);
            continue;
        }
        if (json.version !== VERSION) {
            throw new Error(
                `${json.name} version is ${json.version}, expected ${VERSION}`,
            );
        }
        if (!json.publishConfig?.access) {
            throw new Error(`${json.name} missing publishConfig.access`);
        }
        if (versionExistsOnNpm(json.name, VERSION)) {
            console.log(
                `[publish] skip ${json.name}@${VERSION} (already on npm)`,
            );
            continue;
        }
        queue.push({ ...item, name: json.name });
    }

    if (!queue.length) {
        console.log("[publish] nothing to publish");
        return;
    }

    console.log("[publish] packages:");
    for (const p of queue) console.log(`  - ${p.name} (${p.dir})`);

    if (!skipBuild) {
        for (const p of queue) {
            if (!p.build) continue;
            const pkgJson = readPkg(p.dir).json;
            if (!pkgJson.scripts?.build) continue;
            run("pnpm", ["run", "build"], join(root, p.dir));
            if (pkgJson.publishConfig?.main?.includes("/dist/")) {
                const distEntry = join(root, p.dir, "dist", "index.js");
                if (!existsSync(distEntry)) {
                    throw new Error(`missing build output: ${distEntry}`);
                }
            }
        }
    } else {
        console.log("[publish] --skip-build");
    }

    for (const p of queue) {
        const publishArgs = [
            "publish",
            "--access",
            "public",
            "--tag",
            tag,
            "--no-git-checks",
        ];
        if (dryRun) publishArgs.push("--dry-run");
        if (otp) publishArgs.push(`--otp=${otp}`);
        run("pnpm", publishArgs, join(root, p.dir));
    }

    console.log(
        dryRun
            ? "\n[publish] dry-run complete. Re-run with --yes to publish."
            : "\n[publish] done. Verify: npm view @doki-land/live2d-core version",
    );
}

try {
    main();
} catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
}

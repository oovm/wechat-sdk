/**
 * Fail when generated hexo browser assets are tracked in git.
 * Source lives in repo; vendor/bootstrap/legacy bundle are build outputs only.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

const TRACKED_PREFIX = "projects/adaptors/hexo-plugin-live2d/browser/";
const ALLOWED = new Set([
    `${TRACKED_PREFIX}.gitkeep`,
]);

const r = spawnSync("git", ["ls-files", TRACKED_PREFIX], {
    cwd: ROOT,
    encoding: "utf8",
});

if (r.status !== 0) {
    console.error("check-no-generated-assets: git ls-files failed");
    process.exit(r.status ?? 1);
}

const tracked = String(r.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !ALLOWED.has(line));

if (tracked.length > 0) {
    console.error(
        "check-no-generated-assets: do not commit hexo browser build outputs:",
    );
    for (const line of tracked) console.error(`  ${line}`);
    console.error(
        "Run: git rm --cached <path> and keep projects/adaptors/hexo-plugin-live2d/.gitignore",
    );
    process.exit(1);
}

console.log("check-no-generated-assets: ok (no tracked hexo browser outputs)");

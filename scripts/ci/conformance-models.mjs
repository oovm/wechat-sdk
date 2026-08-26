/**
 * S4: model / MOC compatibility matrix gate.
 * Prepares offline corpus (cpu-quad + npm mirror) then runs vitest matrix.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function runNode(scriptRel, label) {
    const script = path.join(ROOT, scriptRel);
    const r = spawnSync(process.execPath, [script], {
        cwd: ROOT,
        stdio: "inherit",
    });
    if ((r.status ?? 1) !== 0) {
        console.error(`conformance:models: ${label} failed`);
        process.exit(r.status ?? 1);
    }
}

function runPnpm(args, label) {
    const r = spawnSync("pnpm", args, {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
    });
    if ((r.status ?? 1) !== 0) {
        console.error(`conformance:models: ${label} failed`);
        process.exit(r.status ?? 1);
    }
}

runNode("scripts/write-fixtures.mjs", "write-fixtures");
runNode("scripts/sync-models.mjs", "sync-models");
runPnpm(
    [
        "--filter",
        "@doki-land/live2d-renderer",
        "exec",
        "vitest",
        "run",
        "tests/model-conformance.test.ts",
    ],
    "vitest model-conformance",
);

console.log("conformance:models: ok");

/**
 * S7: generate + validate `dist/benchmark.proof.json` (`03` §5 self metrics).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);
const PROOF = path.join(ROOT, "dist/benchmark.proof.json");

function runNode(scriptRel, label) {
    const script = path.join(ROOT, scriptRel);
    const r = spawnSync(process.execPath, [script], {
        cwd: ROOT,
        stdio: "inherit",
    });
    if ((r.status ?? 1) !== 0) {
        console.error(`benchmark:proof: ${label} failed`);
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
        console.error(`benchmark:proof: ${label} failed`);
        process.exit(r.status ?? 1);
    }
}

if (existsSync(PROOF)) {
    try {
        unlinkSync(PROOF);
    } catch {
        // ignore
    }
}

runNode("scripts/write-fixtures.mjs", "write-fixtures");
runPnpm(
    [
        "--filter",
        "@doki-land/live2d",
        "exec",
        "vitest",
        "run",
        "tests/bench/benchmark-proof.test.ts",
    ],
    "vitest benchmark-proof",
);

if (!existsSync(PROOF)) {
    console.error(`benchmark:proof: missing ${PROOF}`);
    process.exit(1);
}

const proof = JSON.parse(readFileSync(PROOF, "utf8"));
if (proof.kind !== "benchmark-proof") {
    console.error("benchmark:proof: kind must be benchmark-proof");
    process.exit(1);
}
if (proof.claims?.fasterThanOfficialSdk !== false) {
    console.error("benchmark:proof: must not claim fasterThanOfficialSdk");
    process.exit(1);
}
if (proof.schemaVersion !== 1) {
    console.error("benchmark:proof: unexpected schemaVersion");
    process.exit(1);
}
const curve = proof.metrics?.actorScaleCurve?.points;
if (!Array.isArray(curve) || curve.length < 4) {
    console.error("benchmark:proof: actorScaleCurve must cover 1/2/4/8");
    process.exit(1);
}
if (proof.officialSdkCompare?.status !== "handoff") {
    console.error("benchmark:proof: officialSdkCompare must stay handoff here");
    process.exit(1);
}

console.log(`benchmark:proof: ok → ${PROOF}`);

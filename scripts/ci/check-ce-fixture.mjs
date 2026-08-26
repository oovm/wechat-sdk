/**
 * Static gate: native HTML CE dogfood fixture must stay wired.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

const FIXTURE = path.join(ROOT, "projects/live2d-element/fixtures/index.html");

const html = fs.readFileSync(FIXTURE, "utf8");

const required = [
    "<live-2d",
    "@doki-land/live2d-element",
    "live2d-ready",
    "live2d-error",
];

const missing = required.filter((needle) => !html.includes(needle));
if (missing.length > 0) {
    console.error("check-ce-fixture: fixture missing required markers:");
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
}

console.log("check-ce-fixture: ok (native HTML dogfood fixture present)");

/**
 * S8: publish surface sanity — package set parity + CC0 license fields.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
);

/** Keep aligned with scripts/ci/publish-npm.mjs + publish-placeholder.mjs. */
const EXPECTED = [
    "@doki-land/live2d-core",
    "@doki-land/live2d-loader",
    "@doki-land/live2d-renderer",
    "@doki-land/live2d",
    "@doki-land/live2d-widget",
    "@doki-land/live2d-element",
    "vue-plugin-live2d",
    "react-plugin-live2d",
    "cocos-plugin-live2d",
    "@vmz/plugin-live2d",
];

const DIRS = [
    "projects/live2d-core",
    "projects/live2d-loader",
    "projects/live2d-renderer",
    "projects/live2d",
    "projects/live2d-widget",
    "projects/live2d-element",
    "projects/adaptors/vue-plugin-live2d",
    "projects/adaptors/react-plugin-live2d",
    "projects/adaptors/cocos-plugin-live2d",
    "projects/adaptors/vmz-plugin-live2d",
];

function fail(msg) {
    console.error(`publish-surface: ${msg}`);
    process.exit(1);
}

const names = [];
for (const dir of DIRS) {
    const pkg = JSON.parse(
        readFileSync(path.join(ROOT, dir, "package.json"), "utf8"),
    );
    names.push(pkg.name);
    if (pkg.license !== "CC0-1.0") {
        fail(`${pkg.name} license must be CC0-1.0 (got ${pkg.license})`);
    }
}

if (JSON.stringify(names) !== JSON.stringify(EXPECTED)) {
    fail(
        `publish dirs/names mismatch\n  got: ${names.join(", ")}\n  expect: ${EXPECTED.join(", ")}`,
    );
}

const reactReadme = readFileSync(
    path.join(ROOT, "projects/adaptors/react-plugin-live2d/README.md"),
    "utf8",
);
if (!/transition/i.test(reactReadme)) {
    fail("react-plugin-live2d README must mark transitional");
}

console.log("publish-surface: ok (CC0 + package set + react transitional)");
console.log(
    "vmz-ce: blocked on `vmz build --target custom-element`; current CE is pure TS. Target ids when VMZ lands: custom-element-contract / custom-element-output.",
);

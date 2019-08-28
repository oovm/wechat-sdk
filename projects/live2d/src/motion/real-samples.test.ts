import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateMotion3 } from "./evaluate-curve.js";
import { parseMotion3 } from "./parse-motion3.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const catalogPath = join(
    repoRoot,
    "projects/homepage/public/models/catalog.json",
);

interface CatalogModel {
    id: string;
    source: string;
    local: boolean;
    sample?: string;
}

function motionCandidate(sample: string, file: string): string {
    return join(
        repoRoot,
        "..",
        "live2d-ts-ref-repos",
        "sample-models",
        sample,
        "motions",
        file,
    );
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    models: CatalogModel[];
};

const localSamples = catalog.models.filter((m) => m.local && m.sample);

const wanko = localSamples.find((m) => m.sample === "moc3-wanko");
const haru = localSamples.find((m) => m.sample === "moc3-haru");

const wankoIdle = wanko
    ? motionCandidate(wanko.sample!, "idle_01.motion3.json")
    : "";
const haruIdle = haru
    ? motionCandidate(haru.sample!, "haru_g_idle.motion3.json")
    : "";

describe.skipIf(!wanko || !existsSync(wankoIdle))("real Wanko motion3", () => {
    it("parses and samples idle_01", () => {
        const json = JSON.parse(readFileSync(wankoIdle, "utf8"));
        const clip = parseMotion3(json);
        expect(clip.duration).toBeGreaterThan(0);
        expect(clip.curves.length).toBeGreaterThan(0);
        const samples = evaluateMotion3(clip, clip.duration * 0.5);
        expect(samples.length).toBe(clip.curves.length);
    });
});

describe.skipIf(!haru || !existsSync(haruIdle))("real Haru motion3", () => {
    it("parses idle with Parameter + PartOpacity curves", () => {
        const json = JSON.parse(readFileSync(haruIdle, "utf8"));
        const clip = parseMotion3(json);
        expect(clip.curves.length).toBeGreaterThan(0);
        const targets = new Set(clip.curves.map((c) => c.target));
        expect(targets.has("Parameter")).toBe(true);
        expect(targets.has("PartOpacity")).toBe(true);
        const samples = evaluateMotion3(clip, 1);
        expect(samples.some((s) => s.target === "PartOpacity")).toBe(true);
        expect(samples.every((s) => Number.isFinite(s.value))).toBe(true);
    });
});

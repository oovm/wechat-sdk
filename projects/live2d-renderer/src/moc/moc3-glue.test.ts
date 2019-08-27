import { describe, expect, it } from "vitest";
import { loadMoc3KeyTables } from "./moc3-deform.js";
import {
    applyMoc3Glues,
    loadMoc3Glues,
    type Moc3GlueDef,
    meanGlueSeamDistance,
} from "./moc3-glue.js";
import type { Moc3KeyTables } from "./moc3-keyforms.js";
import { CountIdx } from "./moc3-layout.js";
import { moc3SectionF32, parseMoc3Document } from "./moc3-reader.js";
import { moc3DocumentToProgram } from "./moc3-to-program.js";
import {
    MAO_MOC3_CANDIDATES,
    tryReadFixture,
    WANKO_MOC3_CANDIDATES,
} from "./test-fixtures.js";

const EMPTY_KEYS: Moc3KeyTables = {
    bindingIndex: new Int32Array(),
    bandBegin: new Int32Array(),
    bandCount: new Int32Array(),
    keysBegin: new Int32Array(),
    keysCount: new Int32Array(),
    keys: new Float32Array(),
    paramBindingBegin: new Int32Array(),
    paramBindingCount: new Int32Array(),
    paramCount: 0,
};

function seedSeparated(
    glues: readonly Moc3GlueDef[],
    gap = 10,
): Map<number, Float32Array> {
    const need = new Map<number, number>();
    for (const g of glues) {
        const maxA = Math.max(0, ...g.pairs.map((p) => p.indexA)) + 1;
        const maxB = Math.max(0, ...g.pairs.map((p) => p.indexB)) + 1;
        need.set(g.meshA, Math.max(need.get(g.meshA) ?? 0, maxA));
        need.set(g.meshB, Math.max(need.get(g.meshB) ?? 0, maxB));
    }
    const byMesh = new Map<number, Float32Array>();
    for (const [mesh, verts] of need) {
        byMesh.set(mesh, new Float32Array(verts * 2));
    }
    for (const g of glues) {
        const a = byMesh.get(g.meshA)!;
        const b = byMesh.get(g.meshB)!;
        for (const p of g.pairs) {
            a[p.indexA * 2] = 0;
            a[p.indexA * 2 + 1] = 0;
            b[p.indexB * 2] = gap;
            b[p.indexB * 2 + 1] = 0;
        }
    }
    return byMesh;
}

describe("moc3 glue unit", () => {
    it("pulls paired verts to the weighted target at intensity 1", () => {
        const posA = new Float32Array([0, 0, 10, 0]);
        const posB = new Float32Array([4, 0, 20, 0]);
        const glue: Moc3GlueDef = {
            meshA: 0,
            meshB: 1,
            pairs: [
                { indexA: 0, indexB: 0, weightA: 0.5, weightB: 0.5 },
                { indexA: 1, indexB: 1, weightA: 1, weightB: 0 },
            ],
            band: -1,
            keyformBegin: 0,
            keyformCount: 1,
        };
        applyMoc3Glues(
            new Map([
                [0, posA],
                [1, posB],
            ]),
            [glue],
            EMPTY_KEYS,
            () => 0,
            new Float32Array([1]),
        );
        expect(posA[0]).toBeCloseTo(2, 5);
        expect(posB[0]).toBeCloseTo(2, 5);
        expect(posA[2]).toBeCloseTo(10, 5);
        expect(posB[2]).toBeCloseTo(10, 5);
    });

    it("intensity 0 leaves positions unchanged", () => {
        const posA = new Float32Array([0, 0]);
        const posB = new Float32Array([4, 0]);
        applyMoc3Glues(
            new Map([
                [0, posA],
                [1, posB],
            ]),
            [
                {
                    meshA: 0,
                    meshB: 1,
                    pairs: [
                        { indexA: 0, indexB: 0, weightA: 0.5, weightB: 0.5 },
                    ],
                    band: -1,
                    keyformBegin: 0,
                    keyformCount: 1,
                },
            ],
            EMPTY_KEYS,
            () => 0,
            new Float32Array([0]),
        );
        expect(posA[0]).toBe(0);
        expect(posB[0]).toBe(4);
    });
});

describe("moc3 glue (Mao)", () => {
    it("parses glue pairs with A/B indices in range", () => {
        const bytes = tryReadFixture(...MAO_MOC3_CANDIDATES);
        if (!bytes) return;
        const doc = parseMoc3Document(bytes);
        expect(doc.counts[CountIdx.GLUES]).toBeGreaterThan(0);
        const glues = loadMoc3Glues(doc);
        expect(glues.length).toBe(doc.counts[CountIdx.GLUES]);
        const meshCount = doc.counts[CountIdx.ART_MESHES] ?? 0;
        for (const g of glues) {
            expect(g.meshA).toBeGreaterThanOrEqual(0);
            expect(g.meshA).toBeLessThan(meshCount);
            expect(g.meshB).toBeGreaterThanOrEqual(0);
            expect(g.meshB).toBeLessThan(meshCount);
            expect(g.pairs.length).toBeGreaterThan(0);
            for (const p of g.pairs) {
                expect(p.weightA + p.weightB).toBeCloseTo(1, 2);
            }
        }
    });

    it("default intensities collapse separated seams; zero keeps gap", () => {
        const bytes = tryReadFixture(...MAO_MOC3_CANDIDATES);
        if (!bytes) return;
        const doc = parseMoc3Document(bytes);
        const glues = loadMoc3Glues(doc);
        const keyTables = loadMoc3KeyTables(doc);
        const intensities = moc3SectionF32(doc, "glue_keyform.intensities");
        const zeros = new Float32Array(intensities.length);

        const withGlue = seedSeparated(glues);
        const before = meanGlueSeamDistance(withGlue, glues[0]!);
        applyMoc3Glues(withGlue, glues, keyTables, () => 0, intensities);
        const after = meanGlueSeamDistance(withGlue, glues[0]!);
        expect(before).toBeGreaterThan(1);
        expect(after).toBeLessThan(1e-4);

        const noGlue = seedSeparated(glues);
        applyMoc3Glues(noGlue, glues, keyTables, () => 0, zeros);
        expect(meanGlueSeamDistance(noGlue, glues[0]!)).toBeCloseTo(10, 5);
    });

    it("builds a ModelProgram with glue applied", () => {
        const bytes = tryReadFixture(...MAO_MOC3_CANDIDATES);
        if (!bytes) return;
        const program = moc3DocumentToProgram(parseMoc3Document(bytes));
        expect(program.drawables.length).toBeGreaterThan(0);
    });
});

describe("moc3 glue (Wanko regression)", () => {
    it("loads with zero glues and still builds a program", () => {
        const bytes = tryReadFixture(...WANKO_MOC3_CANDIDATES);
        if (!bytes) return;
        const doc = parseMoc3Document(bytes);
        expect(doc.counts[CountIdx.GLUES] ?? 0).toBe(0);
        expect(loadMoc3Glues(doc)).toHaveLength(0);
        const program = moc3DocumentToProgram(doc);
        expect(program.drawables.length).toBeGreaterThan(0);
    });
});

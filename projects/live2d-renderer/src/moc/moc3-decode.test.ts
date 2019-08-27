import { describe, expect, it } from "vitest";
import { createMoc3Backend } from "../backends/moc3.js";
import {
    createModelInstance,
    evaluateFrame,
    setParameterValue,
} from "../cpu/evaluate.js";
import { decodeMoc3 } from "./decode.js";
import { parseMoc3Document } from "./moc3-reader.js";
import { moc3DocumentToProgram } from "./moc3-to-program.js";
import { tryReadFixture, WANKO_MOC3_CANDIDATES } from "./test-fixtures.js";

const wankoBytes = tryReadFixture(...WANKO_MOC3_CANDIDATES);

describe.skipIf(!wankoBytes)("moc3 decode (wanko)", () => {
    function loadWanko(): ArrayBuffer {
        return wankoBytes!.slice(0);
    }

    it("parses count info and canvas", () => {
        const doc = parseMoc3Document(loadWanko());
        expect(doc.version).toBe(1);
        expect(doc.counts[4]).toBeGreaterThan(0); // art meshes
        expect(doc.counts[5]).toBeGreaterThan(0); // parameters
        expect(doc.canvas.canvasWidth).toBe(1200);
        expect(doc.canvas.canvasHeight).toBe(1200);
    });

    it("decodes default-pose drawables with coherent clip bounds", async () => {
        const { program } = await decodeMoc3(loadWanko());
        expect(program.format).toBe("moc3");
        expect(program.codec).toBe("moc3");
        expect(program.parameters.length).toBeGreaterThan(0);
        expect(program.drawables.length).toBeGreaterThan(0);

        const first = program.drawables[0]!;
        expect(first.positions.length).toBeGreaterThanOrEqual(6);
        expect(first.indices.length % 3).toBe(0);
        expect(first.uvs.length).toBe(first.positions.length);

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let absSum = 0;
        for (const d of program.drawables) {
            for (let i = 0; i + 1 < d.positions.length; i += 2) {
                const x = d.positions[i]!;
                const y = d.positions[i + 1]!;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                absSum += Math.abs(x) + Math.abs(y);
            }
        }
        expect(absSum).toBeGreaterThan(1);
        expect(maxX - minX).toBeGreaterThan(0.15);
        expect(maxY - minY).toBeGreaterThan(0.15);
        expect(Math.max(Math.abs(minX), Math.abs(maxX))).toBeLessThan(5);
        expect(Math.max(Math.abs(minY), Math.abs(maxY))).toBeLessThan(5);

        const frame = evaluateFrame(createModelInstance(program));
        expect(frame.drawables.length).toBe(program.drawables.length);
    });

    it("exposes parameters on the program", () => {
        const program = moc3DocumentToProgram(parseMoc3Document(loadWanko()));
        const instance = createModelInstance(program);
        expect(() =>
            setParameterValue(instance, program.parameters[0]?.id, 0),
        ).not.toThrow();
    });

    it("rebakes geometry when PARAM_ANGLE_X changes", async () => {
        const bytes = loadWanko();
        const backend = createMoc3Backend();
        const settings = {
            format: "moc3" as const,
            url: "wanko",
            name: "wanko",
            moc: "Wanko.moc3",
            textures: [] as string[],
            motionGroups: {},
            expressions: [],
            hitAreas: [],
        };
        const model = await backend.createModel(settings, { mocBytes: bytes });
        const before = backend.captureFrame(model)!;
        let beforeSum = 0;
        for (const d of before.drawables) {
            for (let i = 0; i < d.positions.length; i++) {
                beforeSum += d.positions[i]!;
            }
        }

        backend.setParameter(model, "PARAM_ANGLE_X", 30);
        const after = backend.captureFrame(model)!;
        let afterSum = 0;
        for (const d of after.drawables) {
            for (let i = 0; i < d.positions.length; i++) {
                afterSum += d.positions[i]!;
            }
        }
        expect(Math.abs(afterSum - beforeSum)).toBeGreaterThan(0.01);
        backend.destroyModel(model);
    });

    it("applies deformer chain into coherent clip bounds (not unit-local)", async () => {
        const { program } = await decodeMoc3(loadWanko());
        // After deformer bake, most drawable positions should leave the 0..1
        // local warp domain and sit in a broader canvas-normalized range.
        let outsideUnit = 0;
        let total = 0;
        for (const d of program.drawables) {
            for (let i = 0; i + 1 < d.positions.length; i += 2) {
                const x = d.positions[i]!;
                const y = d.positions[i + 1]!;
                total++;
                if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) {
                    outsideUnit++;
                }
            }
        }
        expect(total).toBeGreaterThan(0);
        expect(outsideUnit / total).toBeGreaterThan(0.15);
    });

    it("keeps nested warp-under-rotation in logical units without pixel blow-up", async () => {
        // Regression: rotation under warp must fold 1/ppu into linear scale so
        // pixel-authored child warps do not explode past clip after normalize.
        const { program } = await decodeMoc3(loadWanko());
        let maxAbs = 0;
        for (const d of program.drawables) {
            for (let i = 0; i < d.positions.length; i++) {
                maxAbs = Math.max(maxAbs, Math.abs(d.positions[i]!));
            }
        }
        expect(maxAbs).toBeGreaterThan(0.2);
        expect(maxAbs).toBeLessThan(4);
    });

    it("decodes constant blend flags and inverted-mask bits", async () => {
        const { program } = await decodeMoc3(loadWanko());
        const frame = evaluateFrame(createModelInstance(program));
        const blends = new Set(program.drawables.map((d) => d.blendMode));
        expect(blends.has(0)).toBe(true); // Normal
        // Wanko effects use additive / multiplicative constant flags.
        expect(blends.has(1) || blends.has(2)).toBe(true);
        expect(program.drawables.some((d) => d.invertedMask)).toBe(true);
        for (const d of frame.drawables) {
            expect(d.blendMode).toBe(program.drawables[d.index]?.blendMode);
            expect(d.invertedMask).toBe(
                program.drawables[d.index]?.invertedMask,
            );
            expect(d.maskIndices).toEqual(
                program.drawables[d.index]?.maskIndices,
            );
        }
    });
});

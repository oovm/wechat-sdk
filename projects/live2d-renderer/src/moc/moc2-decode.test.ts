import { describe, expect, it } from "vitest";
import { createMoc2Backend } from "../backends/moc2.js";
import { createModelInstance, evaluateFrame } from "../cpu/evaluate.js";
import { decodeMoc2 } from "./decode.js";
import { Moc2Parser } from "./moc2-objects.js";
import { moc2ModelToProgram } from "./moc2-to-program.js";
import { HIJIKI_MOC2_CANDIDATES, tryReadFixture } from "./test-fixtures.js";

const hijikiBytes = tryReadFixture(...HIJIKI_MOC2_CANDIDATES);

describe.skipIf(!hijikiBytes)("moc2 decode (hijiki)", () => {
    function loadHijiki(): ArrayBuffer {
        return hijikiBytes!.slice(0);
    }

    it("parses ModelImpl header fields", () => {
        const bytes = loadHijiki();
        const model = new Moc2Parser(bytes).parseModel();
        expect(model.kind).toBe("model");
        expect(model.canvasWidth).toBe(2000);
        expect(model.canvasHeight).toBe(2500);
        expect(model.paramDefSet.params.length).toBeGreaterThan(10);
        expect(model.parts.length).toBeGreaterThan(0);
        const meshCount = model.parts.reduce(
            (n, p) => n + p.drawData.length,
            0,
        );
        expect(meshCount).toBeGreaterThan(0);
    });

    it("decodes hijiki with deformer bake into coherent clip bounds", async () => {
        const { program } = await decodeMoc2(loadHijiki());
        expect(program.format).toBe("moc2");
        expect(program.codec).toBe("moc2");
        expect(program.parameters.some((p) => p.id === "PARAM_ANGLE_X")).toBe(
            true,
        );
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
        expect(maxX - minX).toBeGreaterThan(0.2);
        expect(maxY - minY).toBeGreaterThan(0.2);
        // Pixel-corner → NDC: model should sit near the origin inside the clip.
        expect(Math.max(Math.abs(minX), Math.abs(maxX))).toBeLessThan(2);
        expect(Math.max(Math.abs(minY), Math.abs(maxY))).toBeLessThan(2);
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        expect(Math.abs(cx)).toBeLessThan(0.75);
        expect(Math.abs(cy)).toBeLessThan(0.75);

        const frame = evaluateFrame(createModelInstance(program));
        expect(frame.drawables.length).toBe(program.drawables.length);
    });

    it("rebakes geometry when PARAM_ANGLE_X changes", async () => {
        const bytes = loadHijiki();
        const backend = createMoc2Backend();
        const settings = {
            format: "moc2" as const,
            url: "hijiki",
            name: "hijiki",
            moc: "hijiki.moc",
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

        const moc = new Moc2Parser(loadHijiki()).parseModel();
        const defaults = new Map(
            moc.paramDefSet.params.map((p) => [p.id, p.defaultValue]),
        );
        const atDefault = moc2ModelToProgram(moc);
        const atAngle = moc2ModelToProgram(moc, {
            getParam: (id) =>
                id === "PARAM_ANGLE_X" ? 30 : (defaults.get(id) ?? 0),
        });
        let defaultSum = 0;
        let angleSum = 0;
        for (const d of atDefault.drawables) {
            for (let i = 0; i < d.positions.length; i++) {
                defaultSum += d.positions[i]!;
            }
        }
        for (const d of atAngle.drawables) {
            for (let i = 0; i < d.positions.length; i++) {
                angleSum += d.positions[i]!;
            }
        }
        expect(Math.abs(angleSum - defaultSum)).toBeGreaterThan(0.01);

        backend.destroyModel(model);
    });

    it("exposes blendMode / maskIndices / visible on program and frame", async () => {
        const { program } = await decodeMoc2(loadHijiki());
        expect(program.drawables.length).toBeGreaterThan(0);
        for (const d of program.drawables) {
            expect(d.blendMode).toBe(0);
            expect(Array.isArray(d.maskIndices)).toBe(true);
            expect(typeof d.visible).toBe("boolean");
            expect(typeof d.invertedMask).toBe("boolean");
        }
        const frame = evaluateFrame(createModelInstance(program));
        expect(frame.drawables[0]?.blendMode).toBe(
            program.drawables[0]?.blendMode,
        );
    });
});

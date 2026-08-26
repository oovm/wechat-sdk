import type { ModelProgram } from "@doki-land/live2d-core";
import { describe, expect, it } from "vitest";
import {
    createModelInstance,
    decodeMoc2,
    decodeMoc3,
    evaluateFrame,
    parseCpuProgram,
} from "../src/index.js";
import {
    MODEL_MATRIX,
    type ModelMatrixFormat,
    type ModelMatrixRow,
    tryReadMatrixMoc,
} from "./model-matrix.js";

function assertProgramBounds(program: ModelProgram): void {
    expect(program.parameters.length).toBeGreaterThan(0);
    expect(program.drawables.length).toBeGreaterThan(0);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let absSum = 0;
    for (const d of program.drawables) {
        expect(d.positions.length).toBeGreaterThanOrEqual(6);
        expect(d.indices.length % 3).toBe(0);
        expect(d.uvs.length).toBe(d.positions.length);
        for (let i = 0; i + 1 < d.positions.length; i += 2) {
            const x = d.positions[i] as number;
            const y = d.positions[i + 1] as number;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            absSum += Math.abs(x) + Math.abs(y);
        }
    }
    expect(absSum).toBeGreaterThan(0.01);
    expect(maxX - minX).toBeGreaterThan(0);
    expect(maxY - minY).toBeGreaterThan(0);
    expect(Math.max(Math.abs(minX), Math.abs(maxX))).toBeLessThan(10);
    expect(Math.max(Math.abs(minY), Math.abs(maxY))).toBeLessThan(10);

    const frame = evaluateFrame(createModelInstance(program));
    expect(frame.drawables.length).toBe(program.drawables.length);
}

async function decodeMatrixRow(
    format: ModelMatrixFormat,
    bytes: ArrayBuffer,
): Promise<ModelProgram> {
    if (format === "cpu-program") {
        return parseCpuProgram(bytes);
    }
    if (format === "moc2") {
        const { program } = await decodeMoc2(bytes);
        expect(program.format).toBe("moc2");
        return program;
    }
    const { program } = await decodeMoc3(bytes);
    expect(program.format).toBe("moc3");
    return program;
}

async function runMatrixRow(row: ModelMatrixRow): Promise<void> {
    const bytes = tryReadMatrixMoc(row);
    if (!bytes) {
        throw new Error(`${row.id}: missing ${row.mocRelative}`);
    }
    const program = await decodeMatrixRow(row.format, bytes);
    assertProgramBounds(program);
}

describe("model conformance matrix (S4)", () => {
    it("declares unique matrix ids aligned with catalog local corpus", () => {
        const ids = new Set<string>();
        for (const row of MODEL_MATRIX) {
            expect(ids.has(row.id)).toBe(false);
            ids.add(row.id);
            expect(row.mocRelative).toBeTruthy();
        }
        expect(MODEL_MATRIX.some((r) => r.id === "cpu-quad")).toBe(true);
        expect(MODEL_MATRIX.filter((r) => r.ciRequired).length).toBeGreaterThan(
            0,
        );
    });

    describe("CI-required corpus", () => {
        for (const row of MODEL_MATRIX.filter((r) => r.ciRequired)) {
            it(`${row.id} (${row.format})`, async () => {
                await runMatrixRow(row);
            });
        }
    });

    describe("optional local samples", () => {
        for (const row of MODEL_MATRIX.filter((r) => !r.ciRequired)) {
            it(`${row.id} (${row.format})`, async () => {
                const bytes = tryReadMatrixMoc(row);
                if (!bytes) {
                    console.warn(
                        `[model-matrix] skip optional ${row.id}: ${row.mocRelative}`,
                    );
                    return;
                }
                const program = await decodeMatrixRow(row.format, bytes);
                assertProgramBounds(program);
            });
        }
    });
});

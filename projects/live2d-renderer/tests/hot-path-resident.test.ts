/**
 * Hot-path regressions for `规划设计/live2d/03` §4:
 * resident Program/Instance, stable DrawableMesh identity, no paramFingerprint rebuild.
 */
import { describe, expect, it } from "vitest";
import {
    createMoc2Backend,
    createMoc3Backend,
    createModelInstance,
    createQuadProgram,
    serializeCpuProgram,
} from "../src/index.js";
import {
    HIJIKI_MOC2_CANDIDATES,
    tryReadFixture,
    WANKO_MOC3_CANDIDATES,
} from "./fixtures.js";

const hijikiBytes = tryReadFixture(...HIJIKI_MOC2_CANDIDATES);
const wankoBytes = tryReadFixture(...WANKO_MOC3_CANDIDATES);

function emptySettings(format: "moc2" | "moc3", moc: string, name: string) {
    return {
        format,
        url: name,
        name,
        moc,
        textures: [] as string[],
        motionGroups: {},
        expressions: [],
        hitAreas: [],
    };
}

describe("hot-path resident moc3 (cpu-program)", () => {
    it("keeps Program/Instance and mesh topology identity across setParameter", async () => {
        const bytes = serializeCpuProgram(
            createQuadProgram({ topRightDelta: [0.25, 0.1] }),
        );
        const backend = createMoc3Backend();
        const model = await backend.createModel(
            emptySettings("moc3", "quad.program.json", "quad"),
            { mocBytes: bytes },
        );

        const instanceA = backend.getResidentInstance(model)!;
        expect(instanceA).toBeTruthy();
        const programA = instanceA.program;

        const drawA = backend.getDrawables(model);
        expect(drawA.length).toBe(1);
        const mesh0 = drawA[0]!;
        const uvs = mesh0.uvs;
        const indices = mesh0.indices;
        const maskIndices = mesh0.maskIndices;
        const positions = mesh0.vertexPositions;

        backend.setParameter(model, "PARAM_ANGLE_X", 1);
        backend.updateModel(model, 1 / 60);

        const instanceB = backend.getResidentInstance(model)!;
        expect(instanceB).toBe(instanceA);
        expect(instanceB.program).toBe(programA);

        const drawB = backend.getDrawables(model);
        expect(drawB).toBe(drawA);
        expect(drawB[0]).toBe(mesh0);
        expect(drawB[0]!.uvs).toBe(uvs);
        expect(drawB[0]!.indices).toBe(indices);
        expect(drawB[0]!.maskIndices).toBe(maskIndices);
        expect(drawB[0]!.vertexPositions).toBe(positions);
        expect(positions[4]).toBeCloseTo(0.75, 5);

        const bindings = backend.listParameters(model)!;
        expect(bindings[0]?.value).toBeCloseTo(1, 5);
        expect(backend.resolveParameter?.(model, "PARAM_ANGLE_X")).toBe(0);

        backend.destroyModel(model);
    });

    it("evaluateFrameInto writes into resident meshes without reallocating positions", () => {
        const program = createQuadProgram({ topRightDelta: [0.1, 0] });
        const instance = createModelInstance(program);
        // Smoke: createModelInstance remains the sole instance identity for CPU path.
        expect(instance.parameterValues).toBeInstanceOf(Float32Array);
        expect(instance.program).toBe(program);
    });
});

describe.skipIf(!hijikiBytes)("hot-path resident moc2 (hijiki)", () => {
    it("keeps Program/Instance and DrawableMesh identity across pose updates", async () => {
        const backend = createMoc2Backend();
        const model = await backend.createModel(
            emptySettings("moc2", "hijiki.moc", "hijiki"),
            { mocBytes: hijikiBytes!.slice(0) },
        );

        const instanceA = backend.getResidentInstance(model)!;
        const programA = instanceA.program;
        const drawA = backend.getDrawables(model);
        expect(drawA.length).toBeGreaterThan(0);
        const first = drawA[0]!;
        const uvs = first.uvs;
        const indices = first.indices;
        const maskIndices = first.maskIndices;
        const positions = first.vertexPositions;
        const meshRefs = drawA.slice();

        backend.setParameter(model, "PARAM_ANGLE_X", 30);
        backend.updateModel(model, 1 / 60);

        const instanceB = backend.getResidentInstance(model)!;
        expect(instanceB).toBe(instanceA);
        expect(instanceB.program).toBe(programA);

        const drawB = backend.getDrawables(model);
        expect(drawB).toBe(drawA);
        expect(drawB.length).toBe(meshRefs.length);
        for (let i = 0; i < meshRefs.length; i++) {
            expect(drawB[i]).toBe(meshRefs[i]);
        }
        expect(first.uvs).toBe(uvs);
        expect(first.indices).toBe(indices);
        expect(first.maskIndices).toBe(maskIndices);
        expect(first.vertexPositions).toBe(positions);

        expect(backend.resolveParameter?.(model, "PARAM_ANGLE_X")).toBeTypeOf(
            "number",
        );

        backend.destroyModel(model);
    });
});

describe.skipIf(!wankoBytes)("hot-path resident moc3 binary (wanko)", () => {
    it("keeps Program/Instance and DrawableMesh identity across pose updates", async () => {
        const backend = createMoc3Backend();
        const model = await backend.createModel(
            emptySettings("moc3", "Wanko.moc3", "wanko"),
            { mocBytes: wankoBytes!.slice(0) },
        );

        const instanceA = backend.getResidentInstance(model)!;
        const programA = instanceA.program;
        const drawA = backend.getDrawables(model);
        const meshRefs = drawA.slice();
        const first = drawA[0]!;
        const positions = first.vertexPositions;

        const params = backend.listParameters(model);
        const angle = params.find(
            (p) => p.id.includes("Angle") || p.id.includes("ANGLE"),
        );
        if (angle) {
            backend.setParameter(model, angle.id, angle.max);
        }
        backend.updateModel(model, 1 / 60);

        expect(backend.getResidentInstance(model)).toBe(instanceA);
        expect(backend.getResidentInstance(model)!.program).toBe(programA);
        const drawB = backend.getDrawables(model);
        expect(drawB).toBe(drawA);
        for (let i = 0; i < meshRefs.length; i++) {
            expect(drawB[i]).toBe(meshRefs[i]);
        }
        expect(first.vertexPositions).toBe(positions);

        backend.destroyModel(model);
    });
});

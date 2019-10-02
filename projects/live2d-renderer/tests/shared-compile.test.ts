import { describe, expect, it } from "vitest";
import {
    compileSharedModelCompile,
    createMoc3Backend,
    createQuadProgram,
    serializeCpuProgram,
} from "../src/index.js";

describe("compileSharedModelCompile", () => {
    it("parses moc3 cpu-program bytes once", () => {
        const bytes = serializeCpuProgram(createQuadProgram());
        const compile = compileSharedModelCompile(
            {
                format: "moc3",
                url: "fixture",
                moc: "quad.program.json",
                textures: [],
                motionGroups: {},
                expressions: [],
                hitAreas: [],
            },
            bytes,
        );
        expect(compile.mocBytes.byteLength).toBeGreaterThan(0);
        expect(compile.cpuProgram?.drawables.length).toBe(1);
        expect(compile.moc3Doc).toBeUndefined();
    });
});

describe("Moc3Backend sharedCompile", () => {
    it("creates independent InternalModel instances from one compile", async () => {
        const bytes = serializeCpuProgram(createQuadProgram());
        const settings = {
            format: "moc3" as const,
            url: "fixture",
            moc: "quad.program.json",
            textures: [] as string[],
            motionGroups: {},
            expressions: [],
            hitAreas: [],
        };
        const sharedCompile = compileSharedModelCompile(settings, bytes);
        const backend = createMoc3Backend();

        const a = await backend.createModel(settings, { sharedCompile });
        const b = await backend.createModel(settings, { sharedCompile });

        expect(a).not.toBe(b);
        expect(a.format).toBe("moc3");
        expect(b.format).toBe("moc3");

        backend.setParameter?.(a, "PARAM_ANGLE_X", 0.5);
        backend.setParameter?.(b, "PARAM_ANGLE_X", -0.5);
        const pa = backend
            .listParameters?.(a)
            .find((p) => p.id === "PARAM_ANGLE_X");
        const pb = backend
            .listParameters?.(b)
            .find((p) => p.id === "PARAM_ANGLE_X");
        expect(pa?.value).toBe(0.5);
        expect(pb?.value).toBe(-0.5);

        backend.destroyModel(a);
        backend.destroyModel(b);
    });
});

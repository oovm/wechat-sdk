import { describe, expect, it } from "vitest";
import {
    createModelInstance,
    createQuadProgram,
    decodeMoc3,
    evaluateFrame,
    fingerprintSnapshot,
    parseCpuProgram,
    serializeCpuProgram,
    setParameterValue,
} from "../src/index.js";

describe("moc3 CPU golden (cpu-program)", () => {
    it("round-trips cpu-program JSON and matches default-pose golden", () => {
        const program = createQuadProgram({
            parameterId: "PARAM_ANGLE_X",
            topRightDelta: [0.25, 0.1],
        });
        const bytes = serializeCpuProgram(program);
        const decoded = parseCpuProgram(bytes);
        expect(decoded.codec).toBe("cpu-program");
        expect(decoded.parameters[0]?.id).toBe("PARAM_ANGLE_X");

        const instance = createModelInstance(decoded);
        const frame = evaluateFrame(instance);
        expect(frame.drawables).toHaveLength(1);

        const goldenDefault =
            "t=0.0000|d0:tex=0;nV=4;nI=6|-0.50000|-0.50000|0.50000|-0.50000|0.50000|0.50000|-0.50000|0.50000|0|1|2|0|2|3";
        expect(fingerprintSnapshot(frame)).toBe(goldenDefault);
    });

    it("deforms top-right vertex at parameter max", () => {
        const bytes = serializeCpuProgram(
            createQuadProgram({ topRightDelta: [0.25, 0.1] }),
        );
        const program = parseCpuProgram(bytes);
        const instance = createModelInstance(program);
        setParameterValue(instance, "PARAM_ANGLE_X", 1);
        const frame = evaluateFrame(instance);
        const positions = frame.drawables[0]?.positions;
        expect(positions[4]).toBeCloseTo(0.75, 5);
        expect(positions[5]).toBeCloseTo(0.6, 5);

        const goldenMax =
            "t=0.0000|d0:tex=0;nV=4;nI=6|-0.50000|-0.50000|0.50000|-0.50000|0.75000|0.60000|-0.50000|0.50000|0|1|2|0|2|3";
        expect(fingerprintSnapshot(frame)).toBe(goldenMax);
    });

    it("rejects truncated binary MOC3 with a clear diagnostic", async () => {
        const buf = new ArrayBuffer(16);
        const view = new DataView(buf);
        view.setUint8(0, 0x4d);
        view.setUint8(1, 0x4f);
        view.setUint8(2, 0x43);
        view.setUint8(3, 0x33);
        view.setUint32(4, 1, true);
        await expect(decodeMoc3(buf)).rejects.toThrow(/truncated MOC3/);
    });
});

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/minimal.motion3.json";
import { evaluateCurve, evaluateMotion3 } from "./evaluate-curve.js";
import { parseMotion3 } from "./parse-motion3.js";

describe("evaluateMotion3", () => {
    const clip = parseMotion3(fixture);

    it("samples linear PARAM_ANGLE_X", () => {
        const angle = clip.curves.find((c) => c.id === "PARAM_ANGLE_X")!;
        expect(evaluateCurve(angle, 0, true)).toBeCloseTo(0);
        expect(evaluateCurve(angle, 0.5, true)).toBeCloseTo(15);
        expect(evaluateCurve(angle, 1, true)).toBeCloseTo(30);
    });

    it("samples stepped then linear for PARAM_ANGLE_Y", () => {
        const angle = clip.curves.find((c) => c.id === "PARAM_ANGLE_Y")!;
        expect(evaluateCurve(angle, 0.25, true)).toBeCloseTo(0);
        expect(evaluateCurve(angle, 0.5, true)).toBeCloseTo(10);
        expect(evaluateCurve(angle, 0.75, true)).toBeCloseTo(5);
        expect(evaluateCurve(angle, 1, true)).toBeCloseTo(0);
    });

    it("samples restricted bezier end value", () => {
        const body = clip.curves.find((c) => c.id === "PARAM_BODY_ANGLE_X")!;
        expect(evaluateCurve(body, 0, true)).toBeCloseTo(0);
        expect(evaluateCurve(body, 1, true)).toBeCloseTo(20);
        const mid = evaluateCurve(body, 0.5, true);
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(20);
    });

    it("returns all curve ids", () => {
        const samples = evaluateMotion3(clip, 1);
        expect(samples.map((s) => s.id).sort()).toEqual([
            "PARAM_ANGLE_X",
            "PARAM_ANGLE_Y",
            "PARAM_BODY_ANGLE_X",
        ]);
    });
});

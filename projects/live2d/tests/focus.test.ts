import type { ParameterBinding } from "@doki-land/live2d-renderer";
import { describe, expect, it } from "vitest";
import { focusParameterUpdates } from "../src/stage/assets/focus.js";

function param(
    id: string,
    min: number,
    max: number,
    defaultValue = 0,
): ParameterBinding {
    return { id, min, max, defaultValue, value: defaultValue };
}

describe("focusParameterUpdates", () => {
    it("drives head, body, and eye params when present", () => {
        const params = [
            param("PARAM_ANGLE_X", -30, 30),
            param("PARAM_ANGLE_Y", -30, 30),
            param("PARAM_ANGLE_Z", -30, 30),
            param("PARAM_BODY_ANGLE_X", -10, 10),
            param("PARAM_EYE_BALL_X", -1, 1),
            param("PARAM_EYE_BALL_Y", -1, 1),
            param("PARAM_BREATH", 0, 1, 0.5),
        ];
        const updates = focusParameterUpdates(params, 1, 0.5);
        const byId = Object.fromEntries(updates.map((u) => [u.id, u.value]));
        expect(byId.PARAM_ANGLE_X).toBe(30);
        expect(byId.PARAM_ANGLE_Y).toBe(15);
        expect(byId.PARAM_ANGLE_Z).toBe(-15);
        expect(byId.PARAM_BODY_ANGLE_X).toBe(10);
        expect(byId.PARAM_EYE_BALL_X).toBe(1);
        expect(byId.PARAM_EYE_BALL_Y).toBe(0.5);
        expect(byId.PARAM_BREATH).toBeUndefined();
    });

    it("skips ids the model does not declare", () => {
        const updates = focusParameterUpdates(
            [param("PARAM_ANGLE_X", -30, 30)],
            0.5,
            0.5,
        );
        expect(updates.map((u) => u.id)).toEqual(["PARAM_ANGLE_X"]);
    });

    it("accepts a stable Map without rebuilding from an array", () => {
        const map = new Map([
            ["PARAM_ANGLE_X", param("PARAM_ANGLE_X", -30, 30)],
            ["PARAM_ANGLE_Y", param("PARAM_ANGLE_Y", -30, 30)],
        ]);
        const updates = focusParameterUpdates(map, 1, -1);
        expect(updates).toEqual([
            { id: "PARAM_ANGLE_X", value: 30 },
            { id: "PARAM_ANGLE_Y", value: -30 },
        ]);
    });
});

import { describe, expect, it } from "vitest";
import { applyExpression3Clip } from "../../src/expression/apply-expression.js";
import { parseExpression3 } from "../../src/expression/parse-expression3.js";
import fixture from "../fixtures/minimal.exp3.json";

describe("applyExpression3Clip", () => {
    it("adds and overrides on top of current parameter values", () => {
        const clip = parseExpression3(fixture);
        const bindings = new Map([
            ["PARAM_ANGLE_X", { value: 1 }],
            ["PARAM_ANGLE_Y", { value: 2 }],
        ]);
        const applied = new Map<string, number>();
        applyExpression3Clip(clip, 1, bindings, (id, value) => {
            applied.set(id, value);
        });
        expect(applied.get("PARAM_ANGLE_X")).toBe(6);
        expect(applied.get("PARAM_ANGLE_Y")).toBe(0.5);
    });

    it("scales contribution by weight", () => {
        const clip = parseExpression3(fixture);
        const bindings = new Map([["PARAM_ANGLE_X", { value: 0 }]]);
        const applied = new Map<string, number>();
        applyExpression3Clip(clip, 0.5, bindings, (id, value) => {
            applied.set(id, value);
        });
        expect(applied.get("PARAM_ANGLE_X")).toBe(2.5);
        // Unknown parameters on the model are skipped.
        expect(applied.has("PARAM_ANGLE_Y")).toBe(false);
    });
});

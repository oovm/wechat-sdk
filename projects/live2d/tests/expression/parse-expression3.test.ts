import { describe, expect, it } from "vitest";
import { parseExpression3 } from "../../src/expression/parse-expression3.js";
import fixture from "../fixtures/minimal.exp3.json";

describe("parseExpression3", () => {
    it("parses Parameters with blend modes", () => {
        const clip = parseExpression3(fixture);
        expect(clip.parameters).toHaveLength(2);
        expect(clip.parameters[0]).toMatchObject({
            id: "PARAM_ANGLE_X",
            value: 5,
            blend: "Add",
        });
        expect(clip.parameters[1]?.blend).toBe("Override");
    });

    it("maps Cubism Overwrite to Override", () => {
        const clip = parseExpression3({
            Type: "Live2D Expression",
            Parameters: [{ Id: "PARAM_ANGLE_X", Value: 1, Blend: "Overwrite" }],
        });
        expect(clip.parameters[0]?.blend).toBe("Override");
    });
});

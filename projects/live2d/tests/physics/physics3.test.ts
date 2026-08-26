import { describe, expect, it } from "vitest";
import { applyPhysics3 } from "../../src/physics/apply-physics3.js";
import { parsePhysics3 } from "../../src/physics/parse-physics3.js";
import fixture from "../fixtures/minimal.physics3.json";

describe("parsePhysics3", () => {
    it("parses PhysicsSettings output destination ids", () => {
        const clip = parsePhysics3(fixture);
        expect(clip.settings).toHaveLength(1);
        expect(clip.settings[0]!.id).toBe("PhysicsSetting1");
        expect(clip.settings[0]!.outputs).toEqual([
            { destinationId: "PARAM_ANGLE_X" },
        ]);
        expect(clip.outputParameterIds).toEqual(["PARAM_ANGLE_X"]);
    });

    it("tolerates missing PhysicsSettings", () => {
        const clip = parsePhysics3({ Version: 3 });
        expect(clip.settings).toEqual([]);
        expect(clip.outputParameterIds).toEqual([]);
    });

    it("rejects non-object root", () => {
        expect(() => parsePhysics3(null)).toThrow(/physics3 json root/);
    });
});

describe("applyPhysics3", () => {
    it("identity-steps known output parameters", () => {
        const clip = parsePhysics3(fixture);
        const bindings = new Map([["PARAM_ANGLE_X", { value: 0.42 }]]);
        const ops: Array<[string, number]> = [];
        applyPhysics3(clip, 1 / 60, bindings, (id, value) => {
            ops.push([id, value]);
        });
        expect(ops).toEqual([["PARAM_ANGLE_X", 0.42]]);
    });

    it("skips destinations without bindings", () => {
        const clip = parsePhysics3(fixture);
        const ops: Array<[string, number]> = [];
        applyPhysics3(clip, 0, new Map(), (id, value) => {
            ops.push([id, value]);
        });
        expect(ops).toEqual([]);
    });
});

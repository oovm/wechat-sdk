import { describe, expect, it } from "vitest";
import { applyPose3Activation } from "../../src/pose/apply-pose3.js";
import { parsePose3 } from "../../src/pose/parse-pose3.js";
import fixture from "../fixtures/minimal.pose3.json";

describe("parsePose3", () => {
    it("parses pose groups", () => {
        const clip = parsePose3(fixture);
        expect(clip.groups).toEqual([["PartA", "PartB"]]);
    });
});

describe("applyPose3Activation", () => {
    it("hides sibling parts in the activated group", () => {
        const clip = parsePose3(fixture);
        const ops: Array<[string, number]> = [];
        applyPose3Activation(clip, "PartB", (id, opacity) => {
            ops.push([id, opacity]);
        });
        expect(ops).toEqual([
            ["PartA", 0],
            ["PartB", 1],
        ]);
    });
});

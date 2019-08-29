import { describe, expect, it } from "vitest";
import {
    cascadedPartOpacity,
    type Moc3PartTables,
} from "../src/moc/moc3-parts.js";

describe("cascadedPartOpacity", () => {
    const tables: Moc3PartTables = {
        ids: ["Root", "Arm", "Hand"],
        parentPartIndices: new Int32Array([-1, 0, 1]),
        artMeshParentPartIndices: new Int32Array([2]),
    };

    it("multiplies parent chain overrides", () => {
        const overrides = new Map([
            ["Root", 1],
            ["Arm", 0.5],
            ["Hand", 0.5],
        ]);
        expect(cascadedPartOpacity(tables, 0, overrides)).toBeCloseTo(0.25);
    });

    it("defaults missing overrides to 1", () => {
        expect(cascadedPartOpacity(tables, 0, new Map())).toBe(1);
    });
});

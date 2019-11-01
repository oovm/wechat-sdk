import { describe, expect, it } from "vitest";
import { resolveHitAreaName } from "../../src/stage/hit-area.js";

describe("resolveHitAreaName", () => {
    it("returns named HitArea when art mesh id matches settings id", () => {
        expect(
            resolveHitAreaName({
                hitAreas: [
                    { name: "Head", id: "HitArea" },
                    { name: "Body", id: "HitArea2" },
                ],
                drawableIndex: 4,
                artMeshId: "HitArea",
            }),
        ).toBe("Head");
    });

    it("falls back to drawable index when no mapping exists", () => {
        expect(
            resolveHitAreaName({
                hitAreas: [{ name: "Head", id: "HitArea" }],
                drawableIndex: 7,
                artMeshId: "OtherMesh",
            }),
        ).toBe("drawable:7");
    });

    it("supports legacy D_{index} ids", () => {
        expect(
            resolveHitAreaName({
                hitAreas: [{ name: "Arm", id: "D_2" }],
                drawableIndex: 2,
            }),
        ).toBe("Arm");
    });
});

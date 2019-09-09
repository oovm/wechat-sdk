import { describe, expect, it } from "vitest";
import fixture from "../fixtures/minimal.motion3.json";
import { parseMotion3 } from "../../src/motion/parse-motion3.js";

describe("parseMotion3", () => {
    it("parses minimal fixture", () => {
        const clip = parseMotion3(fixture);
        expect(clip.duration).toBe(1);
        expect(clip.loop).toBe(false);
        expect(clip.areBeziersRestricted).toBe(true);
        expect(clip.curves).toHaveLength(3);
        expect(clip.curves[0]!.id).toBe("PARAM_ANGLE_X");
        expect(clip.curves[0]!.segments).toHaveLength(1);
        expect(clip.curves[0]!.segments[0]!.kind).toBe("linear");
        expect(clip.curves[1]!.segments[0]!.kind).toBe("stepped");
        expect(clip.curves[1]!.segments[1]!.kind).toBe("linear");
        expect(clip.curves[2]!.segments[0]!.kind).toBe("bezier");
        expect(clip.userData[0]!.value).toBe("mid");
    });

    it("rejects bad root", () => {
        expect(() => parseMotion3(null)).toThrow(/root/);
    });
});

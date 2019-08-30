import { describe, expect, it } from "vitest";
import { DEFAULT_COCOS_PREFER, normalizePrefer } from "./prefer.js";

describe("normalizePrefer", () => {
    it("returns Cocos default when empty", () => {
        expect(normalizePrefer(undefined)).toEqual([...DEFAULT_COCOS_PREFER]);
        expect(normalizePrefer([])).toEqual([...DEFAULT_COCOS_PREFER]);
        expect(normalizePrefer(["nope"])).toEqual([...DEFAULT_COCOS_PREFER]);
    });

    it("keeps known kinds in order", () => {
        expect(normalizePrefer(["webgpu", "canvas2d", "webgl2"])).toEqual([
            "webgpu",
            "canvas2d",
            "webgl2",
        ]);
    });

    it("drops unknown entries", () => {
        expect(normalizePrefer(["webgl2", "pixi", "canvas2d"])).toEqual([
            "webgl2",
            "canvas2d",
        ]);
    });
});

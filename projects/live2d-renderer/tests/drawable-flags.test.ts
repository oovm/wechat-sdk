import { FrameBlendMode } from "@doki-land/live2d-core";
import { describe, expect, it } from "vitest";
import {
    decodeMoc2ColorComposition,
    decodeMoc3DrawableFlags,
    Moc3DrawableFlag,
} from "../src/moc/drawable-flags.js";

describe("drawable-flags", () => {
    it("decodes moc3 additive / multiplicative / invert", () => {
        expect(decodeMoc3DrawableFlags(0)).toEqual({
            blendMode: FrameBlendMode.Normal,
            invertedMask: false,
            doubleSided: false,
        });
        expect(
            decodeMoc3DrawableFlags(Moc3DrawableFlag.BlendAdditive),
        ).toMatchObject({ blendMode: FrameBlendMode.Additive });
        expect(
            decodeMoc3DrawableFlags(Moc3DrawableFlag.BlendMultiplicative),
        ).toMatchObject({ blendMode: FrameBlendMode.Multiplicative });
        expect(
            decodeMoc3DrawableFlags(
                Moc3DrawableFlag.BlendAdditive |
                    Moc3DrawableFlag.BlendMultiplicative,
            ),
        ).toMatchObject({ blendMode: FrameBlendMode.Additive });
        expect(
            decodeMoc3DrawableFlags(Moc3DrawableFlag.IsInvertedMask),
        ).toMatchObject({ invertedMask: true });
    });

    it("decodes moc2 color composition enum", () => {
        expect(decodeMoc2ColorComposition(0)).toBe(FrameBlendMode.Normal);
        expect(decodeMoc2ColorComposition(1)).toBe(FrameBlendMode.Additive);
        expect(decodeMoc2ColorComposition(2)).toBe(
            FrameBlendMode.Multiplicative,
        );
    });
});

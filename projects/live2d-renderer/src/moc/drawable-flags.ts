/**
 * Shared moc2/moc3 drawable constant-flag decode → blend / invert-mask.
 */

import { FrameBlendMode } from "@doki-land/live2d-core";

/** Drawable flag bits decoded from the supported MOC3 art-mesh records. */
export const Moc3DrawableFlag = {
    BlendAdditive: 1 << 0,
    BlendMultiplicative: 1 << 1,
    IsDoubleSided: 1 << 2,
    IsInvertedMask: 1 << 3,
} as const;

/** Decode moc3 constant flags into blend + invert-mask. */
export function decodeMoc3DrawableFlags(flags: number): {
    blendMode: number;
    invertedMask: boolean;
    doubleSided: boolean;
} {
    let blendMode: number = FrameBlendMode.Normal;
    if ((flags & Moc3DrawableFlag.BlendAdditive) !== 0) {
        blendMode = FrameBlendMode.Additive;
    } else if ((flags & Moc3DrawableFlag.BlendMultiplicative) !== 0) {
        blendMode = FrameBlendMode.Multiplicative;
    }
    return {
        blendMode,
        invertedMask: (flags & Moc3DrawableFlag.IsInvertedMask) !== 0,
        doubleSided: (flags & Moc3DrawableFlag.IsDoubleSided) !== 0,
    };
}

/**
 * Decode moc2 color-composition enum (after optionFlags bit0).
 * 0 normal, 1 additive, 2 multiplicative.
 */
export function decodeMoc2ColorComposition(composition: number): number {
    if (composition === 1) return FrameBlendMode.Additive;
    if (composition === 2) return FrameBlendMode.Multiplicative;
    return FrameBlendMode.Normal;
}

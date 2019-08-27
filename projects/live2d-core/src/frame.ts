/**
 * CPU frame output — format-agnostic mesh list ready for any RenderDevice.
 */

/** Blend modes aligned with renderer DrawableMesh. */
export const FrameBlendMode = {
    Normal: 0,
    Additive: 1,
    Multiplicative: 2,
} as const;

export type FrameBlendMode =
    (typeof FrameBlendMode)[keyof typeof FrameBlendMode];

/** One drawable after CPU deform for a single frame. */
export interface FrameDrawable {
    readonly index: number;
    readonly textureIndex: number;
    /** Interleaved x,y in model space. */
    readonly positions: Float32Array;
    readonly uvs: Float32Array;
    readonly indices: Uint16Array;
    readonly opacity: number;
    readonly blendMode: FrameBlendMode;
    readonly renderOrder: number;
    readonly visible: boolean;
    readonly invertedMask: boolean;
    readonly maskIndices: readonly number[];
}

/** Immutable CPU snapshot consumed by GPU backends or golden tests. */
export interface FrameSnapshot {
    readonly timeSeconds: number;
    readonly drawables: readonly FrameDrawable[];
}

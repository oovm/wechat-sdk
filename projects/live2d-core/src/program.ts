/**
 * CPU model program / instance shapes (format adapters fill these).
 */

export interface ParameterProgram {
    readonly id: string;
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
}

export interface DrawableProgram {
    readonly index: number;
    readonly textureIndex: number;
    /** Rest-pose x,y pairs. */
    readonly positions: Float32Array;
    readonly uvs: Float32Array;
    readonly indices: Uint16Array;
    readonly opacity: number;
    readonly renderOrder: number;
    /** {@link FrameBlendMode} value. */
    readonly blendMode: number;
    readonly invertedMask: boolean;
    /** Indices into `ModelProgram.drawables` used as clipping masks. */
    readonly maskIndices: readonly number[];
    readonly visible: boolean;
    /**
     * Optional linear deform driven by one parameter.
     * `deltas[i] = positions_at_max[i] - rest[i]`.
     */
    readonly deformParamIndex: number;
    readonly deformDeltas: Float32Array | null;
}

/** Static topology + deform tables after decode. */
export interface ModelProgram {
    readonly format: "moc2" | "moc3";
    /** Codec tag, e.g. `cpu-program` or `moc3`. */
    readonly codec: string;
    readonly parameters: readonly ParameterProgram[];
    readonly drawables: readonly DrawableProgram[];
}

/** Mutable runtime values over a ModelProgram. */
export interface ModelInstance {
    readonly program: ModelProgram;
    /** Parallel to program.parameters. */
    readonly parameterValues: Float32Array;
    timeSeconds: number;
}

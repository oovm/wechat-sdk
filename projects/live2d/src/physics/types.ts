/** One physics output destination (parameter id only for the thin gate). */
export interface Physics3Output {
    readonly destinationId: string;
}

/** One PhysicsSettings entry with output destinations. */
export interface Physics3Setting {
    readonly id: string;
    readonly outputs: readonly Physics3Output[];
}

/**
 * Parsed Cubism `physics3.json` (minimal).
 * Full spring / pendulum simulation is intentionally out of scope for this gate.
 */
export interface Physics3Clip {
    readonly settings: readonly Physics3Setting[];
    /** Flattened destination parameter ids from all outputs. */
    readonly outputParameterIds: readonly string[];
}

/** Cubism motion3 segment kinds (spec). */
export type MotionSegmentKind =
    | "linear"
    | "bezier"
    | "stepped"
    | "inverseStepped";

export type MotionCurveTarget = "Parameter" | "PartOpacity" | "Model";

export interface MotionPoint {
    readonly time: number;
    readonly value: number;
}

export interface MotionSegment {
    readonly kind: MotionSegmentKind;
    /** Segment start (inclusive). */
    readonly p0: MotionPoint;
    /** Bezier controls (bezier only). */
    readonly p1?: MotionPoint;
    readonly p2?: MotionPoint;
    /** Segment end. */
    readonly p3: MotionPoint;
}

export interface MotionCurve {
    readonly target: MotionCurveTarget;
    readonly id: string;
    readonly fadeInTime?: number;
    readonly fadeOutTime?: number;
    readonly segments: readonly MotionSegment[];
}

export interface MotionUserData {
    readonly time: number;
    readonly value: string;
}

export interface Motion3Clip {
    readonly version: number;
    readonly duration: number;
    readonly fps: number;
    readonly loop: boolean;
    readonly areBeziersRestricted: boolean;
    readonly fadeInTime: number;
    readonly fadeOutTime: number;
    readonly curves: readonly MotionCurve[];
    readonly userData: readonly MotionUserData[];
}

/** Cubism-style priority: higher wins; equal may replace. */
export const MotionPriority = {
    none: 0,
    idle: 1,
    normal: 2,
    force: 3,
} as const;

export type MotionPriorityLevel =
    (typeof MotionPriority)[keyof typeof MotionPriority];

export interface PlayMotionOptions {
    /** Default {@link MotionPriority.normal}. */
    priority?: MotionPriorityLevel;
    /**
     * Parallel layer id. Default `priority:{n}` so different priorities
     * can play together; same slot replaces or queues.
     */
    slot?: string;
    /**
     * When the slot is busy, enqueue instead of replacing / rejecting.
     * Default false.
     */
    queue?: boolean;
    /** Override clip Meta.Loop. */
    loop?: boolean;
    /** Override fade-in seconds (clip / definition). */
    fadeInTime?: number;
    /** Override fade-out seconds. */
    fadeOutTime?: number;
}

export interface MotionApplySample {
    readonly target: MotionCurveTarget;
    readonly id: string;
    readonly value: number;
    /** 0..1 fade weight for this frame. */
    readonly weight: number;
}

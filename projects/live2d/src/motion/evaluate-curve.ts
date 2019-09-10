import type { Motion3Clip, MotionCurve, MotionSegment } from "./types.js";

/**
 * Sample all curves of a clip at `timeSeconds` (clamped to [0, duration]
 * unless looping — caller should wrap time for loops).
 */
export function evaluateMotion3(
    clip: Motion3Clip,
    timeSeconds: number,
): Array<{ target: MotionCurve["target"]; id: string; value: number }> {
    const t = clamp(timeSeconds, 0, clip.duration);
    const out: Array<{
        target: MotionCurve["target"];
        id: string;
        value: number;
    }> = [];
    for (const curve of clip.curves) {
        out.push({
            target: curve.target,
            id: curve.id,
            value: evaluateCurve(curve, t, clip.areBeziersRestricted),
        });
    }
    return out;
}

export function evaluateCurve(
    curve: MotionCurve,
    timeSeconds: number,
    areBeziersRestricted: boolean,
): number {
    const segs = curve.segments;
    if (segs.length === 0) return 0;

    if (timeSeconds <= segs[0]!.p0.time) return segs[0]!.p0.value;
    const last = segs[segs.length - 1]!;
    if (timeSeconds >= last.p3.time) return last.p3.value;

    for (let i = 0; i < segs.length; i += 1) {
        const seg = segs[i]!;
        const isLast = i === segs.length - 1;
        // At a segment boundary, hand off to the next segment so stepped ends
        // expose their end value as the next key.
        if (
            timeSeconds < seg.p3.time ||
            (isLast && timeSeconds <= seg.p3.time)
        ) {
            return evaluateSegment(seg, timeSeconds, areBeziersRestricted);
        }
    }
    return last.p3.value;
}

function evaluateSegment(
    seg: MotionSegment,
    time: number,
    areBeziersRestricted: boolean,
): number {
    const { p0, p3 } = seg;
    switch (seg.kind) {
        case "linear": {
            const span = p3.time - p0.time;
            if (span <= 0) return p3.value;
            const u = (time - p0.time) / span;
            return p0.value + (p3.value - p0.value) * u;
        }
        case "stepped":
            return p0.value;
        case "inverseStepped":
            return p3.value;
        case "bezier": {
            const p1 = seg.p1!;
            const p2 = seg.p2!;
            if (areBeziersRestricted) {
                const span = p3.time - p0.time;
                if (span <= 0) return p3.value;
                const u = (time - p0.time) / span;
                return cubic(p0.value, p1.value, p2.value, p3.value, u);
            }
            // Unrestricted: solve cubic for time, then sample value.
            const u = solveBezierTime(p0.time, p1.time, p2.time, p3.time, time);
            return cubic(p0.value, p1.value, p2.value, p3.value, u);
        }
        default:
            return p3.value;
    }
}

function cubic(a: number, b: number, c: number, d: number, t: number): number {
    const u = 1 - t;
    return (
        u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
    );
}

/** Binary-search parameter u in [0,1] so cubic(time) ~= targetTime. */
function solveBezierTime(
    t0: number,
    t1: number,
    t2: number,
    t3: number,
    target: number,
): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i += 1) {
        const mid = (lo + hi) * 0.5;
        const x = cubic(t0, t1, t2, t3, mid);
        if (x < target) lo = mid;
        else hi = mid;
    }
    return (lo + hi) * 0.5;
}

function clamp(n: number, min: number, max: number): number {
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

import type {
    Motion3Clip,
    MotionCurve,
    MotionCurveTarget,
    MotionPoint,
    MotionSegment,
    MotionSegmentKind,
    MotionUserData,
} from "./types.js";

const SEGMENT_KIND: Record<number, MotionSegmentKind> = {
    0: "linear",
    1: "bezier",
    2: "stepped",
    3: "inverseStepped",
};

/**
 * Parse Cubism `motion3.json` (FileFormats/motion3.json.md).
 */
export function parseMotion3(json: unknown): Motion3Clip {
    if (!json || typeof json !== "object") {
        throw new Error("@doki-land/live2d: motion3.json root must be an object");
    }
    const root = json as Record<string, unknown>;
    const version = Number(root.Version ?? 3);
    const meta = root.Meta;
    if (!meta || typeof meta !== "object") {
        throw new Error("@doki-land/live2d: motion3.json missing Meta");
    }
    const m = meta as Record<string, unknown>;
    const duration = num(m.Duration, "Meta.Duration");
    const fps = num(m.Fps, "Meta.Fps");
    const loop = m.Loop === true;
    const areBeziersRestricted = m.AreBeziersRestricted !== false;
    const fadeInTime = optionalNum(m.FadeInTime) ?? 0;
    const fadeOutTime = optionalNum(m.FadeOutTime) ?? 0;

    const curvesRaw = root.Curves;
    if (!Array.isArray(curvesRaw)) {
        throw new Error("@doki-land/live2d: motion3.json missing Curves");
    }
    const curves = curvesRaw.map((c, i) => parseCurve(c, i));

    const userData: MotionUserData[] = [];
    if (Array.isArray(root.UserData)) {
        for (const item of root.UserData) {
            if (!item || typeof item !== "object") continue;
            const u = item as Record<string, unknown>;
            if (typeof u.Time === "number" && typeof u.Value === "string") {
                userData.push({ time: u.Time, value: u.Value });
            }
        }
        userData.sort((a, b) => a.time - b.time);
    }

    return {
        version,
        duration,
        fps,
        loop,
        areBeziersRestricted,
        fadeInTime,
        fadeOutTime,
        curves,
        userData,
    };
}

function parseCurve(raw: unknown, index: number): MotionCurve {
    if (!raw || typeof raw !== "object") {
        throw new Error(`@doki-land/live2d: Curves[${index}] invalid`);
    }
    const c = raw as Record<string, unknown>;
    const target = c.Target;
    const id = c.Id;
    if (typeof target !== "string" || typeof id !== "string") {
        throw new Error(`@doki-land/live2d: Curves[${index}] needs Target/Id`);
    }
    if (
        target !== "Parameter" &&
        target !== "PartOpacity" &&
        target !== "Model"
    ) {
        throw new Error(
            `@doki-land/live2d: Curves[${index}] unknown Target ${target}`,
        );
    }
    const segmentsFlat = c.Segments;
    if (!Array.isArray(segmentsFlat) || segmentsFlat.length < 2) {
        throw new Error(`@doki-land/live2d: Curves[${index}] empty Segments`);
    }
    const numbers = segmentsFlat.map((n, j) => {
        if (typeof n !== "number" || !Number.isFinite(n)) {
            throw new Error(
                `@doki-land/live2d: Curves[${index}].Segments[${j}] not a number`,
            );
        }
        return n;
    });

    return {
        target: target as MotionCurveTarget,
        id,
        fadeInTime: optionalNum(c.FadeInTime),
        fadeOutTime: optionalNum(c.FadeOutTime),
        segments: parseSegments(numbers, index),
    };
}

function parseSegments(
    flat: readonly number[],
    curveIndex: number,
): MotionSegment[] {
    let i = 0;
    const p0: MotionPoint = { time: flat[i++]!, value: flat[i++]! };
    const out: MotionSegment[] = [];
    let prev = p0;

    while (i < flat.length) {
        const kindId = flat[i++]!;
        const kind = SEGMENT_KIND[kindId];
        if (!kind) {
            throw new Error(
                `@doki-land/live2d: Curves[${curveIndex}] unknown segment ${kindId}`,
            );
        }
        if (kind === "bezier") {
            if (i + 5 >= flat.length) {
                throw new Error(
                    `@doki-land/live2d: Curves[${curveIndex}] truncated bezier`,
                );
            }
            const p1: MotionPoint = { time: flat[i++]!, value: flat[i++]! };
            const p2: MotionPoint = { time: flat[i++]!, value: flat[i++]! };
            const p3: MotionPoint = { time: flat[i++]!, value: flat[i++]! };
            out.push({ kind, p0: prev, p1, p2, p3 });
            prev = p3;
        } else {
            if (i + 1 >= flat.length) {
                throw new Error(
                    `@doki-land/live2d: Curves[${curveIndex}] truncated ${kind}`,
                );
            }
            const p3: MotionPoint = { time: flat[i++]!, value: flat[i++]! };
            out.push({ kind, p0: prev, p3 });
            prev = p3;
        }
    }
    return out;
}

function num(v: unknown, label: string): number {
    if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`@doki-land/live2d: motion3 ${label} must be a number`);
    }
    return v;
}

function optionalNum(v: unknown): number | undefined {
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
